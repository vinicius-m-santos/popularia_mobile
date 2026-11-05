import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getPerformanceSnapshot, type PerformanceSnapshot } from '@/lib/performance';

/**
 * Lê o snapshot ao ganhar foco: a pessoa inicia a coleta, navega pelo app e vê
 * os números atualizados ao voltar. Sem timer nem polling.
 */
export function usePerformanceSnapshot() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot>(() => getPerformanceSnapshot());
  const [readAt, setReadAt] = useState(() => Date.now());
  const refresh = useCallback(() => {
    setSnapshot(getPerformanceSnapshot());
    setReadAt(Date.now());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return undefined;
    }, [refresh]),
  );

  return { snapshot, readAt, refresh };
}
