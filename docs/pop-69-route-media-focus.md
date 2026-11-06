# POP-69: mídia de listas fora do foco da rota

Data: 06/11/2026. Escopo: feed, perfil, comuna, tópico e publicações salvas.
Base: POP-20 (viewport em tópicos/salvos), POP-21 (viewports da comuna) e
POP-28 (FlashList da comuna). Sem mudança de rota, de design ou dos viewers em
tela cheia.

## Problema

Depois de POP-21, abrir uma publicação sobre a comuna mantém a lista (e o player
do vídeo visível) montada na pilha nativa. O player continuava tocando mudo numa
rota que já não tinha foco. O mesmo valia para trocar de aba, abrir o perfil por
cima do feed/tópico e entrar na Biblioteca. A viewport local só conhecia o que a
lista reportava: não havia relação entre foco de rota e montagem do player.

## Auditoria

- **expo-router**: `useFocusEffect` é o primitivo correto para saber quando a rota
  ganhou/perdeu foco. Ele roda o callback no foco e o cleanup no blur, sem
  remontar a tela.
- **`useListVisibility`/`mediaVisible`**: o conjunto de IDs visíveis era mantido
  em uma store observável por `postId`. Faltava um estado de foco ao lado da
  viewport.
- **`PostAttachment`**: com `visible` falso, desmonta o player e mostra o pôster.
  Essa parte já era o contrato de POP-20/POP-21 e foi preservada.
- **`activePlayer`**: pausa o player anterior ao iniciar outro e é limpo no
  unmount. Com a mídia desmontada no blur, não sobra player ativo na rota
  coberta.

## Implementação

- `MediaVisibility` ganhou `setFocused(boolean)`:
  - `isVisible(postId)` passa a ser `focused && visible.has(postId)`;
  - ao perder o foco, os IDs da viewport atual são notificados e voltam ao
    pôster;
  - a viewport **não** é limpa. Ao voltar o foco, só os IDs que continuam na
    mesma janela são reabilitados, sem depender de uma nova `viewability`;
  - mudanças de viewport com a rota coberta atualizam a janela em memória, mas
    não notificam ninguém até o retorno.
- `useRouteMediaFocus(visibility)` em `src/hooks/use-route-media-focus.ts` liga a
  store ao `useFocusEffect` do expo-router.
- O hook foi aplicado nas cinco superfícies que renderizam `PostCard` em lista:
  feed, perfil, comuna, tópico e salvos. O perfil entrou junto porque usa o mesmo
  `PostCard`/viewport; sem isso a garantia ficaria parcial entre as abas.
- Nenhum viewer (`photo-viewer`, `video-viewer`) foi alterado. O vídeo em tela
  cheia continua com o comportamento de antes; o gate é da mídia de lista.

## Fluxo no push/back

1. A rota perde foco (`useFocusEffect` cleanup) e chama `setFocused(false)`.
2. Os cartões da viewport retida recebem `mediaVisible=false`; o
   `PostAttachment` desmonta o player e deixa o pôster.
3. O `activePlayer` é zerado no cleanup do player desmontado.
4. Ao voltar, `setFocused(true)` notifica só os IDs da viewport que continuam
   visíveis. Esses montam player de novo; os demais seguem no pôster. A posição
   da lista nunca é alterada.
5. Troca de aba, desmontagem e `AppState` fora de `active` continuam liberando a
   reprodução pelos caminhos já existentes.

## Testes de regressão

- `src/hooks/__tests__/use-list-visibility.test.tsx`: foco bloqueia a viewport e
  o retorno reabilita apenas a janela atual.
- `src/hooks/__tests__/use-route-media-focus.test.tsx`: blur/focus chamam
  `setFocused` corretamente.
- `src/features/feed/__tests__/feed-screen.test.tsx`: feed perde foco, volta e
  mantém a mesma lista/props; viewport alterada durante o foco perdido não
  habilita mídia no retorno.
- `src/features/hashtags/__tests__/topic-screen.test.tsx` e
  `src/features/library/__tests__/saved-posts-visibility.test.tsx`: mesmo
  contrato nas listas de POP-20.
- `src/features/comunas/__tests__/comuna-media-visibility.test.tsx`: POP-21/28
  com 200 publicações/66 vídeos; blur desmonta players, back reabre só a viewport
  retida e a troca de viewport coberta não monta player.

## Validação executada

- `npm run check`: ESLint, TypeScript e Jest passaram.
  - **123 suítes / 724 testes**.
- `npm run test:e2e` (Chromium local após extrair `libnspr4`/`libnss3` em
  `.cache-pw/`): **33 passaram, 1 skipped, 1 falha intermitente** no cadastro
  (`signup-onboarding.spec.ts`, seletor de cidade). O mesmo teste passou isolado
  em 12,2 s; a falha não toca em mídia/rotas de publicação e é anterior a esta
  entrega. O restante da suíte de navegação passou.

## Limitações

- **Não validado em aparelho iOS/Android.** A física da viewability, o instante
  real do unmount do `expo-video`, a geração de pôster e o comportamento da
  pilha nativa com gesto de voltar continuam pendentes de inspeção em device.
- O retorno remonta o player e recomeça do início; a posição de reprodução não é
  preservada. O pôster, a posição da lista e o estado dos cartões são.
- A mídia de lista é desmontada no blur (em vez de permanecer pausada). É o
  mesmo contrato já usado para sair da viewport e evita player órfão; se o
  produto passar a exigir retomada do segundo exato, será necessário manter o
  player pausado e reativá-lo sem remontar.
- Os viewers em tela cheia e os vídeos fora de listas (prévia do composer) não
  foram alterados por este card.
