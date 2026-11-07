# POP-49: tokens de motion e feedback de toque

Escopo: centralizar durações, easings, molas e o feedback pressed das ações
comuns, sem nova dependência e sem mudança de contrato de API.

## O que mudou

- `constants/motion.ts` passa a ser a fonte única dos tokens: `duration`
  (`fast` 140 ms, `normal` 180 ms, `confirmation` 320 ms), `easing`
  (`standard`/`settle`), `spring` (`press`/`settle`) e `feedback`
  (`pressed`, `subtle`, `confirmationScale`).
- `constants/theme.ts` deixa de duplicar `Motion`; os consumidores existentes
  (`toast`, composer de comentário, publicação e confirmação de ações) importam
  o arquivo novo.
- `hooks/use-press-feedback.ts` concentra o toque: opacidade e escala curtas na
  ida, mola sem ultrapassagem na volta. Os valores ficam em `SharedValues`, então
  pressionar uma ação não re-renderiza a lista ou a tela que a contém.
- `components/animated-pressable.ts` aplica o estilo animado no próprio
  `Pressable`, preservando área de toque, layout flex e `onPress`.
- `EditorialAction`, `IconButton`, `PillButton`, as abas, o botão Criar e os
  itens do menu de criação usam o helper. O feedback padrão é o mesmo; itens de
  menu usam a variante `subtle`.

## Acessibilidade e reduzir movimento

- O pressed é apenas feedback visual: rótulo, `busy`, `disabled` e `selected`
  continuam sendo anunciados e são a fonte da verdade do estado.
- Todas as animações do helper usam `ReduceMotion.System`. Com movimento
  reduzido, o Reanimated aplica o valor final sem animar; a opacidade continua
  indicando o toque e o tap permanece inalterado.
- Não há loop, animação contínua ou movimento decorativo. O pulso de
  confirmação só dispara depois da ação concluída.

## Validação executada

- `npm run check:fast` (ESLint e TypeScript): passou.
- Jest focado em `--runInBand`: 6 suites / 34 testes passaram
  (`use-press-feedback`, `use-action-feedback`, `motion`, `action-feedback`,
  `tab-bar` e `profile-screen`).
- Suíte Jest completa em `--runInBand`: 151 suites / 894 testes passaram. Foi
  preciso `--forceExit` por operações assíncronas remanescentes que já existem no
  baseline desta versão do Jest/React Native.
- Playwright focado em `e2e/specs/profile-scroll.spec.ts`: 2 testes passaram,
  cobrindo troca de abas inferiores, ida e volta de uma publicação e retenção de
  rolagem. Nenhuma rota nova foi criada.
- O teste do helper verifica os tokens, `reduceMotion: 'system'`, a ausência de
  re-render no press e a preservação do `onPress`.
- O teste de componentes cobre `EditorialAction`, `IconButton` e `PillButton`,
  incluindo os estados indisponível e ocupado.

## O que não foi validado

- Nada foi executado em aparelho iOS/Android. A física da mola, o Reduce Motion
  nativo e o VoiceOver/TalkBack seguem pendentes de inspeção manual.
- O Playwright não reproduz a animação nativa do Reanimated nem a preferência de
  movimento reduzido do aparelho.
- Não foram medidos FPS, jank, memória ou tempo de percepção. As durações e a
  mola são escolhas de design, não resultados de medição.
