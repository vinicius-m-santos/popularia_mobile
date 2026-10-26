import { useCallback, useEffect, useState } from 'react';

import { ApiError, NotFoundError } from '@/lib/errors';

type Settled<T> = {
  load: () => Promise<T>;
  attempt: number;
  data: T | null;
  error: Error | null;
};

export type AsyncData<T> = {
  status: 'loading' | 'success' | 'error';
  data: T | null;
  error: Error | null;
  /** Recarregando a mesma consulta (puxar para atualizar): os dados anteriores continuam válidos. */
  isRefreshing: boolean;
  reload: () => void;
};

/**
 * Carrega dados assíncronos com estados explícitos de carregamento, sucesso e erro.
 *
 * `load` deve ser estável (useCallback); quando muda (por exemplo, outra aba),
 * os dados antigos não são exibidos como se fossem da nova consulta.
 */
export function useAsyncData<T>(load: () => Promise<T>): AsyncData<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setSettled({ load, attempt, data, error: null });
      },
      (err: unknown) => {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        // Recusas de acesso não podem conservar conteúdo privado em cache na tela.
        const keepData = !(error instanceof NotFoundError) &&
          !(error instanceof ApiError && [401, 403, 404].includes(error.status));
        setSettled((previous) => ({
          load, attempt, error,
          data: keepData && previous?.load === load ? previous.data : null,
        }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const sameQuery = settled?.load === load;
  const current = sameQuery && settled.attempt === attempt;

  if (!current) {
    return {
      status: 'loading',
      data: sameQuery ? settled.data : null,
      error: null,
      isRefreshing: sameQuery && settled.data !== null,
      reload,
    };
  }

  return settled.error
    ? { status: 'error', data: settled.data, error: settled.error, isRefreshing: false, reload }
    : { status: 'success', data: settled.data, error: null, isRefreshing: false, reload };
}
