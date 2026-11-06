import { QueryCache, QueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError, NotFoundError } from '@/lib/errors';
import { queryKeys } from '@/lib/query/keys';

export const accessDenied = (error: unknown) => error instanceof NotFoundError ||
  (error instanceof ApiError && [401, 403, 404, 410].includes(error.status));

// Freshness é definida pelos domínios, não por um tempo global arbitrário.
export const queryClient = new QueryClient({ queryCache: new QueryCache({
  onError: (error, query) => {
    if (!accessDenied(error)) return;
    // Não basta esconder durante o erro: um retry não pode ressuscitar dados revogados.
    query.setState({ data: undefined, dataUpdatedAt: 0 });
    if (query.queryKey[0] === queryKeys.post.all[0]) {
      queryClient.removeQueries({ queryKey: queryKeys.post.preview(String(query.queryKey[1])), exact: true });
    }
    // O resumo sobrevive ao detalhe para evitar piscar a capa. Se o detalhe foi
    // negado, esse resumo também não pode alimentar o próximo placeholder.
    if (query.queryKey[0] === queryKeys.comuna.all[0] && query.queryKey.length === 2 && typeof query.queryKey[1] === 'string') {
      queryClient.removeQueries({ queryKey: queryKeys.comuna.summary(query.queryKey[1]), exact: true });
    }
  },
}), defaultOptions: { queries: {
  retry: (attempt, error) => !accessDenied(error) && !(error instanceof ApiError && error.status < 500) && attempt < 1,
  refetchOnWindowFocus: false,
} } });

/** Raiz do overlay de foto de perfil, compartilhado por todos os avatares da pessoa. */
export const AVATAR_QUERY_ROOT = queryKeys.avatar.all[0];

export const avatarQueryKey = (userId: string): QueryKey => queryKeys.avatar.detail(userId);

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

/**
 * `true` quando não há dado ou ele passou da janela de frescor do domínio.
 * Consultas em voo nunca são consideradas stale para não duplicar a request.
 */
export function isQueryStale(queryKey: QueryKey, staleTime: number): boolean {
  const state = queryClient.getQueryState(queryKey);
  if (!state || state.fetchStatus === 'fetching') return false;
  return state.dataUpdatedAt === 0 || Date.now() - state.dataUpdatedAt > staleTime;
}

/**
 * Revalida uma consulta só quando ela está stale. É o que telas de entidade
 * usam no foco: voltar dentro da janela de frescor não dispara nova request.
 */
export function revalidateIfStale(queryKey: QueryKey, staleTime: number): void {
  if (!isQueryStale(queryKey, staleTime)) return;
  void queryClient.invalidateQueries({ queryKey, exact: true });
}

/**
 * Políticas explícitas por tipo de dado. `gcTime` é quanto tempo a entrada sem
 * observers fica no cache; `staleTime` é a janela em que uma montagem/foco não
 * precisa buscar de novo. A busca tem staleTime 0 de propósito: teclado e
 * filtros mudam a chave e o resultado precisa refletir o servidor.
 */
export const contentPolicy = {
  feed: { staleTime: 30_000, gcTime: 10 * 60_000 },
  profile: { staleTime: 60_000, gcTime: 10 * 60_000 },
  post: { staleTime: 15_000, gcTime: 5 * 60_000 },
  /** Detalhe, publicações, fixados, evento e Praça da mesma comuna. */
  comuna: { staleTime: 60_000, gcTime: 10 * 60_000 },
  /** Descoberta agregada (Explorar/assunto). */
  discovery: { staleTime: 60_000, gcTime: 10 * 60_000 },
  /** Busca digitada: cache curto evita repetir a consulta em remontagens imediatas. */
  search: { staleTime: 15_000, gcTime: 10 * 60_000 },
  /** Metadados do assunto e listas de publicações por hashtag. */
  topic: { staleTime: 60_000, gcTime: 10 * 60_000 },
  /** Detalhe/lista de eventos: presença e cancelamento mudam com frequência. */
  event: { staleTime: 30_000, gcTime: 5 * 60_000 },
  /** Listas e coleções do acervo: voltar de um documento não refaz o histórico. */
  library: { staleTime: 30_000, gcTime: 10 * 60_000 },
  collection: { staleTime: 60_000, gcTime: 10 * 60_000 },
  /** Praças mudam com presença/mensagens; cache curto para o retorno ser fresco. */
  squares: { staleTime: 30_000, gcTime: 10 * 60_000 },
};
