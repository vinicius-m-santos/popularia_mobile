# POP-32: pilha das abas e TabBar nas rotas de post

Data: 06/11/2026. Escopo: rotas de post das pilhas Início, Explorar, Perfil e
Avisos, `popToTopOnBlur` das abas e a barra inferior durante push/back. Sem
mudança de API, de deep link ou do rascunho do composer.

## Problema auditado

A análise estática do commit 12c0369 (S4 / Seção 4.2) apontou dois riscos:

1. `popToTopOnBlur: true` nas quatro abas descarta detalhes ao trocar de aba.
2. `TabBar` devolvia `null` ao entrar em `/post/[id]`, removendo a barra inteira
   no mesmo quadro em que a pilha empurra a discussão. A cena ganhava de uma vez
   a altura da barra no push e a perdia de uma vez no back.

O comportamento de pilha é intencional: cada aba tem a própria pilha e volta ao
topo quando perde o foco, preservando o cache da lista. É o mesmo contrato do
smoke de UX mobile em `docs/pop-64-mobile-ux-smoke-matrix.md` (S3). O teste
`src/components/__tests__/tabs-layout.test.tsx` agora trava essa configuração
para que uma alteração futura seja deliberada.

## Reprodução

No Chromium (390 × 844, `expo start --web`, API mockada), o push para
`/post/qa-feed-post-1` e o back foram amostrados quadro a quadro com
`requestAnimationFrame` antes da correção:

- a rota e a barra mudavam no mesmo commit: a barra de 70 px desaparecia entre
  dois quadros e a cena já aparecia na altura final;
- não houve um quadro intermediário com a barra parcialmente visível;
- não foi possível confirmar "salto perceptível" no navegador, que não reproduz
  a animação nativa da pilha. Também não havia aparelho/emulador neste ambiente.

Ou seja: **a troca instantânea de layout foi reproduzida; a percepção do salto
em iOS/Android não foi medida.** A correção abaixo elimina o corte seco de
layout sem depender dessa confirmação e não afirma ganho de fluidez.

## Implementação

`src/components/tab-bar.tsx` deixou de retornar `null` na rota de post:

- a barra continua montada, parte de uma altura determinística (52 de item +
  6 de topo + área segura inferior) e corrige a medida com `onLayout`;
- na entrada e na saída da rota, `react-native-reanimated` anima, em 220 ms, a
  altura do host, a opacidade e o `translateY` da barra;
- a cena cresce/encolhe junto com a barra, em vez de trocar de altura num único
  quadro;
- `ReduceMotion.System` respeita a preferência de movimento reduzido, caindo
  para a troca instantânea;
- enquanto está oculta, a barra fica com `pointerEvents="none"`, `aria-hidden`,
  `accessibilityElementsHidden` e `importantForAccessibility="no-hide-descendants"`,
  então não recebe toque nem aparece para tecnologias assistivas;
- a decisão de ocultar é a mesma para qualquer pilha: `isTabBarHidden` procura
  o segmento `post` em `useSegments()`.

Nenhuma rota, `unstable_settings` ou apresentação de tela foi alterada. As
pilhas independentes continuam iguais e o back continua usando a pilha da aba.

## Deep links e rascunho

- As pilhas que podem abrir post por link direto mantêm `anchor: 'index'`:
  `(tabs)/(inicio)`, `(tabs)/explorar`, `(tabs)/perfil` e `avisos`. O link
  direto para `/post/[id]` continua com uma tela de origem para o voltar.
- Sem sessão, `/post/qa-feed-post-1` cai nas boas-vindas; o caso entrou em
  `e2e/specs/session-guards.spec.ts`.
- O composer de publicação continua usando `usePreventRemove` para pedir
  confirmação antes de descartar um rascunho sujo. O teste de componente em
  `src/features/compose/__tests__/create-post-screen.test.tsx` cobre o alerta,
  a ordem dos botões e o `repeat()` somente no descarte.

## Validação executada

- `npm run check:fast` (ESLint + TypeScript).
- Jest focado:
  - `src/components/__tests__/tab-bar.test.tsx`: **16 testes**;
  - `src/components/__tests__/tabs-layout.test.tsx`: **1 teste**;
  - `src/features/compose/__tests__/create-post-screen.test.tsx`: **17 testes**.
- E2E: `e2e/specs/post-stack.spec.ts` (push/back, barra oculta, compositor,
  geometria sem salto de 70 px) e `e2e/specs/session-guards.spec.ts` (12 testes,
  incluindo o link direto de post sem sessão).
- Gravação local de push/back em Chromium 390 × 844 (webm, inspecionado quadro a
  quadro; artefato não versionado) e amostragem `requestAnimationFrame` do
  compositor e da barra.
- Suíte Jest completa: **136 suítes / 815 testes** passaram.
- `npm run test:e2e`: **42 testes passaram**, 1 `fixme` já existente em
  `session-guards.spec.ts`, em Chromium 390 × 844.

## O que não foi validado

- **Nada foi executado em aparelho iOS/Android.** O gesto nativo de voltar, a
  física do push, o comportamento do gesto de borda e o teclado não foram
  inspecionados.
- A animação é de altura/layout, não de transform puro. Não medimos FPS, jank
  nem memória em device; não há afirmação de ganho de fluidez.
- A duração de 220 ms é uma escolha de layout, não uma medida da transição
  nativa. Em aparelhos com "reduzir movimento", a troca é instantânea.
- A barra permanece montada e oculta; isso é intencional para não remontar o
  menu de criação a cada push. O custo de montagem não foi medido.

## Critérios de aceite

- [x] Troca de abas volta ao topo de forma intencional e documentada
      (`popToTopOnBlur` coberto por teste).
- [x] Push/back não corta a altura da cena num único quadro no Chromium; a
      percepção em device segue pendente de validação manual.
- [x] Deep links mantêm a âncora de volta e a guarda de sessão; rascunho do
      composer continua protegido por `usePreventRemove`.
