# POP-40: prefetch de publicação, perfil e comuna antes da navegação

Data: 06/11/2026. Escopo: aquecimento de cache no toque inicial de cartões e
linhas que abrem publicação, perfil ou comuna. Sem mudança de rota, contrato de
API, layout ou política de frescor existente.

## Problema

A publicação já aquecia o detalhe no `onPressIn`, mas repetia `preparePost` no
`onPress`. Perfil de terceiros e comuna só montavam loader depois da navegação:
a tela de destino era quem iniciava a primeira leitura. Em rede lenta, o toque
final podia somar uma segunda chamada à mesma consulta.

## Prefetch central

`src/lib/query/client.ts` passou a expor dois helpers best-effort:

- `prefetchQueryOnce`: uma consulta simples. Não rejeita, não repete erro e
  encerra sem efeito se a chave já está em voo. `retry: false` impede que o
  prefetch dispute com o retry da tela de destino em rede lenta.
- `prefetchInfiniteQueryOnce`: somente a primeira página de uma lista ainda
  vazia. Uma lista já carregada não é refeita no `onPressIn`, o que
  multiplicaria páginas em rede lenta e poderia substituir o histórico. O
  destino continua revalidando pela própria `staleTime`.

Os dois helpers deixam a tela de destino buscar normalmente quando o prefetch
falha ou ainda não concluiu. Esse é o fallback: nenhum toque fica bloqueado
esperando o aquecimento.

## Domínios

- **Publicação** (`src/features/posts/queries.ts`): `postKeys` concentra
  detalhe e preview. `preparePost` grava o cartão como placeholder e aquece o
  detalhe com `contentPolicy.post` (15 s/5 min). O toque final em
  `post-card.tsx`, na grade de mídia do perfil e nos fixados da comuna só
  navega; o `onPressIn` é a única entrada do prefetch.
- **Perfil** (`src/features/profiles/queries.ts`): `profileKeys`,
  `profileOptions` e `profilePostsOptions` usam as mesmas chaves e a mesma
  `contentPolicy.profile` (60 s/10 min) da tela. `prepareProfile` aquece o
  detalhe e a primeira página de publicações em paralelo.
  `prepareProfileFromUser` resolve o próprio perfil pela chave `me` e, na API,
  pelo handle para a lista de publicações. Perfil privado que a pessoa ainda
  não segue não tem publicações prefetchadas.
- **Comuna** (`src/features/comunas/queries.ts`): `comunaPostsOptions` usa a
  chave infinita canônica. `prepareComuna` grava o resumo da lista e aquece o
  detalhe + primeira página com `contentPolicy.comuna` (60 s/10 min). Comuna
  privada sem participação não prefetcha publicações, evitando um 403 antes de
  a tela mostrar o recado de acesso.

## Pontos de toque

- `post-card.tsx`: corpo, mídia, comentário exibido, chip "Comentar", autoria
  (quando abre perfil) e rótulo da comuna.
- `author-line.tsx` e `chamado-card.tsx`: identidade aceita `onPressIn` para o
  prefetch de perfil.
- `person-row.tsx`: linhas de pessoas do Explorar, relações e participantes.
- `comuna-row.tsx`: lista do perfil e do Explorar.
- `comunas-carousel.tsx`: cards de "Comunas para conhecer".
- `pinned-posts.tsx`: publicações fixadas da comuna.

## Deduplicação e gestos

- Duas chamadas concorrentes ao mesmo prefetch geram **um** request: a segunda
  vê `fetchStatus === 'fetching'` e retorna.
- Um toque cancelado ou long press dispara o `onPressIn` uma vez e não navega;
  não há timer, repetição automática ou segundo caminho de prefetch no
  `onPress`.
- O TanStack mantém a consulta em voo compartilhada com a tela que monta antes
  do prefetch terminar, sem duplicar a chamada.

## Testes

- `src/lib/query/__tests__/prefetch.test.ts`: deduplicação em voo, erro
  silencioso sem retry, respeito à `staleTime` e lista infinita já carregada
  não refeita.
- `src/features/posts/components/__tests__/post-card-prefetch.test.tsx`:
  `pressIn` aquece a publicação uma vez; `press` apenas navega; autoria e
  comuna aquecem nos seus alvos.
- `src/features/profiles/__tests__/profile-screen.test.tsx`: perfil e primeira
  página pré-aquecidos abrem com **0** requests adicionais; prefetch que falha
  cai no carregamento normal da tela.
- `src/features/comunas/__tests__/comuna-posts-list.test.tsx`: detalhe e
  primeira página pré-aquecidos abrem com **0** requests adicionais; comuna
  privada sem participação não prefetcha publicações.

As contagens acima são chamadas de loader em Jest, não medições de rede, FPS ou
tempo de tela. Não houve medição em aparelho real de gestos, scroll ou rede
lenta; portanto não se declara ganho de fluidez medido.

## Gates executados

- `npm run check:fast` (ESLint + TypeScript): passou.
- Jest focado dos arquivos acima e das telas que consomem os mesmos cartões:
  **26 testes** no recorte inicial; a suíte completa com `--maxWorkers=2`
  terminou com **129 suítes / 788 testes** passando.
- `npm run test:e2e`: **40 passaram**, 1 `fixme` já existente. O fluxo de feed,
  publicação, Explorar, Biblioteca, folhas, sessão e onboarding continuou
  navegável.
- `git diff --check`: passou.

A suíte E2E roda no navegador com API falsa; ela confirma URL, conteúdo e
navegação, não física de gesto, teclado nativo ou aparelho real.
