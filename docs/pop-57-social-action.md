# POP-57: primitive de ações sociais com contador

Data: 08/11/2026. Escopo: `src/components/social-action.tsx`, cartão do feed,
publicação aberta, rail do vídeo e linha de comentário. Sem rota nova, sem
dependência nova e sem mudança de contrato de API.

## O que mudou

- `SocialAction` concentra o que era repetido em `ActionChip`, `CompactAction`,
  `RailAction` e no apoio de comentário: ícone, contador formatado, estados
  ativo/ocupado/indisponível, rótulo acessível, feedback de toque, pulso de
  reação e tique tátil.
- A aparência é explícita e preserva as quatro composições existentes:
  - `feed`: caixa de papel com borda de tinta do cartão do feed;
  - `editorial`: ação compacta sem caixa da publicação aberta;
  - `rail`: coluna vertical de 52 sobre o vídeo em tela cheia;
  - `comment`: apoio sem caixa dentro da linha de comentário.
- `PostCard`, `PostDetail`, `VideoViewer` e `CommentRow` passaram a usar o
  primitive. O salvar do feed e do rail reaproveita a mesma composição com
  `showCount={false}`; o salvar da publicação aberta continua no `IconButton`
  porque é um controle só de ícone, sem contador.
- O modo `busy` troca o ícone por um `ActivityIndicator`, mantém o contador
  visível, bloqueia o toque e anuncia `disabled` + `busy` ao leitor de tela.
  `showCount={false}` remove o contador também do rótulo falado.
- O contador usa `formatCount` em um único ponto: `1200` aparece como
  `1,2 mil` no texto e no rótulo acessível.
- O tique de apoio, eco e apoio de comentário passou para o primitive, junto do
  pulso local. Salvar mantém o tique no handler compartilhado porque o mesmo
  `toggleSave` também é acionado por superfícies que não são o `SocialAction`
  (detalhe e menu); nesses botões o primitive recebe `hapticFeedback={null}` para
  não repetir o estímulo.
- O pressed deixou de ser uma opacidade estática diferente por arquivo e passou a
  usar `usePressFeedback` (POP-49): opacidade e escala curtas, com
  `ReduceMotion.System`. O pulso de reação continua vindo de
  `useReactionFeedback` (POP-50) e só dispara em alternâncias, nunca em
  navegação como Comentar.

## Acessibilidade e estados

- O rótulo segue `Ação, contador` e `accessibilityState.selected` reflete
  apoio/ecoar/salvar. Comentar não anuncia seleção.
- O contador não é a única indicação do estado: cor, ícone preenchido e o pulso
  são reforço visual. O texto acessível e o estado continuam sendo a fonte da
  verdade.
- A área de toque mínima de 44 foi preservada; o rail mantém o `hitSlop`
  vertical de 4 e horizontal de 8. O salvar do feed preserva o ícone de 20.
- Nenhuma animação é contínua e todas usam a preferência de movimento do
  sistema pelos helpers compartilhados.

## Testes

- `src/components/__tests__/social-action.test.tsx` cobre, nas quatro variantes:
  contador formatado, `onPress`, `onPressIn`, estado selecionado, navegação sem
  seleção, `busy`, `showCount={false}`, tique tátil e dimensões/superfícies.
- Testes focados executados com `--runInBand`:
  `social-action`, `comment-row`, `discussion-screen`, `post-card-prefetch`,
  `post-card-media-visibility`, `video-viewer` e `post-action-fanout` — 7 suítes
  / 36 testes passaram.
- Suíte completa: `NODE_OPTIONS=--max-old-space-size=512 npx jest --ci
  --maxWorkers=2 --forceExit` — 157 suítes / 939 testes passaram. O
  `--forceExit` é necessário pelo mesmo motivo do baseline (timers/async
  remanescentes do ambiente de teste).
- `NODE_OPTIONS=--max-old-space-size=1024 npm run check:fast` (ESLint +
  TypeScript): passou. Com 512 o TypeScript estoura o heap neste host; o limite é
  só do heap do Node, não da memória total.

## O que não foi validado

- Nada foi executado em aparelho iOS/Android. A física do pressed e do pulso, o
  Reduce Motion nativo, o tique e a leitura por VoiceOver/TalkBack seguem
  pendentes de inspeção manual.
- Não houve mudança de navegação, rota, autenticação, onboarding ou formulário;
  por isso a suíte Playwright não foi ampliada nem executada para esta entrega.
- Não foram medidos FPS, jank, memória ou tempo de resposta. Nenhuma métrica não
  medida é declarada.
