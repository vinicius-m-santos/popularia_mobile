# POP-28: publicações da comuna em FlashList

Data: 05/11/2026. Escopo: lista de publicações da página da comuna.
Branch de base: `feature/post-action-subscriptions` (`92911b8`). Sem mudança de
rota, de API ou de contrato de navegação.

## Problema

`src/features/comunas/comuna-screen.tsx` usava `ScrollView` + `posts.map`: cada
página carregada montava um `PostCard` novo e os mantinha montados enquanto a
tela vivesse. Com 200 publicações, eram 200 cartões, 200 blocos de mídia e
players de vídeo fora da viewport. O cabeçalho, as abas e os estados também
ficavam no mesmo scroll, sem reciclagem.

## Implementação

- A lista passou a ser `PopulariaList` (FlashList 2) com células recicláveis. Não
  há `ScrollView` em volta: a lista é o único scroll vertical da aba.
- As linhas são discriminadas por `kind`: `hero`, `tabs`, `intro`, `empty`,
  `post`, `rules` e `members`. `keyExtractor` usa o ID estável de cada linha
  (`FeedItem.id` para publicações) e `getItemType` separa texto, mídia, PDF,
  enquete e as linhas fixas, para a reciclagem não reutilizar uma célula com a
  estrutura de outra.
- O hero e a barra de abas são as duas primeiras células. `stickyHeaderIndices={[1]}`
  mantém a barra de abas fixa ao rolar, preservando o comportamento anterior do
  `stickyHeaderIndices` do `ScrollView`. `stickyHeaderConfig.hideRelatedCell`
  evita pintar a célula original atrás da barra fixa.
- `ListHeaderComponent` carrega o estado de erro de atualização da comuna, que
  fica acima do hero, como antes.
- O estado vazio é uma linha própria depois do bloco de abertura (`SquareEntry`,
  próximo evento, fixados e carregamento/erro). Assim ele continua aparecendo no
  mesmo lugar, sem virar conteúdo do cabeçalho.
- As abas Regras e Membros continuam sendo células de conteúdo da mesma lista;
  trocar de aba não refaz a página de publicações já carregada.
- `ProfileSwipeContent` envolve as células de conteúdo (publicações, introdução,
  regras e membros), mantendo o swipe horizontal entre abas. Hero e abas ficam
  fixos, como antes. `SwipeAwarePostCard` repassa o gesto do swipe ao cartão para
  os controles nativos do vídeo terem prioridade.
- A paginação continua explícita: cursor em `usePaginatedData`, erro de página
  com retry e botão "Carregar mais publicações". Não foi adicionado
  `onEndReached` automático; o comportamento existente foi preservado.
- O carregamento de publicações, o erro privado (`/errors/comuna-private`), o
  estado vazio e o aviso de comuna privada sem participação foram preservados.
- O contador de publicações do hero continua sendo `carregadas` + `+` enquanto
  houver próxima página.

### Por que hero e abas não estão no `ListHeaderComponent`

`stickyHeaderIndices` da FlashList indexa o **array `data`**, não o header. Para
fixar a barra de abas pelo mecanismo da própria biblioteca, ela precisa ser um
item de `data` e precisa de uma célula anterior (o hero) para que o cálculo de
scroll a fixe somente depois que o hero sair da tela. Colocar hero e abas no
`ListHeaderComponent` exigiria um overlay de abas controlado por scroll na mão,
com uma segunda instância da barra. A escolha por células mantém o mecanismo
nativo da FlashList e o mesmo visual. A consequência é a mesma do perfil: o hero
é reciclável e pode ser desmontado quando a janela fica muito abaixo dele.

## Vídeo e viewport

`useListVisibility` + `mediaViewabilityConfig` (20% visível por 100 ms) passam
`mediaVisible` ao `PostCard`; fora da viewport o `PostAttachment` desmonta o
player e mostra o pôster (`VideoPoster`). O `PostCard` real não foi alterado.
Isto cobre o requisito de não deixar players ativos fora da tela; o escopo
completo do POP-21 (viewport compartilhada entre listas) não foi implementado.

## Paginação e revalidação

A tela mantém o fluxo atual: `usePaginatedData` recarrega a primeira página
quando `postsVersion` muda (publicar) e quando a participação na comuna muda.
O POP-35 (revalidação preservando todas as páginas carregadas) **ainda não foi
implementado**; esta entrega não depende dele. A lista já está preparada para
essa mudança: as chaves são estáveis, a lista não é remontada e o teste de
revalidação não fixa quantas páginas o hook recarrega. Quando o POP-35 entrar,
a tela pode passar a usar `revalidate()` sem alterar a lista; o teste continua
válido.

## Contadores documentados (POP-5)

A instrumentação continua fechada por padrão e nunca liga em produção. Para
medir, use `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1` e
`EXPO_PUBLIC_APP_ENV=staging|development`; detalhes em
[`docs/mobile-performance-baseline.md`](./mobile-performance-baseline.md).

- **`onLoad` da lista**: `PopulariaList` registra `recordListLoad` com o
  `performanceListId` `comuna:<slug>:<aba>` (por exemplo `comuna:hortas:posts`).
  O snapshot expõe em `lists` o `elapsedTimeInMs` e o `itemCount`, e
  `counters.listLoads` conta as chamadas. A tela de diagnóstico
  (`/diagnostico-performance`, só em development/staging) mostra "FlashList ·
  onLoad". Esse tempo é o que a FlashList levou para desenhar os itens; não é
  TTI.
- **Montagem de cartões**: `PostCard` é envolvido por `withPerformanceProfiler`.
  O snapshot `commits` tem uma entrada por **instância montada**, com
  `mountCommits`, `updateCommits` e `actualDuration`. O número de entradas de
  `PostCard` é o teto de cartões montados ao mesmo tempo (a janela da lista), não
  o total carregado. `counters.profilerCommits` soma os commits. Para 200 posts,
  a expectativa é uma janela pequena, não 200 entradas.
- **Players**: `video.mountedNow`, `video.playingNow`, `counters.videoMounts` e
  os eventos `mount`/`play`/`pause`/`unmount` vêm do `PostAttachment`. Com a
  viewability, o número de players montados deve acompanhar a viewport.
- `src/lib/performance/` limita os registros em anel (400 instâncias/commits,
  100 `onLoad`, 300 eventos de vídeo). Nada é enviado à rede.

## Fixture e testes

O teste usa `buildQaFeedItems`/`qaFeedPage` (`src/features/performance/qa-fixture.ts`):
240 publicações, 160 fotos e 80 vídeos, páginas de 80. O `PostCard` é substituído
por um contador de montagens; os demais componentes pesados da comuna (hero,
praça, evento, regras, membros, biblioteca) são dublês.

`src/features/comunas/__tests__/comuna-posts-list.test.tsx` cobre:

1. **Reciclagem**: com 80 e depois 240 publicações carregadas, a lista manteve
   12 cartões montados (limite do teste: menos de 40; nunca 240).
2. **Paginação por cursor**: `null` → `80` → `160`, sem duplicar cartões e com o
   contador do hero em `80+`, `160+` e `240`.
3. **Revalidação**: publicar dispara nova carga, a lista não remonta os cartões
   visíveis e a próxima página continua a partir do cursor atual.
4. **Estados**: loading, vazio, erro com retry, falha ao paginar com retry e
   comuna privada sem participação.
5. **Abas**: Regras, Membros, Biblioteca e volta a Publicações sem refazer a
   página de publicações.
6. **Estrutura da lista**: abas no índice sticky 1, `performanceListId`, tipos de
   célula distintos para vídeo/texto/enquete.
7. **Viewport**: `mediaVisible` só chega ao cartão que a viewability reporta, e o
   cartão seguinte continua oculto.

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/features/comunas/__tests__/comuna-posts-list.test.tsx --runInBand

NODE_OPTIONS=--max-old-space-size=512 npm run check:fast
```

## Validação executada nesta entrega

- `npm run check:fast`: ESLint e TypeScript passaram.
- `npx jest src/features/comunas/__tests__/comuna-posts-list.test.tsx --runInBand`:
  **9 testes passaram**.
- Suítes relacionadas (`src/features/comunas`,
  `src/features/profiles/__tests__/profile-screen.test.tsx`,
  `src/features/performance/__tests__/qa-harness.test.tsx`): **59 testes
  passaram**.

## Limitações e o que não foi validado

- **Não houve execução em aparelho.** FPS, frames perdidos, memória, TTI,
  gestos reais de scroll/sticky e o React Profiler em build de release não foram
  medidos. Os números de montagem acima são do Jest/host, não de um iPhone ou
  Android.
- A física do sticky header, a reciclagem durante o scroll rápido e a
  continuidade da posição ao paginar só podem ser confirmadas no aparelho.
  `stickyHeaderIndices`/`hideRelatedCell` é um recurso da FlashList 2 e precisa
  ser conferido nas duas plataformas.
- `npm run test:e2e` não foi executado: a entrega não altera rotas, navegação,
  autenticação ou formulário. A tela não foi navegada no Playwright nesta
  tarefa.
- O hero continua sendo uma célula reciclável; ao rolar muito, ele pode ser
  desmontado. O perfil já segue esse padrão. Se o produto exigir o hero sempre
  montado, será necessário o overlay manual de abas (fora do escopo).
- O carregamento incremental continua por botão, como antes; não foi adicionado
  carregamento automático ao chegar ao fim.
- O POP-21 (viewport compartilhada) não foi implementado; apenas a viewability
  local da lista foi usada.

## Riscos

- Regressão visual em telas estreitas ou com fonte ampliada por causa de alturas
  de célula e do sticky header — precisa de inspeção no aparelho.
- Quando o POP-35 for implementado, a carga de páginas na revalidação precisa
  ser revista junto; a lista e o teste atuais não dependem dele.
- O `itemCount` do `onLoad` é o total carregado no momento, não o número de
  células montadas; leia os dois contadores juntos.
