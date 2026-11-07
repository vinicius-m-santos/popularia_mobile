# POP-50: feedback de motion em apoio, eco e salvar

Data: 07/11/2026. Escopo: microanimação local nas ações sociais. Sem rota nova,
sem dependência nova e sem mudança de contrato de API.

## O que mudou

- `constants/theme.ts` ganhou os tokens `Motion.scale.reaction` (1.14) e
  `Motion.spring.reaction` (mola curta). Os tokens de movimento da casa continuam
  nesse arquivo; `motion.ts` não existe nesta base, então não foi criado um
  segundo conjunto de valores.
- `hooks/use-reaction-feedback.ts` concentra o pulso: um `withSequence` de mola
  para cima e de volta ao repouso, com `ReduceMotion.System`. O pulso observa o
  sinal booleano de estado (`supported`, `echoed` ou `saved`).
- O primeiro render não anima. Uma troca do sinal — o update otimista — anima
  uma vez; renders repetidos com o mesmo estado não reiniciam a mola. No erro, o
  rollback da store devolve o sinal anterior e o mesmo item pulsa na volta.
- `PostCard` anima apenas o conteúdo de ícone/contador dos chips de apoio e eco e
  o botão de salvar. `PostDetail` segue o mesmo contrato. `CommentRow` anima o
  ícone/contador do apoio do comentário. `VideoViewer` anima o conteúdo das ações
  da coluna direita.
- Comentar é navegação, não alternância: o contador de comentários não pulsa.
  O pulso nunca é aplicado ao cartão inteiro, apenas ao conteúdo da ação.
- O apoio de comentário passou a dar `haptic('light')` imediatamente antes do
  update otimista. Apoio, eco e salvar de publicação já tinham o tique pelos
  handlers existentes.

## Estados, repetição e rollback

- Os testes de ação existentes continuam sendo a fonte de verdade para
  consistência: apoio/eco/salvamento escrevem o otimista antes da requisição,
  rollback restaura contador e estado, e toques rápidos são ignorados pela trava
  enquanto a primeira requisição viaja.
- O sinal de animação é booleano de estado, não a contagem. Uma confirmação do
  servidor que só corrige o número não dispara um segundo pulso; uma falha que
  desfaz o estado dispara o pulso de volta.
- Cada instância do hook pertence a um item. O teste de fanout de `PostCard`
  continua mostrando um único cartão atualizado por toque, com um único commit.

## Acessibilidade

- `ReduceMotion.System` é passado na mola, então a preferência do sistema vale
  para o pulso inteiro.
- Rótulos e `accessibilityState` existentes continuam anunciando o estado atual
  (`selected`) e a contagem. A animação é reforço visual, não a única indicação.
- A área de toque de 44 e os alvos existentes foram preservados; os wrappers
  animados não alteram o layout.

## Validação executada

- `npm run check:fast` com `NODE_OPTIONS=--max-old-space-size=1024` (ESLint e
  TypeScript): passou. Com 512 o TypeScript atingiu o limite de heap neste host.
- Jest focado, `--runInBand`: `use-reaction-feedback`, `comment-row`,
  `discussion-screen`, `post-card-media-visibility`, `video-viewer`,
  `post-action-consistency`, `save` e `post-action-fanout` — 8 suítes / 45 testes
  passaram.
- Suite Jest completa, `--ci --maxWorkers=2 --forceExit`: 149 suítes / 889 testes
  passaram.
- O teste `post-action-fanout` confirma o Profiler de host: apoiar um cartão
  atualiza só ele, com um commit. Nenhuma métrica de FPS, jank ou memória foi
  medida.

## O que não foi validado

- Nada foi executado em aparelho iOS/Android. A física da mola, o Reduce Motion
  nativo, o tique e a percepção de resposta imediata seguem pendentes de inspeção
  manual.
- Rede lenta e modo avião não foram exercitados em aparelho; o caminho de erro
  foi coberto por testes de componente com API mockada.
- Não houve mudança de navegação, rota, autenticação, onboarding ou formulário;
  por isso não foi necessário ampliar o Playwright. A suíte E2E não substitui a
  inspeção visual nem a validação no aparelho.
