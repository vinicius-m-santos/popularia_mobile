import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Última preferência lida. O `ToastProvider` monta no topo do app e popula este
 * valor antes de foto, vídeo ou sheet abrirem; assim o primeiro `Modal` já nasce
 * sem animação, em vez de esperar a promise do hook.
 */
let cachedReducedMotion = false;

/** @internal Reinicia o cache entre testes que alternam a preferência. */
export function resetReducedMotionCache(): void {
  cachedReducedMotion = false;
}

/**
 * Preferência de movimento reduzido do sistema, para animações que usam o
 * `Animated` do React Native. As animações do Reanimated usam
 * `ReduceMotion.System` diretamente.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(cachedReducedMotion);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        cachedReducedMotion = enabled;
        if (active) setReduced(enabled);
      })
      .catch(() => { /* Módulo nativo ausente no host de teste: mantém o padrão. */ });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      cachedReducedMotion = enabled;
      if (active) setReduced(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
