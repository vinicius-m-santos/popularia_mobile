import { useCallback } from 'react';
import { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

// Mocks de teste antigos podem não exportar o enum; o valor público continua sendo "system".
const SYSTEM_REDUCE_MOTION = ReduceMotion?.System ?? ('system' as ReduceMotion);

/** Configuração explícita para o teste conseguir travar os tokens e a acessibilidade. */
export const ACTION_FEEDBACK_TIMING = {
  enter: {
    duration: Motion.duration.quick,
    easing: Motion.easing.standard,
    reduceMotion: SYSTEM_REDUCE_MOTION,
  },
  settle: {
    duration: Motion.duration.base,
    easing: Motion.easing.settle,
    reduceMotion: SYSTEM_REDUCE_MOTION,
  },
} as const;

/**
 * Confirmação curta de uma ação concluída: um pulso de escala que volta ao
 * repouso. Não é decorativo — só dispara depois que a mutação confirma, e o
 * estado acessível (rótulo, busy, disabled) continua sendo a fonte da verdade.
 */
export function useActionFeedback() {
  const scale = useSharedValue(1);

  const pulse = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- SharedValue é mutável por contrato do Reanimated.
    scale.value = withSequence(
      withTiming(Motion.scale.confirmation, ACTION_FEEDBACK_TIMING.enter),
      withTiming(1, ACTION_FEEDBACK_TIMING.settle),
    );
  }, [scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { style, pulse };
}
