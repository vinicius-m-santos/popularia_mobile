# POP-29: swipe do feed em RNGH/UI thread

Data: 06/11/2026. Escopo: troca de abas por swipe horizontal no feed
(`src/app/(tabs)/(inicio)/index.tsx`). Sem mudança de rota, API ou contrato de
navegação.

## Problema

O feed usava `PanResponder` com captura em JS
(`onMoveShouldSetPanResponderCapture`). A decisão de capturar o gesto e a de
trocar de aba rodavam no thread de JS, competindo com o scroll vertical da
`PopulariaList` e com gestos de componentes dentro dos cartões.

## Implementação

- A captura passou a ser um `usePanGesture` da API v3 do
  `react-native-gesture-handler` instalado, ligado por `GestureDetector` apenas
  à área da lista. O `FeedHeader` fica fora do detector, então o scroll das abas
  não vira swipe de página.
- Thresholds explícitos: o pan só ativa depois de **20** no eixo X e falha ao
  passar de **16** no eixo Y (`activeOffsetX`/`failOffsetY`). Isso mantém a
  lista vertical dona do scroll e evita capturar um arrasto diagonal.
- A troca continua exigindo **48** de deslocamento horizontal e dominância de
  **1,25×** sobre o eixo Y no fim do gesto. A decisão pura está em
  `src/features/feed/feed-swipe.ts`, usada pelo gesto e pelos testes.
- `onDeactivate` roda como worklet na UI thread. `runOnJS` é chamado uma única
  vez, já com o resultado decidido, para atualizar o estado da aba. Gestos
  cancelados (`event.canceled`) são ignorados.
- O gesto é memoizado para não registrar/desregistrar o handler nativo a cada
  render do feed.

## Testes

- `src/features/feed/__tests__/feed-swipe.test.ts`: distância mínima, direção,
  dominância vertical, pontas e aba desconhecida.
- `src/features/feed/__tests__/feed-screen.test.tsx`: thresholds do pan,
  swipe para a próxima/anterior, arrasto vertical, gesto cancelado, limite de
  distância e pontas. O teste aciona o callback do gesto e confere a lista
  (`performanceListId`) da aba resultante.

## Validação executada

- `NODE_OPTIONS=--max-old-space-size=512 npm run check:fast`: ESLint e
  TypeScript passaram.
- `NODE_OPTIONS=--max-old-space-size=512 npx jest --runInBand --silent`:
  **123 suítes / 728 testes passaram**.
- Testes focados de feed: **12 testes passaram**.

## Limitações e o que não foi validado

- **Não houve execução em aparelho Android/iOS.** O handoff entre pan e
  scroll nativo, o swipe em carrossel, o back/swipe nativo e o frame
  time/threads não foram medidos. Os testes de componente não substituem essa
  validação.
- A comparação de frame time/threads com o `PanResponder` anterior não foi
  feita; nenhum ganho de fluidez é afirmado nesta entrega.
- `npm run test:e2e` não foi executado: a mudança não altera rotas, navegação
  de pilha, autenticação ou formulário. A troca de aba é estado local da tela,
  sem mudança de URL.
- A lista de abas do swipe continua incluindo `perto`, como antes, mesmo quando
  a API não oferece essa aba. Esse comportamento pré-existente não foi alterado
  nesta tarefa.
