import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';

import { accessDenied, queryClient } from '@/lib/query/client';

import type { AsyncData } from './use-async-data';

type CachedDataOptions<T> = {
  /** Chave da entidade; duas telas com a mesma chave compartilham uma request. */
  queryKey: QueryKey;
  load: (signal: AbortSignal) => Promise<T>;
  staleTime: number;
  gcTime: number;
  enabled?: boolean;
  /** Detalhes/agregados mantêm o comportamento de retry manual das telas. */
  retry?: boolean;
};

/**
 * Mesmo contrato de `useAsyncData`, mas apoiado no cache por chave do Query.
 *
 * Use este hook para entidades e agregados que precisam ser compartilhados
 * entre telas (detalhe de comuna, descoberta). `useAsyncData` continua sendo o
 * caminho para cargas efêmeras sem identidade de cache (taxonomias, quotas,
 * listas auxiliares de formulário).
 */
export function useCachedData<T>({ queryKey, load, staleTime, gcTime, enabled = true, retry = false }: CachedDataOptions<T>): AsyncData<T> {
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    staleTime,
    gcTime,
    enabled,
    retry,
  }, queryClient);
  const { refetch } = query;
  const reload = useCallback(() => { void refetch(); }, [refetch]);
  const denied = accessDenied(query.error);
  const data = denied ? null : query.data ?? null;
  return {
    data,
    status: query.isPending ? 'loading' : query.isError ? 'error' : 'success',
    error: query.error,
    // Uma revalidação em segundo plano não troca o conteúdo nem liga o loader.
    isRefreshing: query.isFetching && !query.isPending,
    reload,
  };
}
