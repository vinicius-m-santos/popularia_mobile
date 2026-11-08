# POP-47 — transição thumbnail → visualizador de foto

Data: 11/11/2026. Base: `9b6f836` (main após POP-56). Escopo:
`src/features/posts/components/photo-viewer.tsx`,
`post-attachment.tsx`, um módulo novo de geometria/medida da transição e
testes focados. Sem mudança de rota, de contrato de mídia, de API ou de
dependência.

A referência é a auditoria de fluidez do commit `12c0369` (Top 10 #8, item
opcional), cujo objeto não está disponível neste clone. O ponto
`photo-viewer.tsx:185` corresponde ao `PhotoViewer` aberto por um `Modal`
transparente com fade; o ponto `post-attachment.tsx` corresponde ao `PostPhoto`
que desenha o thumbnail no feed.

## Decisão

**Adotada uma transição própria, medida, com fallback para o fade.** O
`sharedTransitionTag` do Reanimated foi avaliado e **não adotado** nesta
entrega:

- hoje o visualizador é um `Modal` transparente, não uma tela de navegação; a
  transição compartilhada do Reanimated depende da transição nativa de telas e
  não tem contrato estável dentro do `Modal`;
- uma tag por cartão em uma `FlashList` reciclada pode ser reaproveitada pela
  célula seguinte. Ao abrir/fechar, a animação pode partir ou terminar na foto
  errada, exatamente o bug que o ticket manda investigar;
- mover o consumidor para uma tela/rota compartilhada exigiria mudar feed,
  perfil, comuna, tópico, salvos, detalhe de publicação e composer. O custo e o
  risco de regressão não se justificam para um item opcional.

Em vez disso, a origem real do thumbnail é medida com `measureInWindow` no
`pressIn`. A medida vira um **snapshot do toque** e é entregue ao visualizador;
uma camada temporária percorre esse retângulo até o quadro final. Isso é
"shared-like" sem compartilhar tag, ref de célula ou identidade de view com a
lista.

## Implementação

- `post-attachment.tsx` guarda a ref do `Pressable` só para medir. No
  `pressIn`, `measurePhotoOrigin` lê `x/y/width/height` na janela; medidas
  zeradas, não finitas ou totalmente fora da janela são descartadas.
- A medida é consumida no `onPress`. Se o feed ainda não terminou de carregar
  (cache frio), se a plataforma é web, se a medida não chegou ou se a célula já
  saiu da tela, o visualizador abre sem origem e mantém o fade/listra de hoje.
- `PhotoViewer` recebe `origin?: WindowRect | null`. Quando a origem é válida e
  Reduce Motion está desligado, o `Modal` abre sem o fade nativo e uma
  `Animated.View` com a preview do feed (ou a própria URL em cache) parte do
  retângulo do thumbnail. Largura, altura, `left` e `top` são interpolados até o
  quadro `contain` da viewport; o `cover` da camada recorta a foto como o feed no
  início e como o visualizador no fim.
- O backdrop e o chrome entram por opacidade durante os mesmos 240 ms, em vez de
  cobrir o feed de uma vez. O conteúdo normal fica invisível até a camada
  chegar; depois a original assume o mesmo quadro.
- `ReduceMotion.System` é usado nas quatro medidas e na revelação. Quando
  `useReducedMotion()` já está ligado, a camada nem monta: abre direto no quadro
  final, com `animationType="none"` e `transition={null}`, como antes.
- Um prazo de 200 ms devolve o conteúdo normal se a viewport não medir por
  algum motivo; a transição nunca deixa a foto escondida.
- **Fechar continua sendo fade.** O retorno não voa para o thumbnail de
  propósito: a célula pode ter sido reciclada, rolado para fora ou desmontado.
  Um voo de volta usaria um retângulo que já não pertence àquela foto.

## Reciclagem

- A origem é um objeto de coordenadas, não uma ref de célula. A `PostPhoto` é
  remontada por `key={uri}` quando a mídia muda; ainda assim, a medida é
  consumida no `onPress` e zerada logo depois.
- A abertura normal mede no `pressIn` e consome a medida no `onPress`. Sem uma
  medida nova, inclusive na ativação pelo leitor de tela, o visualizador cai no
  fade.
- A transição só anima na abertura. Não há tag, não há retorno para uma célula
  reciclada e não há como a foto A terminar sobre a foto B.
- Se a célula for reciclada com o visualizador aberto, o `PostPhoto` é
  desmontado, o timer de saída é limpo e os shared values são cancelados no
  efeito de fechamento.

## Custo

- Fechado, o cartão não paga nada além da ref do `Pressable` e do handler de
  `pressIn`; a camada e os shared values só existem quando o visualizador é
  montado no toque.
- Na abertura, há uma chamada nativa de `measureInWindow`, quatro shared values
  de geometria, um de revelação e uma `Image` extra durante 240 ms. A camada é
  desmontada no fim; o preview continua sendo liberado ao fechar.
- A animação interpola `left/top/width/height` para manter o recorte `cover`
  correto em fotos de proporções diferentes. Isso faz layout por frame na
  camada temporária, não na lista. É o principal ponto a medir em aparelho
  fraco; se o custo aparecer, a alternativa é restringir a transição a fotos
  sem proporção extrema ou trocar por transform com um recorte pré-calculado.
- Não foram medidos FPS, frame time, memória, tempo de abertura ou custo de
  layout em aparelho. Os testes de host não são métrica de performance.

## Validação executada

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/posts/components/__tests__/photo-viewer-transition.test.ts \
  src/features/posts/components/__tests__/photo-viewer.test.tsx \
  src/features/posts/components/__tests__/post-attachment-photo.test.tsx \
  src/features/posts/components/__tests__/post-attachment.test.tsx \
  src/features/posts/components/__tests__/post-attachment-fullscreen.test.tsx \
  src/features/posts/components/__tests__/post-card-media-visibility.test.tsx \
  --runInBand --ci
npm run check:fast
```

Cobrem:

- retângulo válido, medida zerada/fora da janela e cartão parcialmente visível;
- destino centralizado na viewport, com insets e sem viewport medida;
- a camada parte da origem, chega em `left/top/width/height` finais, usa
  `reduceMotion: 'system'` e desaparece quando a sessão termina;
- conteúdo normal invisível durante a transição e visível depois;
- fallback de fade sem origem válida e com Reduce Motion;
- `pressIn` mede o thumbnail e entrega a origem ao visualizador;
- cache frio não usa transição; fechar zera origem e preview; reciclar a célula
  não herda o visualizador aberto.

Resultado desta entrega: **6 suítes focadas / 60 testes** verdes; `npm run
check:fast` (ESLint + TypeScript) verde; suíte completa **163 suítes / 980
testes** verdes (`--ci --maxWorkers=2 --forceExit`, pelo handle assíncrono já
conhecido do baseline); Playwright focado em
`mobile-ux-smoke.spec.ts -g "abre a foto em tela cheia"` **1 teste** verde no
Chromium (web mantém o fade de fallback).

## O que não foi validado

- **Nada foi executado em aparelho iOS/Android.** Não há confirmação visual de
  que a origem medida coincide com o thumbnail sob recorte, status bar ou
  edge-to-edge; nem de que o fade de fechamento é preservado quando a origem é
  limpa no mesmo commit de `visible=false`.
- Não houve lista longa real, rolagem com reciclagem, rede lenta, cache frio
  nativo nem gravação em 60/120 fps. O comportamento de reciclagem está coberto
  por contrato e testes, não por observação em aparelho.
- Não houve VoiceOver/TalkBack com a camada temporária. Ela fica
  `pointerEvents="none"` e escondida da árvore assistiva, mas a leitura do
  quadro final durante a abertura não foi ouvida.
- O Playwright cobre apenas a abertura/fechamento da foto na web, onde a
  transição medida está desligada. Ele não reproduz a camada, o `measureInWindow`
  nativo, o Reduce Motion do aparelho nem a física do `Modal`.
- O `sharedTransitionTag` não foi testado em aparelho porque foi descartado por
  arquitetura e risco de reciclagem; a decisão não depende de uma medição dele.

## Próximo passo em aparelho

1. Build de development/staging em um Android médio e um iPhone com recorte.
2. Feed longo com fotos de retrato, paisagem e panorama extremo; rolar até
   reciclar células e abrir/fechar em sequência.
3. Rede lenta e modo offline: abrir com o feed carregado (transição) e antes de
   carregar (fallback de listra).
4. Reduce Motion ligado: confirmar que não há transição, que a foto abre no
   quadro final e que fechar continua funcionando.
5. Gravar a abertura e o fechamento; conferir ausência de salto na origem, no
   destino e na troca da camada para a original.
6. Se possível, medir frame time/JS/UI da abertura com a transição e sem ela no
   mesmo aparelho e build.

Sem esses passos, esta entrega não declara fluidez, ausência de salto ou
validação em aparelho.
