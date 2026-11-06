import { useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runWithPerformanceScope } from '@/lib/performance';
import { accessDenied, queryClient } from '@/lib/query/client';
import { mergeById, reconcileRefreshedPages, type Page } from '@/lib/pagination';

type PagesData<T> = InfiniteData<Page<T>, string | null>;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Adaptador pequeno para listas paginadas; o cache e a concorrência pertencem ao Query. */
export function useCachedPages<T extends { id: string }>({ queryKey, load, staleTime, gcTime, enabled = true, retry, performanceScope }: {
  queryKey: QueryKey; load: (cursor: string | null, signal: AbortSignal) => Promise<Page<T>>;
  staleTime: number; gcTime: number; enabled?: boolean;
  /** Quando definido, sobrepõe a política de retry do QueryClient (ex.: erro mostrado na hora). */
  retry?: boolean;
  /** Nome da tela para atribuir requests na instrumentação local (POP-5). */
  performanceScope?: string;
}) {
  const pendingAction = useRef<'refresh' | 'pagination' | null>(null);
  const trackedLoad = useCallback((cursor: string | null, signal: AbortSignal) => {
    const action = pendingAction.current ?? (cursor ? 'pagination' : 'initial');
    pendingAction.current = null;
    // O escopo é lido de forma síncrona no começo de cada request; respostas que
    // chegam depois de uma navegação não são atribuídas à tela errada.
    return runWithPerformanceScope({ screen: performanceScope ?? 'unknown', action }, () => load(cursor, signal));
  }, [load, performanceScope]);
  const query = useInfiniteQuery({ queryKey, initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => trackedLoad(pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime, gcTime, enabled,
    ...(retry !== undefined ? { retry } : {}),
  }, queryClient);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const key = JSON.stringify(queryKey);
  const pending = useRef(false);
  // Cada refresh/loadMore recebe uma geração. Assim o finally de uma operação
  // antiga (ou de outra aba) não libera a concorrência da operação atual.
  const operation = useRef(0);
  const refreshController = useRef<AbortController | null>(null);
  const { fetchNextPage } = query;
  const fetching = query.isFetching;

  const loadForRefresh = useCallback((cursor: string | null, signal: AbortSignal) =>
    runWithPerformanceScope({ screen: performanceScope ?? 'unknown', action: 'refresh' }, () => load(cursor, signal)),
  [load, performanceScope]);

  useEffect(() => () => {
    // Trocar de aba/consulta não pode deixar um refresh antigo escrevendo no
    // cache novo, bloquear a paginação da lista atual ou deixar o indicador
    // preso quando a pessoa voltar para a aba anterior.
    operation.current += 1;
    pending.current = false;
    pendingAction.current = null;
    refreshController.current?.abort();
    refreshController.current = null;
    setRefreshingKey((current) => current === key ? null : current);
  }, [key]);

  const refresh = useCallback(() => {
    if (!enabled || pending.current || fetching) return;
    const generation = ++operation.current;
    const refreshKey = key;
    const controller = new AbortController();
    refreshController.current = controller;
    pending.current = true;
    setRefreshingKey(refreshKey);

    void (async () => {
      try {
        const cached = queryClient.getQueryData<PagesData<T>>(queryKey);
        const cachedPages = cached?.pages ?? [];
        const cachedPageParams = cached?.pageParams ?? [];
        const refreshedPages: Page<T>[] = [await loadForRefresh(null, controller.signal)];
        const refreshedPageParams: (string | null)[] = [null];
        const requestedCursors = new Set<string>();

        let result = reconcileRefreshedPages(cachedPages, refreshedPages);
        while (result.action === 'fetch') {
          // Nunca buscar mais páginas do que o cache já tinha: se o prefixo não
          // reencontrou o histórico, o cache antigo é descartado em vez de
          // gastar mais requests do que um refetch completo.
          if (refreshedPages.length >= cachedPages.length || requestedCursors.has(result.cursor)) {
            result = { action: 'replace', pages: refreshedPages };
            break;
          }
          requestedCursors.add(result.cursor);
          const nextPage = await loadForRefresh(result.cursor, controller.signal);
          if (controller.signal.aborted || operation.current !== generation) return;
          refreshedPageParams.push(result.cursor);
          refreshedPages.push(nextPage);
          result = reconcileRefreshedPages(cachedPages, refreshedPages);
        }

        if (controller.signal.aborted || operation.current !== generation) return;
        const pageParams = result.action === 'reuse'
          ? [...refreshedPageParams, ...cachedPageParams.slice(result.cachedStartPage)]
          : refreshedPageParams;
        queryClient.setQueryData<PagesData<T>>(queryKey, { pages: result.pages, pageParams });
      } catch (error) {
        if (controller.signal.aborted || operation.current !== generation) return;
        // O refresh manual não passa pelo onError do QueryCache. Registra o erro
        // no próprio Query para o banner e o retry seguirem o mesmo contrato de
        // um refetch, inclusive depois de remontar a tela.
        const target = queryClient.getQueryCache().find<PagesData<T>>({ queryKey, exact: true });
        if (accessDenied(error)) {
          // Mesma limpeza de uma resposta 401/403/404/410 no QueryCache: o
          // conteúdo revogado não pode ressuscitar num retry ou remontagem.
          target?.setState({ data: undefined, dataUpdatedAt: 0, error: toError(error), status: 'error' });
        } else {
          target?.setState({ error: toError(error), status: 'error' });
        }
      } finally {
        // Só encerra o indicador desta operação; um refresh novo (mesmo na
        // mesma aba) tem outro controller e não pode ser apagado por este finally.
        if (refreshController.current === controller) {
          refreshController.current = null;
          setRefreshingKey((current) => current === refreshKey ? null : current);
        }
        if (operation.current === generation) pending.current = false;
      }
    })();
  }, [enabled, fetching, key, queryKey, loadForRefresh]);

  const loadMore = useCallback(() => {
    if (!enabled || !query.hasNextPage || query.isFetching || pending.current) return;
    const generation = ++operation.current;
    pending.current = true;
    pendingAction.current = 'pagination';
    void fetchNextPage({ cancelRefetch: false }).finally(() => {
      if (operation.current !== generation) return;
      pending.current = false;
      pendingAction.current = null;
    });
  }, [enabled, query.hasNextPage, query.isFetching, fetchNextPage]);

  const denied = accessDenied(query.error);
  const items = useMemo(
    () => accessDenied(query.error) ? [] : mergeById(...(query.data?.pages.map((page) => page.items) ?? [])),
    [query.data, query.error],
  );
  const refreshError = query.isRefetchError && !denied ? query.error : null;
  return {
    items, status: (query.isPending ? 'loading' : denied || (!query.data && query.isError) ? 'error' : 'success') as 'loading' | 'error' | 'success',
    error: query.error, hasMore: !denied && !!query.hasNextPage,
    loadingMore: query.isFetchingNextPage, loadMoreError: query.isFetchNextPageError ? query.error : null,
    isRefreshing: refreshingKey === key, isFetching: fetching || refreshingKey === key,
    refreshError,
    refresh, loadMore,
  };
}
