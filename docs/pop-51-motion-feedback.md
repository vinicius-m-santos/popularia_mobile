# POP-51: feedback de motion em seguir, publicar e comentar

Escopo: microconfirmações de estado em ações sociais. Sem rota nova, sem
dependência nova e sem mudança de contrato de API.

## O que mudou

- `constants/motion.ts` concentra `Motion` com durações (140/180/320 ms),
  easings e a escala de confirmação (1.03). Os avisos (`toast`) e as ações
  passaram a usar os mesmos valores; o POP-49 moveu os tokens de `theme.ts`
  para esse arquivo.
- `hooks/use-action-feedback.ts` concentra o pulso de confirmação: escala sobe
  uma vez e volta ao repouso. O pulso só é disparado depois que a mutação
  confirma; falha não anima e mantém o aviso de erro.
- `FollowButton` usa o pulso nas duas aparências (editorial e lista). O rótulo
  acessível continua dizendo `Seguir`, `Solicitado` ou `Seguindo` com o nome da
  pessoa; `EditorialAction` e `PillButton` agora anunciam `busy` e ficam
  desabilitados enquanto a mutação está em voo.
- `CreatePostScreen` tem três fases explícitas: `idle`, `publishing` e
  `published`. No sucesso, a barra mostra `Publicado` e um check por 320 ms antes
  de voltar ao feed. No erro, volta a `idle` com o rascunho intacto. A
  publicação continua bloqueada contra toque duplo pelo ref existente.
- `CommentComposer` confirma o envio com um check no botão por 320 ms e mantém o
  rótulo `Comentário enviado`. Em falha, o texto permanece no campo e o botão
  volta a `Enviar comentário`.
- `Toast` usa os tokens de `Motion`, ganhou um deslocamento vertical de 6 px e
  passa a consultar `useReducedMotion`. Com movimento reduzido, entrada e saída
  duram 0 ms; o aviso continua sendo anunciado pelo leitor de tela.

## Acessibilidade e estados

- O leitor de tela recebe o rótulo do estado atual (`Solicitado, Ana`,
  `Publicado em seu perfil`, `Comentário enviado`) e `busy` quando há mutação.
- Em publicações para um único destino, o sucesso é anunciado uma vez por
  `announceForAccessibility`. Em publicações para vários destinos, o toast já
  faz o anúncio, então a tela não anuncia de novo.
- O check e o pulso são visuais; a confirmação não depende só da cor. Erro de
  rede mantém toast, rascunho e novo retry.
- O pulso usa `ReduceMotion.System`; o toast usa a preferência do sistema lida
  por `useReducedMotion`.

## Validação executada

- `npm run check:fast` (ESLint e TypeScript): passou.
- Jest focado em `--runInBand`: `toast`, `create-post-screen`,
  `comment-row`, `follow-button-feedback` e `use-action-feedback`.
- Suite Jest completa: 146 suítes / 865 testes passaram. O runner precisou de
  `--forceExit` por um alerta de timer remanescente que já existe no baseline
  desta versão do Jest/React Native.
- Playwright:
  - `mobile-ux-smoke.spec.ts` — publicar pelo composer e ver a publicação no
    feed;
  - `post-stack.spec.ts` — push/back da discussão, compositor no rodapé e
    geometria da barra.

## O que não foi validado

- Nada foi executado em aparelho iOS/Android. A física do pulso, o Reduce Motion
  nativo e o VoiceOver/TalkBack seguem pendentes de inspeção manual.
- A falha de rede foi exercitada em testes de componente com API mockada, não
  em aparelho com modo avião.
- Não foram medidos FPS, jank, memória ou tempo de percepção. As durações são
  escolhas de design, não resultados de medição.
- O Chromium não reproduz a animação nativa da pilha nem o feedback tátil.
