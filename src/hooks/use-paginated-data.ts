import { useCallback, useEffect, useRef, useState } from 'react';

import { mergeById, reconcileRefreshedPages, type Page, type RefreshedPages } from '@/lib/pagination';
import { ApiError, NotFoundError } from '@/lib/errors';

type State<T> = {
  /** Consulta a que estes dados pertencem (ver `useAsyncData`). */
  load: (cursor: string | null) => Promise<Page<T>>;
  status: 'loading' | 'success' | 'error';
  items: T[];
  /**
   * Páginas na ordem em que foram carregadas. `items` é a visão deduplicada e
   * achatada; as páginas guardam os cursores que a revalidação precisa para
   * reencontrar o histórico sem descartar páginas já carregadas.
   */
  pages: Page<T>[];
  nextCursor: string | null;
  error: Error | null;
  loadingMore: boolean;
  loadMoreError: Error | null;
  isRefreshing: boolean;
  refreshError: Error | null;
};

export type PaginatedData<T> = Omit<State<T>, 'load' | 'nextCursor' | 'pages'> & {
  hasMore: boolean;
  /** Carrega a página seguinte (ignorado se já estiver carregando ou se não houver mais). */
  loadMore: () => void;
  /**
   * Recarrega a partir da primeira página. Se falhar com itens na tela, eles continuam
   * e `refreshError` explica o motivo; sem itens, a lista vai para o estado de erro.
   */
  refresh: () => void;
  /** Atualiza em segundo plano sem acionar loader nem alterar o offset da lista. */
  revalidate: () => void;
  /** Acrescenta um item criado pela pessoa, sem duplicar se ele já tiver chegado da API. */
  append: (item: T) => void;
  /** Remove um item localmente depois de uma exclusão confirmada. */
  remove: (id: string) => void;
  /** Atualiza um item já carregado sem refazer a página. */
  update: (id: string, change: (item: T) => T) => void;
};

function initialState<T>(load: State<T>['load']): State<T> {
  return {
    load,
    status: 'loading',
    items: [],
    pages: [],
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

/** Mantém as páginas alinhadas com `append`/`remove`/`update` sem perder os cursores. */
function appendPage<T extends { id: string }>(pages: Page<T>[], item: T): Page<T>[] {
  if (pages.some((page) => page.items.some((entry) => entry.id === item.id))) return pages;
  if (pages.length === 0) return [{ items: [item], nextCursor: null }];
  return pages.map((page, index) =>
    index === pages.length - 1 ? { ...page, items: [...page.items, item] } : page,
  );
}

function removeFromPages<T extends { id: string }>(pages: Page<T>[], id: string): Page<T>[] {
  let changed = false;
  const next = pages.map((page) => {
    const items = page.items.filter((item) => item.id !== id);
    if (items.length === page.items.length) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? next : pages;
}

function updateInPages<T extends { id: string }>(pages: Page<T>[], id: string, change: (item: T) => T): Page<T>[] {
  let changed = false;
  const next = pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (item.id !== id) return item;
      const updated = change(item);
      if (updated !== item) pageChanged = true;
      return updated;
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? next : pages;
}

function flattenPages<T extends { id: string }>(pages: Page<T>[]): T[] {
  return mergeById(...pages.map((page) => page.items));
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
  // Revalidação silenciosa não compete com a paginação: o cursor preservado só pode
  // ser retomado depois que a revalidação terminar de soldar o prefixo novo no histórico.
  const revalidating = useRef(false);
  // Uma revalidação antiga não pode liberar a trava de uma revalidação nova.
  const revalidateToken = useRef(0);

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
            pages: [page],
            nextCursor: page.nextCursor,
          });
        },
        (err: unknown) => {
          if (current !== generation.current) return;
          const error = toError(err);
          setState((prev) =>
            mode !== 'initial' && prev.load === load && prev.status === 'success' &&
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
    return () => {
      generation.current += 1;
      loadingMore.current = false;
      revalidateToken.current += 1;
      revalidating.current = false;
    };
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

  const revalidate = useCallback(() => {
    if (!sameQuery || state.status !== 'success' || revalidating.current) return;
    const current = ++generation.current;
    const token = ++revalidateToken.current;
    // Um loadMore em voo pertence à geração anterior; o cursor abaixo vale para o
    // histórico já carregado, então a paginação espera a revalidação terminar.
    loadingMore.current = false;
    revalidating.current = true;
    const cachedPages = state.pages;
    setState((prev) => prev.load === load && prev.status === 'success'
      ? { ...prev, refreshError: null, loadingMore: false }
      : prev);

    void (async () => {
      try {
        const refreshedPages: Page<T>[] = [await load(null)];
        if (current !== generation.current) return;

        const requestedCursors = new Set<string>();
        let result: RefreshedPages<T> = reconcileRefreshedPages(cachedPages, refreshedPages);
        while (result.action === 'fetch') {
          // O mesmo limite do refresh de `useCachedPages`: nunca buscar mais páginas
          // do que o cache já tinha; sem reencontrar o histórico, substitui o prefixo.
          if (refreshedPages.length >= cachedPages.length || requestedCursors.has(result.cursor)) {
            result = { action: 'replace', pages: refreshedPages };
            break;
          }
          requestedCursors.add(result.cursor);
          const nextPage = await load(result.cursor);
          if (current !== generation.current) return;
          refreshedPages.push(nextPage);
          result = reconcileRefreshedPages(cachedPages, refreshedPages);
        }
        if (current !== generation.current) return;

        const pages = result.pages;
        setState((prev) => {
          if (prev.load !== load) return prev;
          // Um append/remove/update local durante a revalidação tem prioridade:
          // aplicar o resultado antigo ressuscitaria um item removido ou perderia
          // o comentário/coleção criado enquanto a primeira página viajava.
          if (prev.pages !== cachedPages) return { ...prev, isRefreshing: false, refreshError: null };
          return {
            ...prev,
            status: 'success',
            items: flattenPages(pages),
            pages,
            nextCursor: pages.length > 0 ? pages[pages.length - 1].nextCursor : null,
            error: null,
            loadingMore: false,
            loadMoreError: null,
            isRefreshing: false,
            refreshError: null,
          };
        });
      } catch (err) {
        if (current !== generation.current) return;
        const error = toError(err);
        setState((prev) => {
          if (prev.load !== load) return prev;
          // Acesso revogado não pode continuar em tela: mesma limpeza do refresh
          // e do QueryCache, para o conteúdo privado não ressuscitar ao remontar.
          if (error instanceof NotFoundError || (error instanceof ApiError && [401, 403, 404].includes(error.status))) {
            return { ...initialState(load), status: 'error', error };
          }
          // Revalidação silenciosa: com conteúdo na tela, falha não vira erro nem loader.
          return { ...prev, isRefreshing: false, refreshError: null, loadingMore: false };
        });
      } finally {
        // Mesmo quando a geração mudou (refresh, troca de consulta ou unmount), a
        // trava precisa ser liberada para a próxima revalidação desta instância.
        // O token evita que uma resposta antiga libere uma revalidação mais nova.
        if (revalidateToken.current === token) revalidating.current = false;
      }
    })();
  }, [load, sameQuery, state.pages, state.status]);

  const loadMore = useCallback(() => {
    if (!sameQuery || state.status !== 'success' || !state.nextCursor || loadingMore.current || revalidating.current) return;
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
          pages: prev.pages.length > 0 ? [...prev.pages, page] : [page],
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
    (item: T) => setState((prev) => (prev.load === load
      ? { ...prev, items: mergeById(prev.items, [item]), pages: appendPage(prev.pages, item) }
      : prev)),
    [load],
  );

  const remove = useCallback(
    (id: string) => setState((prev) => (prev.load === load
      ? { ...prev, items: prev.items.filter((item) => item.id !== id), pages: removeFromPages(prev.pages, id) }
      : prev)),
    [load],
  );

  const update = useCallback(
    (id: string, change: (item: T) => T) => setState((prev) => (prev.load === load
      ? { ...prev, items: prev.items.map((item) => item.id === id ? change(item) : item), pages: updateInPages(prev.pages, id, change) }
      : prev)),
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
    revalidate,
    append,
    remove,
    update,
  };
}
