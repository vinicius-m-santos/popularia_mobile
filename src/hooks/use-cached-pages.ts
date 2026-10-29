import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { accessDenied, queryClient } from '@/lib/query/client';
import { mergeById, type Page } from '@/lib/pagination';

/** Adaptador pequeno para listas paginadas; o cache e a concorrência pertencem ao Query. */
export function useCachedPages<T extends { id: string }>({ queryKey, load, staleTime, gcTime, enabled = true }: {
  queryKey: QueryKey; load: (cursor: string | null, signal: AbortSignal) => Promise<Page<T>>;
  staleTime: number; gcTime: number; enabled?: boolean;
}) {
  const query = useInfiniteQuery({ queryKey, initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => load(pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime, gcTime, enabled,
  }, queryClient);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const key = JSON.stringify(queryKey);
  const pending = useRef(false);
  const { refetch, fetchNextPage } = query;
  const refresh = useCallback(() => {
    if (!enabled || pending.current) return;
    pending.current = true;
    setRefreshingKey(key);
    void refetch({ cancelRefetch: false }).finally(() => { pending.current = false; setRefreshingKey(null); });
  }, [enabled, key, refetch]);
  const loadMore = useCallback(() => {
    if (!enabled || !query.hasNextPage || query.isFetching || pending.current) return;
    pending.current = true;
    void fetchNextPage({ cancelRefetch: false }).finally(() => { pending.current = false; });
  }, [enabled, query.hasNextPage, query.isFetching, fetchNextPage]);
  const denied = accessDenied(query.error);
  const items = useMemo(() => denied ? [] : mergeById(...(query.data?.pages.map((page) => page.items) ?? [])), [query.data, denied]);
  return {
    items, status: (query.isPending ? 'loading' : denied || (!query.data && query.isError) ? 'error' : 'success') as 'loading' | 'error' | 'success',
    error: query.error, hasMore: !denied && !!query.hasNextPage,
    loadingMore: query.isFetchingNextPage, loadMoreError: query.isFetchNextPageError ? query.error : null,
    isRefreshing: refreshingKey === key, isFetching: query.isFetching,
    refreshError: query.isRefetchError && !denied ? query.error : null,
    refresh, loadMore,
  };
}
