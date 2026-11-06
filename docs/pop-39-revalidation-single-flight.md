# POP-39: revalidações single-flight entre AppState, foco e avisos

Data: 06/11/2026. Escopo: gatilhos globais e de tela que revalidavam a mesma
leitura, contador de avisos e prefetch de publicação. Sem mudança de rota, API
ou layout.

## Problema

O app tinha quatro donos de revalidação que podiam coincidir:

| Gatilho | Owner | O que disparava |
| --- | --- | --- |
| `AppState` global | `src/app/_layout.tsx` | `refetchQueries` de todas as queries ativas e obsoletas |
| Foco da Biblioteca | `library-screen.tsx` | primeira página de documentos e coleções |
| Foco/`AppState` da Biblioteca | `library-screen.tsx` | a mesma primeira página, sem janela de frescor |
| Troca de aba | `use-unread-count.ts` | contador de avisos em **toda** mudança de segmento |
| Foco de Avisos e foreground do push | `notifications-context.tsx` | outra leitura do contador |

Além disso, `preparePost` era chamado no `onPressIn` e novamente no `onPress`
do mesmo cartão.

## Owners e guards aplicados

- **Foreground global** (`src/lib/query/revalidation.ts`): uma passagem por
  retorno ao primeiro plano, com janela de 2 s para transições encadeadas
  (`inactive -> active`, `background -> active`) e single-flight enquanto a
  passagem anterior espera a rede. A política `staleTime` de cada domínio
  continua sendo a fonte da verdade; `stale: false` e queries frescas não geram
  request.
- **Biblioteca**: foco e `AppState` passaram a compartilhar uma janela de 30 s.
  Voltar de um documento ou retornar do background dentro da janela não repete
  a primeira página. A chamada em si continua single-flight dentro de
  `usePaginatedData`, que já ignorava revalidação concorrente.
- **Contador de avisos**: `refreshUnread` ganhou single-flight e janela de 10 s
  para gatilhos visuais. `force: true` é usado depois de ler/ler todas, ao
  receber um push e no foreground (hook do feed e runtime de push), quando o
  servidor pode ter mudado o estado. O hook passou de "toda troca de segmento"
  para foco da rota + foreground: trocar para Explorar/Praças/Perfil não pede o
  contador; voltar ao feed pede, se a janela expirou.
- **Prefetch**: o corpo do cartão e a grade de mídia continuam preparando a
  publicação no `onPressIn`; o `onPress` não repete o trabalho. Os demais toques
  do cartão (Comentar, anexo, comentário em destaque) não têm `onPressIn` e
  mantêm o prefetch próprio.

## Contagem de requests nos testes

Números de chamadas dos mocks em Jest, não medição de rede, FPS ou tempo em
aparelho.

| Cenário | Antes | Depois |
| --- | --- | --- |
| `inactive -> active` seguido de `active` em < 2 s | 2 passagens globais | **1** |
| Foco da Biblioteca + `AppState` dentro de 30 s | 2 primeiras páginas | **1** |
| Foco da aba de avisos dentro de 10 s | 1 leitura por gatilho | **1** leitura compartilhada |
| Toque no corpo do cartão (`pressIn` + `press`) | 2 `preparePost` | **1** |
| Toque no tile da grade de mídia | 2 `preparePost` | **1** |

## Testes

- `src/lib/query/__tests__/revalidation.test.ts`: background/inactive,
  coalescência de transições, janela, passagem em voo e liberação da passagem.
- `src/features/library/__tests__/library-revalidation.test.tsx`: foco e
  foreground não repetem a primeira página dentro da janela; depois dela,
  revalidam.
- `src/features/notifications/__tests__/unread-revalidation.test.tsx`:
  foco/`AppState` compartilham a leitura em voo, a janela evita repetição e uma
  falha preserva o último contador.
- `src/features/notifications/__tests__/notifications-screen.test.tsx`: fluxos
  existentes de leitura, leitura em massa, paginação e troca de conta.
- `src/features/posts/components/__tests__/post-card-media-visibility.test.tsx`
  e `src/features/profiles/components/__tests__/profile-media-grid.test.tsx`:
  `preparePost` uma vez por toque.

## Limitações

- A validação é de componente/host. Não houve medição de rede, FPS, memória ou
  tempo em aparelho real; gestos e scroll não foram reavaliados nesta tarefa.
- O E2E não foi executado porque não há mudança de rota, autenticação,
  onboarding ou formulário. A navegação de foco foi coberta pelos testes de
  componente com foco controlado.
- As janelas de 2 s, 10 s e 30 s são guards de coalescência, não promessas de
  frescor absoluto. Uma falha de revalidação silenciosa pode esperar a próxima
  janela ou o próximo foco para tentar de novo.
