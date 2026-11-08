# POP-56 — auditoria de Reduce Motion, pressed e acessibilidade

Data: 08/11/2026. Base: `b27ac99` (main após POP-27/POP-55).
Método: inspeção estática dos fluxos citados no ticket, complementada por
testes focados de componente. Nenhum aparelho iOS/Android foi usado nesta
sessão; a matriz de dispositivo no fim continua pendente.

## Escopo auditado

- `src/features/posts/components/photo-viewer.tsx`
- `src/features/profiles/profile-tab-swipe.tsx`
- `src/features/profiles/profile-screen.tsx`
- `src/components/toast.tsx`
- componentes compartilhados de ação, sheet, abas, tabs e estados
- animações automáticas adjacentes encontradas na varredura (`video-viewer`,
  `welcome-banner`, `login-welcome-screen`, `profile-tabs-overlay`)

## Achados e decisões

| # | Achado | Onde | Decisão |
| --- | --- | --- | --- |
| 1 | O `Modal` da foto usava `animationType="fade"` e a imagem tinha cross-dissolve de 160 ms mesmo com Reduce Motion. | `photo-viewer.tsx`, `use-reduced-motion.ts` | O fade do modal e a transição do `expo-image` agora são desligados quando `useReducedMotion()` está ativo. O hook guarda a última leitura para o primeiro render de um visualizador montado no toque já nascer correto. O gesto preso ao dedo continua igual. |
| 2 | O arrasto de descarte do vídeo voltava com `withTiming` sem `reduceMotion`; o modal também tinha fade fixo. | `video-viewer.tsx` | Retorno com `ReduceMotion.System` e modal sem fade quando o sistema pede movimento reduzido. |
| 3 | O assentamento do swipe de abas usava `withTiming` sem preferência de movimento. | `profile-tab-swipe.tsx` | `PROFILE_SWIPE_RETURN_TIMING`/`CANCEL_TIMING` com `ReduceMotion.System`. O conteúdo continua acompanhando o dedo em tempo real. |
| 4 | O overlay fixo do perfil animava posição e opacidade sem consultar Reduce Motion. | `profile-tabs-overlay.tsx` | As quatro transições usam `PROFILE_TABS_OVERLAY_TIMING` com `ReduceMotion.System`. |
| 5 | O card de boas-vindas recolhia em 200 ms mesmo com movimento reduzido. | `welcome-banner.tsx` | Fechamento com duração 0 quando a preferência está ativa; o card ainda some e o estado é confirmado. |
| 6 | O login só respeitava Reduce Motion nas entradas do Reanimated; a linha do tempo do `Animated` (mensagens, pôster e ilustração) seguia animando. | `login-welcome-screen.tsx` | As durações da linha do tempo viram 0 sob Reduce Motion. A permanência e a ordem das mensagens continuam, sem removê-las. |
| 7 | A sheet não delimitava o foco do modal nem oferecia gesto assistivo de escape; a animação do Gorhom não consultava a preferência. | `bottom-sheet.tsx` | `accessibilityViewIsModal`, `onAccessibilityEscape` e `animationConfigs={{ duration: 0 }}` com movimento reduzido. O botão/backdrop e o back do Android continuam fechando. |
| 8 | Opacidades de pressed variavam entre 0,6 e 0,92 nos componentes compartilhados, sem uma fonte única. | `components/*`, `profile-photo`, `profile-media-grid`, `person-row` | O feedback padrão usa `Motion.feedback.pressed.opacity`; superfícies grandes usam `Motion.feedback.subtle.opacity`. |
| 9 | Em botões vermelhos, reduzir a opacidade do controle inteiro derrubava `paper` sobre `red` de 4,72:1 para 3,19:1. | `pill-button`, `editorial-action`, `join-button`, `mini-join`, `call-schedule-picker` | O pressed troca a superfície para `Colors.redPressed` e mantém o rótulo opaco: 7,09:1. `PressedColors` centraliza os pares. |
| 10 | A imagem da foto em tela cheia não tinha role explícito e o modal não delimitava o foco do leitor de tela. | `photo-viewer.tsx` | Imagem com `accessibilityRole="image"` e rótulo; root com `accessibilityViewIsModal` e `onAccessibilityEscape`; botão “Fechar foto” com hint. O botão continua sendo a saída garantida. |
| 11 | Rótulos das abas podiam quebrar linha dentro da barra fixa de 44 px e o “Participar” tinha altura fixa de 38, que corta a fonte ampliada. | `underline-tabs.tsx`, `join-button.tsx` | Rótulo de aba em uma linha (a barra rola) e `height` do “Participar” virou piso (`minHeight`): o botão cresce com o texto em vez de cortá-lo. |
| 12 | O toast já anunciava por `AccessibilityInfo` e usava `useReducedMotion`. | `toast.tsx` | Sem mudança de contrato. O aviso continua escondido da árvore (para não duplicar) e é anunciado uma vez. |

## Contraste medido (calculado dos tokens)

Valores WCAG 2.x calculados a partir das cores do tema, não medidos em tela:

| Par | Razão |
| --- | --- |
| `paper` / `red` (repouso) | 4,72:1 |
| `paper` / `redPressed` (pressed) | 7,09:1 |
| `ink` / `paper` | 17,43:1 |
| `ink` / `strawLight` (pressed de papel) | 14,37:1 |
| `cream` / `ink` | 15,87:1 |
| `cream` / `inkSoft` (pressed de tinta) | 10,22:1 |
| `ink` com opacidade 0,7 sobre `cream` | 6,46:1 |
| `cream` / `red` | 4,30:1 (não usar para texto pequeno) |

O teste `src/constants/__tests__/contrast.test.ts` trava esses pares e documenta
por que o botão vermelho não usa `cream` no rótulo.

## Validação executada nesta sessão

- `npm run check:fast` com heap de 1024: passou (ESLint + TypeScript). Com 512 o
  TypeScript estourou o heap (mesmo comportamento já registrado nas tarefas
  anteriores); o lint passou com 512.
- Jest focado em `--runInBand`: 13 suítes / 76 testes passaram, cobrindo
  contraste dos tokens, `usePressFeedback`, `useReducedMotion`, ações, sheet,
  abas, overlay, swipe do perfil, `photo-viewer`, `video-viewer`,
  `welcome-banner`, toast e a tela de perfil.
- Suíte Jest completa (`--ci --maxWorkers=2 --forceExit`): **158 suítes / 943
  testes passaram**. O `--forceExit` é necessário por operações assíncronas
  remanescentes já presentes no baseline.
- Playwright focado em `e2e/specs/profile-scroll.spec.ts`: **2 testes passaram**
  no Chromium, cobrindo volta de publicação, troca de aba inferior e alternância
  determinística entre as abas internas do perfil. Nenhuma rota nova foi criada;
  o E2E não reproduz animação nativa, Reduce Motion do aparelho nem leitor de
  tela.

## O que continua fora desta entrega

- Vários `Pressable` de telas de feature (compose, onboarding, praças,
  moderação, biblioteca) ainda declaram opacidades de pressed locais. A
  auditoria priorizou os componentes compartilhados e os fluxos citados no
  ticket; a migração mecânica dos demais não foi feita para não misturar uma
  mudança visual ampla com esta correção.
- Os modais nativos de `date-picker-field` (slide no iOS), `call-schedule-picker`
  e `ReactionPicker` continuam com o `animationType` nativo. Eles não foram
  alterados nesta sessão; o `BottomSheet` compartilhado, a foto e o vídeo foram.
- Não há medição de FPS, jank, memória ou tempo de percepção. As durações são
  escolhas de design.

## Matriz de aparelho pendente

VoiceOver (iOS) e TalkBack (Android), com Reduce Motion ligado e fonte ampliada:

1. Foto: abrir/fechar, ouvir a imagem e o botão “Fechar foto”, usar escape
   assistivo e confirmar que o feed não recebe foco por baixo.
2. Vídeo: abrir/fechar, ouvir play/pause/som, arrastar para baixo e conferir que
   o retorno não anima com Reduce Motion.
3. Perfil: alternar abas por toque e swipe, confirmar que o overlay recolhido
   não recebe foco e que os rótulos não cortam com fonte grande.
4. Sheet: abrir, conferir foco no título, fechar por escape/backdrop/back e
   confirmar que o conteúdo de trás não é alcançado.
5. Toast: ouvir o anúncio uma única vez e conferir que ele não duplica o foco.
6. Botões: confirmar que o pressed muda a superfície vermelha sem apagar o
   rótulo e que o contraste percebido continua legível.

Sem essa execução, a entrega não declara validação em aparelho.
