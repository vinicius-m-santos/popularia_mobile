import { QueryCache, QueryClient } from '@tanstack/react-query';
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

export const contentPolicy = {
  feed: { staleTime: 30_000, gcTime: 10 * 60_000 },
  profile: { staleTime: 60_000, gcTime: 10 * 60_000 },
  post: { staleTime: 15_000, gcTime: 5 * 60_000 },
};
