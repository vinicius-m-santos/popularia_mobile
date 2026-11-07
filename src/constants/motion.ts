import { Easing } from 'react-native';

/**
 * Unidade de movimento da casa: curta, sem loop e sempre ligada a uma mudança de
 * estado. Não use estes tokens para animação decorativa contínua.
 *
 * As animações do Reanimated devem receber `ReduceMotion.System` (ver
 * `usePressFeedback`), e as do `Animated` devem consultar `useReducedMotion`.
 */
export const Motion = {
  duration: {
    /** Microtransições de toque, como o início de um pressed. */
    fast: 140,
    /** Ida e volta de uma mudança de estado. */
    normal: 180,
    /** Tempo em que o estado confirmado permanece legível antes de navegar. */
    confirmation: 320,
  },
  easing: {
    standard: Easing.out(Easing.cubic),
    settle: Easing.inOut(Easing.quad),
  },
  spring: {
    /** Assentamento de um toque solto, sem ultrapassar o repouso. */
    press: {
      damping: 22,
      stiffness: 320,
      mass: 0.7,
      overshootClamping: true,
    },
    /** Retorno mais macio para gestos e confirmações. */
    settle: {
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      overshootClamping: true,
    },
    /** Mola curta do pulso de reação; a volta usa a mesma configuração. */
    reaction: {
      damping: 13,
      stiffness: 420,
      mass: 0.5,
    },
  },
  scale: {
    /** Pulso local de apoio, eco e salvar: só o ícone/contador reage. */
    reaction: 1.14,
  },
  feedback: {
    /** Feedback padrão de um controle pressionado, como botões e abas. */
    pressed: {
      opacity: 0.7,
      scale: 0.985,
    },
    /** Versão discreta para superfícies grandes, como itens de menu. */
    subtle: {
      opacity: 0.92,
      scale: 0.99,
    },
    /** Escala do pulso curto de confirmação de uma ação concluída. */
    confirmationScale: 1.03,
  },
} as const;

export type MotionTokens = typeof Motion;
