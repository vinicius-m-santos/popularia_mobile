import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryClient } from '@/lib/query/client';

import type { AsyncData } from './use-async-data';

type CachedQueryOptions<T> = {
  queryKey: QueryKey;
  load: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: boolean;
  /** Dados de uma lista já carregada evitam o loader enquanto a consulta chega. */
  placeholderData?: () => T | undefined;
};

/**
 * Consulta única com o cache compartilhado do React Query, mantendo o contrato
 * de `useAsyncData` que as telas já conhecem. Remontar a tela com dados frescos
 * não mostra spinner; uma revalidação mantém o conteúdo anterior enquanto
 * atualiza, e erros de revalidação não apagam o que já estava visível.
 */
export function useCachedQuery<T>({
  queryKey,
  load,
  enabled = true,
  staleTime,
  gcTime,
  retry,
  placeholderData,
}: CachedQueryOptions<T>): AsyncData<T> {
  const query = useQuery<T>({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    enabled,
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(gcTime !== undefined ? { gcTime } : {}),
    ...(retry !== undefined ? { retry } : {}),
    // O TanStack usa NonFunctionGuard no tipo de placeholderData para aceitar T
    // como função; aqui T é sempre um objeto de dados, nunca uma função.
    ...(placeholderData ? { placeholderData: placeholderData as never } : {}),
  }, queryClient);
  const { refetch } = query;
  const reload = useCallback(() => { void refetch(); }, [refetch]);
  const data = (query.data ?? null) as T | null;
  const status: AsyncData<T>['status'] = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : query.data === undefined
        ? 'error'
        : 'success';

  return {
    status,
    data,
    error: query.error ?? null,
    isRefreshing: query.isFetching && data !== null,
    reload,
  };
}
