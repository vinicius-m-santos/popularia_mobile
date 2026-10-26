import { useCallback, useEffect, useRef, useState } from 'react';

import { mergeById, type Page } from '@/lib/pagination';
import { ApiError, NotFoundError } from '@/lib/errors';

type State<T> = {
  /** Consulta a que estes dados pertencem (ver `useAsyncData`). */
  load: (cursor: string | null) => Promise<Page<T>>;
  status: 'loading' | 'success' | 'error';
  items: T[];
  nextCursor: string | null;
  error: Error | null;
  loadingMore: boolean;
  loadMoreError: Error | null;
  isRefreshing: boolean;
  refreshError: Error | null;
};

export type PaginatedData<T> = Omit<State<T>, 'load' | 'nextCursor'> & {
  hasMore: boolean;
  /** Carrega a página seguinte (ignorado se já estiver carregando ou se não houver mais). */
  loadMore: () => void;
  /**
   * Recarrega a partir da primeira página. Se falhar com itens na tela, eles continuam
   * e `refreshError` explica o motivo; sem itens, a lista vai para o estado de erro.
   */
  refresh: () => void;
  /** Acrescenta um item criado pela pessoa, sem duplicar se ele já tiver chegado da API. */
  append: (item: T) => void;
};

function initialState<T>(load: State<T>['load']): State<T> {
  return {
    load,
    status: 'loading',
    items: [],
    nextCursor: null,
    error: null,
    loadingMore: false,
    loadMoreError: null,
    isRefreshing: false,
    refreshError: null,
  };
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Lista com paginação por cursor: primeira página, "carregar mais", puxar para atualizar.
 *
 * `load` deve ser estável (useCallback); quando muda (outra aba, outra comuna), a lista
 * recomeça do zero e respostas atrasadas da consulta anterior são descartadas.
 */
export function usePaginatedData<T extends { id: string }>(
  load: (cursor: string | null) => Promise<Page<T>>,
): PaginatedData<T> {
  const [state, setState] = useState<State<T>>(() => initialState(load));
  // Cada carga da primeira página abre uma "geração"; respostas de gerações antigas são ignoradas.
  const generation = useRef(0);
  const loadingMore = useRef(false);

  const fetchFirstPage = useCallback(
    (mode: 'initial' | 'refresh') => {
      const current = ++generation.current;
      loadingMore.current = false;
      load(null).then(
        (page) => {
          if (current !== generation.current) return;
          setState({
            ...initialState(load),
            status: 'success',
            items: mergeById(page.items),
            nextCursor: page.nextCursor,
          });
        },
        (err: unknown) => {
          if (current !== generation.current) return;
          const error = toError(err);
          setState((prev) =>
            mode === 'refresh' && prev.load === load && prev.items.length > 0 &&
            !(error instanceof NotFoundError) && !(error instanceof ApiError && [401, 403, 404].includes(error.status))
              ? { ...prev, isRefreshing: false, refreshError: error }
              : { ...initialState(load), status: 'error', error },
          );
        },
      );
    },
    [load],
  );

  useEffect(() => {
    fetchFirstPage('initial');
    return () => { generation.current += 1; };
  }, [fetchFirstPage]);

  const sameQuery = state.load === load;

  const refresh = useCallback(() => {
    setState((prev) =>
      prev.load === load && prev.items.length > 0
        ? { ...prev, isRefreshing: true, refreshError: null }
        : initialState(load),
    );
    fetchFirstPage('refresh');
  }, [fetchFirstPage, load]);

  const loadMore = useCallback(() => {
    if (!sameQuery || state.status !== 'success' || !state.nextCursor || loadingMore.current) return;
    loadingMore.current = true;
    const current = generation.current;
    setState((prev) => ({ ...prev, loadingMore: true, loadMoreError: null }));
    load(state.nextCursor).then(
      (page) => {
        if (current !== generation.current) return;
        loadingMore.current = false;
        setState((prev) => ({
          ...prev,
          items: mergeById(prev.items, page.items),
          nextCursor: page.nextCursor,
          loadingMore: false,
        }));
      },
      (err: unknown) => {
        if (current !== generation.current) return;
        loadingMore.current = false;
        setState((prev) => ({ ...prev, loadingMore: false, loadMoreError: toError(err) }));
      },
    );
  }, [load, sameQuery, state.status, state.nextCursor]);

  const append = useCallback(
    (item: T) => setState((prev) => (prev.load === load ? { ...prev, items: mergeById(prev.items, [item]) } : prev)),
    [load],
  );

  const view = sameQuery ? state : initialState(load);
  return {
    status: view.status,
    items: view.items,
    error: view.error,
    loadingMore: view.loadingMore,
    loadMoreError: view.loadMoreError,
    isRefreshing: view.isRefreshing,
    refreshError: view.refreshError,
    hasMore: view.nextCursor !== null,
    loadMore,
    refresh,
    append,
  };
}
