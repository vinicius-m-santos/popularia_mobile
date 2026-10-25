import { useCallback, useEffect, useState } from 'react';

type AsyncState<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: Error };

/**
 * Carrega dados assíncronos com estados explícitos de carregamento, sucesso e erro.
 * Mantém os dados anteriores durante o recarregamento (puxar para atualizar).
 */
export function useAsyncData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ status: 'success', data, error: null });
      },
      (err: unknown) => {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setState((prev) => ({ status: 'error', data: prev.data, error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const reload = useCallback(() => {
    setState((prev) => ({ status: 'loading', data: prev.data, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
