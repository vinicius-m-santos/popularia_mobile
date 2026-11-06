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

/** Raiz do overlay de foto de perfil, compartilhado por todos os avatares da pessoa. */
export const AVATAR_QUERY_ROOT = 'user-avatar';

export const avatarQueryKey = (userId: string): QueryKey => [AVATAR_QUERY_ROOT, userId];

/**
 * O overlay de avatar não é dado de tela: é uma URL curta que precisa sobreviver
 * a uma navegação, não à sessão inteira. Sem `gcTime` infinito, a entrada de
 * query de quem saiu da árvore é recolhida; o valor atual continua no store de
 * avatares, que é limpo na troca de conta.
 */
export const avatarCachePolicy = { staleTime: Infinity, gcTime: 5 * 60_000 } as const;

queryClient.setQueryDefaults([AVATAR_QUERY_ROOT], avatarCachePolicy);

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
  /** Descoberta é compartilhada entre remontagens da mesma consulta. */
  discovery: { staleTime: 30_000, gcTime: 10 * 60_000 },
  /** A busca revalida rápido, mas uma troca de categoria não pode ficar em stale infinita. */
  search: { staleTime: 15_000, gcTime: 10 * 60_000 },
  /** Listas e coleções do acervo: voltar de um documento não refaz o histórico. */
  library: { staleTime: 30_000, gcTime: 10 * 60_000 },
  collection: { staleTime: 60_000, gcTime: 10 * 60_000 },
  /** Praças mudam com presença/mensagens; cache curto para o retorno ser fresco. */
  squares: { staleTime: 30_000, gcTime: 10 * 60_000 },
};
