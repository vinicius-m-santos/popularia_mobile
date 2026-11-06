# POP-41: preservar filtros, rascunhos e posição em fluxos de retorno

Escopo: Biblioteca, Praças, Avisos, Discussão e página da comuna. Sem mudança de
rota, contrato de API ou layout.

## Problema

Ao abrir um detalhe e voltar — ou ao remontar a tela por troca de aba — a lista
podia voltar ao topo por dois motivos:

- a revalidação trocava a primeira página e recomeçava o histórico, perdendo o
  cursor já carregado;
- o estado de filtros e o texto digitado viviam só no componente, que era
  desmontado no retorno.

## Memória efêmera por tela

`src/lib/screen-memory.ts` guarda apenas estado de interface em um `Map` da
sessão do processo: nada é enviado ao servidor nem persistido no aparelho. É
limpo no logout, na troca de sessão e nos testes.

- `useScreenState` (`src/hooks/use-screen-state.ts`) hidrata um `useState` a
  partir dessa memória e grava cada mudança. A chave inclui a conta e o contexto
  da lista (`scope`, `owner`, `comuna`, `collection`), para uma tela não herdar o
  filtro de outra. `restore: false` deixa um parâmetro explícito de rota (um
  assunto aberto por link) vencer a visita anterior.
- `useMentionDraft(storageKey)` passou a aceitar uma chave opcional. Rascunho,
  menções, cursor e seleção do comentário sobrevivem à remontagem da discussão;
  `reset()` limpa a memória depois de um envio bem-sucedido.

## Posição de leitura

`useListScrollMemory` (`src/hooks/use-list-scroll-memory.ts`) grava, a cada
rolagem, o offset e a âncora (primeiro item visível). Ao remontar:

1. se o item-âncora mudou de índice, a lista usa `scrollToIndex` para voltar ao
   mesmo trecho;
2. caso contrário, restaura o offset exato com `scrollToOffset`.

A gravação vai para o `Map`, não para o estado do React: rolar não causa render
extra. As listas também recebem `maintainVisibleContentPosition`, o que evita o
salto quando a revalidação insere/remove itens acima da janela visível.

## Revalidação sem recomeçar

- `useCachedPages` ganhou `revalidate()`, uma atualização silenciosa do prefixo
  que mantém páginas, itens e cursor e não aciona o indicador de pull-to-refresh.
  O `refresh()` manual continua igual.
- Biblioteca e Praças usam `revalidate` no foco e no `AppState`, em vez de
  `refresh`.
- Avisos revalida no foco com ref para o callback mais recente, sem reexecutar o
  efeito a cada mudança de estado.
- Discussão revalida comentários em vez de recomeçar da primeira página.
- A comuna revalida publicações ao voltar/Publicar e preserva as páginas já
  carregadas.

## Testes

- Novos testes de `useListScrollMemory`, `useScreenState` e do rascunho de
  menções.
- Biblioteca: remontagem mantendo termo e filtro sem refazer a consulta.
- `useCachedPages`: revalidação silenciosa preservando páginas e cursor.
- E2E (`mobile-ux-smoke.spec.ts`): a volta do documento compara o scroll da
  Biblioteca antes e depois e exige que o ponto de leitura continue próximo.

## Validação executada

- `npm run lint`: passou.
- `npx tsc --noEmit`: passou (executado separado do lint por limite de heap do
  WSL).
- Jest completo: **786 testes** em **130 suítes**, todos passaram.
- Playwright completo: **40 passaram**, 1 `fixme` já existente.

## Limitações

- Não houve medição em aparelho real de física de scroll, gesto de voltar, FPS ou
  jank. A validação de navegação é no Chromium; iOS e Android continuam no
  roteiro manual.
- O offset é restaurado quando a tela remonta. Se o conteúdo ainda estiver
  carregando, a restauração espera a lista ficar pronta (`ready`).
- A memória de rolagem é da sessão: fechar o app ou trocar de conta a descarta.
