# POP-46: drag-to-dismiss e retorno elástico do PhotoViewer

Data: 07/11/2026. Escopo: `src/features/posts/components/photo-viewer.tsx` e
`photo-viewer-geometry.ts`. Sem mudança de rota, de contrato de mídia ou de API.

## Problema

O descarte da foto chamava `onClose` no mesmo instante em que o pan terminava.
O backdrop era pintado pelo próprio `Modal` e não acompanhava o gesto, o retorno
ao centro usava `withTiming` e não havia proteção explícita para a pinça no
mesmo contato. A referência é a auditoria de fluidez do commit `12c0369`
(Top 10 #8), aplicada depois do ajuste de pinça da POP-45.

## Implementação

- O `Modal` virou transparente. Um `Animated.View` de tinta funciona como
  backdrop e o chrome fica no mesmo grupo de opacidade. A opacidade é derivada
  da translação vertical no worklet: a foto acompanha o dedo e o feed aparece
  por baixo proporcionalmente ao arrasto.
- O descarte só começa acima de 110 pt de deslocamento ou de um fling acima de
  900 pt/s com pelo menos 48 pt de arrasto e na mesma direção do gesto. Um
  retorno rápido ao centro não conta como fling.
- Quem descarta anima a foto até além da borda útil (altura do viewport + 64,
  no mínimo) em 220 ms. O `onClose` é chamado no callback de conclusão do
  `withTiming`, nunca antes de a animação terminar.
- Abaixo do limite, `withSpring` devolve posição e backdrop ao centro. A
  velocidade vertical da soltura entra como velocidade inicial da mola, o que
  dá o retorno elástico sem travar o gesto.
- `ReduceMotion.System` é usado na mola, no descarte e nas transições já
  existentes de pinça e duplo toque.
- Uma pinça no mesmo contato marca `pinchTouched`; o pan ignora updates e não
  pode descartar enquanto a marca existir. O zoom continua opaco no backdrop.
  A marca só é limpa em um pan novo, não quando a pinça termina.
- `closing` impede um segundo descarte enquanto a animação de saída está em
  voo. Fechar pelo botão/back cancela animações e libera a flag.
- O estado do gesto é limpo na montagem do conteúdo do `Modal` (o Modal nativo
  desmonta os filhos ao fechar) e também em `onShow`, cobrindo a reabertura no
  iOS sem deixar a foto fora da tela. Nenhum valor compartilhado é escrito
  durante o render.

## Testes

- `photo-viewer-geometry.test.ts` cobre distância, velocidade, direção do
  fling, alvo fora da tela e opacidade do backdrop com/sem zoom.
- `photo-viewer.test.tsx` cobre: foto seguindo o dedo, backdrop apagando,
  arrasto curto com mola, descarte por distância com callback após a animação,
  descarte por velocidade, pinça sem descarte, gesto cancelado, botão
  acessível, voltar do Android e reabertura com estado limpo.
- `e2e/specs/mobile-ux-smoke.spec.ts` continua abrindo/fechando a foto pelo
  controle acessível no app web. O arrasto e a pinça reais continuam no
  roteiro manual de aparelho.

## Validação executada

- `npx expo lint` verde.
- `npx tsc --noEmit` verde; nesta máquina o processo precisou de
  `NODE_OPTIONS=--max-old-space-size=1024` (com 512 o heap estourou, como já
  registrado em tarefas anteriores).
- Jest focado: 2 suítes, **29 testes** verdes.
- Jest das suítes relacionadas de mídia/posts: 9 suítes, **69 testes** verdes.
- Suíte completa: 144 suítes, **870 testes** verdes. Os avisos de `act(...)` e
  de worker sem saída limpa já vinham de outras suítes.
- Playwright focado: `mobile-ux-smoke.spec.ts -g "abre a foto em tela cheia"`,
  **1 teste** verde no Chromium.

## O que não foi validado

Não houve execução em aparelho Android/iOS nesta sessão. Portanto não há
medição de FPS, latência percebida, física da mola, disputa real entre pinça e
pan, VoiceOver/TalkBack nem comportamento em aparelho com recorte. A suíte
Jest usa mocks de gesto e de Reanimated; ela prova os limites e a ordem do
callback, não a fluidez. Esses pontos continuam pendentes de validação manual.
