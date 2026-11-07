# POP-55: motion de indicadores e expansão de respostas

Data: 07/11/2026. Escopo: microanimação de seleção de abas e da expansão de
respostas. Sem rota nova, sem dependência nova e sem mudança de contrato de API.

## O que mudou

- `components/underline-tabs.tsx`: o indicador vermelho deixou de aparecer e
  desaparecer no mesmo quadro. Cada aba mantém um `SharedValue` próprio; ao
  virar ativa, o sublinhado cresce da esquerda (`scaleX` 0 → 1) e aparece
  (`opacity` 0 → 1). Ao sair, recolhe e some. A transição usa
  `Motion.duration.normal` e `Motion.easing.standard`, os mesmos tokens da casa.
- O indicador anima apenas `opacity` e `transform`. A barra de abas é uma célula
  reciclada da FlashList no perfil; animar altura, largura ou posição de layout
  deslocaria o conteúdo e poderia perder a posição de scroll. O primeiro render
  não anima, então montar a barra no meio da lista não dispara uma cascata.
- `features/discussion/reply-expansion-motion.ts`: a troca “Ver N respostas” ↔
  “Ocultar” agenda um `LayoutAnimation` curto para o próximo commit. O Fabric
  exige `property` nos configs de criação/remoção; usamos opacidade com duração
  0 nesses dois canais, então a linha entra/sai opaca e só a posição/altura das
  linhas vizinhas anima. Não há fade de texto nem `entering`/`exiting` em cada
  linha da lista reciclada.
- `features/discussion/discussion-screen.tsx`: o handler de colapso consulta a
  árvore atual em um ref estável e decide, antes de trocar o estado, se a
  expansão cabe no orçamento de animação. Assim o `CommentRow` continua com o
  mesmo `onToggleCollapse` e o comparador de memo não é quebrado.
- `features/profiles/profile-screen.tsx` e `profile-tabs-overlay.tsx`: a
  espessura do indicador das abas inline e do overlay fixo passa a vir de
  `PROFILE_TABS_UNDERLINE_HEIGHT`, para as duas barras não divergirem.

## Limites e fallback

A animação de layout é limitada de propósito:

| Limite | Valor | Motivo |
| --- | --- | --- |
| Respostas em uma expansão | 12 | Uma abertura maior deixa de ser legível como transição e mexe em muitas células |
| Linhas totais da discussão | 120 | Acima disso a lista é tratada como longa e a troca é instantânea |
| Escala de fonte | 1.3 | Com fonte ampliada a expansão fica alta demais; a troca vira instantânea |
| Movimento reduzido | sempre desliga | `ReduceMotion.System` nas abas e fallback sem animação na expansão |

Esses valores são escolhas de design e limites conservadores, **não** medições
de FPS, jank ou memória. A discussão mantém
`maintainVisibleContentPosition={{ minIndexForVisible: 0 }}` e a memória de
scroll por âncora; o botão de colapso só é alcançável quando a linha está
visível, então a inserção/remoção acontece na própria janela de leitura.

## Acessibilidade e estados

- O indicador é reforço visual: `accessibilityState.selected`, o rótulo e a
  ordem das abas continuam sendo a fonte da verdade.
- O `CollapseButton` continua anunciando `expanded` e o texto “Ver N respostas”
  / “Ocultar” antes e depois da animação.
- Com Reduce Motion, as abas aplicam o valor final sem animar e a expansão troca
  instantaneamente. A leitura nunca depende do término da animação.
- O texto das respostas não recebe fade de opacidade, preservando a legibilidade
  durante toda a expansão.

## Validação executada

- `npm run typecheck` (com heap de 1024): passou.
- `npm run lint`: passou.
- Jest focado em `--runInBand`: `underline-tabs`, `reply-expansion-motion` e
  `discussion-screen` — 3 suítes / 14 testes passaram.
- Suíte Jest completa, `--ci --maxWorkers=2 --forceExit`: **156 suítes / 926
  testes passaram**.
- Os testes cobrem: seleção e toque nas abas, tokens/`reduceMotion: 'system'`,
  decisão de animar ou não por tamanho, fonte ampliada e movimento reduzido,
  configuração sem fade de texto, e a chamada real de
  `LayoutAnimation.configureNext` no colapso/expansão da discussão.
- Playwright focado, com Metro isolado na porta 8099:
  - `e2e/specs/profile-scroll.spec.ts`: **2 testes passaram**, cobrindo volta de
    publicação, troca de aba inferior e alternância determinística entre as abas
    internas do perfil com retenção de rolagem;
  - `e2e/specs/post-stack.spec.ts`: **1 teste passou**, confirmando a discussão
    com o compositor no rodapé e a barra inferior fora do caminho. Nenhuma rota
    nova foi criada.

## O que não foi validado

- Nada foi executado em aparelho iOS/Android. A percepção do sublinhado, a
  animação nativa de layout, o Reduce Motion do sistema e o comportamento com
  fonte grande seguem pendentes de inspeção manual no roteiro do ticket:
  respostas extensas, troca rápida de abas e fonte ampliada.
- Não foram medidos FPS, jank, memória ou tempo de percepção. Os limites de 12
  respostas, 120 linhas e escala de fonte 1.3 são um orçamento declarado, não um
  resultado medido.
- O Chromium não reproduz a animação de layout nativa do React Native; na web a
  expansão cai no fallback instantâneo.
- Não houve mudança de rota, autenticação, onboarding ou formulário. A suíte
  E2E existente de abas e retenção de scroll do perfil foi executada e não
  precisou ser ampliada; ela não reproduz a animação nativa de layout.
