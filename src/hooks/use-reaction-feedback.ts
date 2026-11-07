import { useEffect, useRef } from 'react';
import { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

// Mocks de teste antigos podem não exportar o enum; o valor público continua sendo "system".
const SYSTEM_REDUCE_MOTION = ReduceMotion?.System ?? ('system' as ReduceMotion);

/** Configuração explícita para o teste conseguir travar os tokens e a acessibilidade. */
export const REACTION_FEEDBACK_SPRING = {
  ...Motion.spring.reaction,
  reduceMotion: SYSTEM_REDUCE_MOTION,
} as const;

/**
 * Pulso curto preso à mudança de estado de uma ação local (apoio, eco ou salvar).
 *
 * O sinal só muda depois que a store otimista escreveu, então o pulso acompanha
 * a mesma troca de render que atualiza ícone/cor/contador. Quando a requisição
 * falha e o rollback devolve o valor anterior, o sinal muda de novo e o item
 * pulsa na volta. Cada instância observa apenas o próprio sinal: os outros
 * cartões e ações não animam.
 *
 * O `useEffect` roda depois do commit; a mola em si é aplicada na UI thread. No
 * primeiro render não há pulso, para uma lista recém-montada não animar em cascata.
 */
export function useReactionFeedback(signal: string | number | boolean) {
  const scale = useSharedValue(1);
  const previous = useRef(signal);

  useEffect(() => {
    if (previous.current === signal) return;
    previous.current = signal;
    scale.value = withSequence(
      withSpring(Motion.scale.reaction, REACTION_FEEDBACK_SPRING),
      withSpring(1, REACTION_FEEDBACK_SPRING),
    );
  }, [signal, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}
