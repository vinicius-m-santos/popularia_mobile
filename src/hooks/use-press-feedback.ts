import { useCallback, useMemo } from 'react';
import { ReduceMotion, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/motion';

// Mocks de teste antigos podem não exportar o enum; o valor público continua sendo "system".
const SYSTEM_REDUCE_MOTION = ReduceMotion?.System ?? ('system' as ReduceMotion);

/** Configuração explícita para o teste conseguir travar os tokens e a acessibilidade. */
export const PRESS_FEEDBACK_TIMING = {
  duration: Motion.duration.fast,
  easing: Motion.easing.standard,
  reduceMotion: SYSTEM_REDUCE_MOTION,
} as const;

export const PRESS_FEEDBACK_SPRING = {
  ...Motion.spring.press,
  reduceMotion: SYSTEM_REDUCE_MOTION,
} as const;

type PressFeedbackOptions = {
  /** Opacidade no estado pressionado; 1 desliga apenas esse canal. */
  opacity?: number;
  /** Escala no estado pressionado; 1 deixa o feedback só na opacidade. */
  scale?: number;
  /**
   * Fundo de repouso. Quando informado junto de `pressedBackgroundColor`, o
   * feedback troca a superfície em vez de apagar o controle inteiro. É o
   * caminho para texto claro sobre vermelho/tinta não perder contraste.
   */
  backgroundColor?: string;
  /** Fundo do estado pressionado, usado em conjunto com `backgroundColor`. */
  pressedBackgroundColor?: string;
};

/**
 * Feedback de toque para ações comuns: um pressed curto na ida e uma mola sem
 * ultrapassagem na volta. Os valores vivem em SharedValues, então pressionar um
 * botão não re-renderiza a tela que o contém.
 *
 * `ReduceMotion.System` cobre o fallback: com movimento reduzido, o Reanimated
 * aplica o valor final sem animar e a opacidade continua indicando o toque.
 */
export function usePressFeedback({
  opacity = Motion.feedback.pressed.opacity,
  scale = Motion.feedback.pressed.scale,
  backgroundColor,
  pressedBackgroundColor,
}: PressFeedbackOptions = {}) {
  const pressed = useSharedValue(0);
  const surfaceColors = useMemo(
    () => (backgroundColor && pressedBackgroundColor ? [backgroundColor, pressedBackgroundColor] as const : null),
    [backgroundColor, pressedBackgroundColor],
  );

  const onPressIn = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- SharedValue é mutável por contrato do Reanimated.
    pressed.value = withTiming(1, PRESS_FEEDBACK_TIMING);
  }, [pressed]);

  const onPressOut = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- SharedValue é mutável por contrato do Reanimated.
    pressed.value = withSpring(0, PRESS_FEEDBACK_SPRING);
  }, [pressed]);

  const style = useAnimatedStyle(() => ({
    // A troca de superfície mantém o texto opaco; o alpha só é usado quando não
    // há um par de cores que preserve o contraste.
    opacity: surfaceColors ? 1 : 1 - pressed.value * (1 - opacity),
    transform: [{ scale: 1 - pressed.value * (1 - scale) }],
    ...(surfaceColors
      ? { backgroundColor: interpolateColor(pressed.value, [0, 1], surfaceColors) }
      : null),
  }), [opacity, pressed, scale, surfaceColors]);

  return { style, onPressIn, onPressOut };
}
