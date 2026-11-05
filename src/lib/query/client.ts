import { QueryCache, QueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError, NotFoundError } from '@/lib/errors';

export const accessDenied = (error: unknown) => error instanceof NotFoundError ||
  (error instanceof ApiError && [401, 403, 404, 410].includes(error.status));

// Freshness é definida pelos domínios, não por um tempo global arbitrário.
export const queryClient = new QueryClient({ queryCache: new QueryCache({
  onError: (error, query) => {
    if (!accessDenied(error)) return;
    // Não basta esconder durante o erro: um retry não pode ressuscitar dados revogados.
    query.setState({ data: undefined, dataUpdatedAt: 0 });
    if (query.queryKey[0] === 'post') queryClient.removeQueries({ queryKey: ['post-preview', query.queryKey[1]], exact: true });
  },
}), defaultOptions: { queries: {
  retry: (attempt, error) => !accessDenied(error) && !(error instanceof ApiError && error.status < 500) && attempt < 1,
  refetchOnWindowFocus: false,
} } });

/**
 * `setQueryData` dispara um `updated` e acorda os observers mesmo quando o updater
 * devolve o mesmo objeto. Num patch de reação/salvamento isso é ruído: a lista não
 * mudou, mas todos os observers daquela chave são notificados. Aqui a escrita só
 * acontece quando a referência muda, então um cartão intocado continua intocado.
 */
export function setQueryDataIfChanged(queryKey: QueryKey, current: unknown, next: unknown): boolean {
  if (next === undefined || next === current) return false;
  queryClient.setQueryData(queryKey, next);
  return true;
}

export const contentPolicy = {
  feed: { staleTime: 30_000, gcTime: 10 * 60_000 },
  profile: { staleTime: 60_000, gcTime: 10 * 60_000 },
  post: { staleTime: 15_000, gcTime: 5 * 60_000 },
};
