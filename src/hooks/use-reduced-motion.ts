import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Preferência de movimento reduzido do sistema, para animações que usam o
 * `Animated` do React Native. As animações do Reanimated usam
 * `ReduceMotion.System` diretamente.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (active) setReduced(enabled); })
      .catch(() => { /* Módulo nativo ausente no host de teste: mantém o padrão. */ });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (active) setReduced(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
