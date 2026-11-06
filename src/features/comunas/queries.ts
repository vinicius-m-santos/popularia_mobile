import { infiniteQueryOptions, queryOptions, useQuery } from '@tanstack/react-query';

import type { MembershipDto } from '@/lib/api/dto';
import {
  accessDenied, contentPolicy, prefetchInfiniteQueryOnce, prefetchQueryOnce, queryClient,
} from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { Comuna, ComunaDetails } from '@/types/models';

import { getComuna, getComunaPosts } from './api';
import { placeholderComunaDetails, readComunaSummary, rememberComunaSummary } from './keys';

export function isComunaDetailsPayload(value: unknown): value is ComunaDetails {
  if (!value || typeof value !== 'object') return false;
  const comuna = value as Partial<ComunaDetails>;
  return typeof comuna.id === 'string'
    && typeof comuna.name === 'string'
    && typeof comuna.handle === 'string'
    && typeof comuna.viewerIsMember === 'boolean';
}

export async function loadComunaDetails(slug: string, signal?: AbortSignal): Promise<ComunaDetails> {
  const comuna = await getComuna(slug, signal);
  if (!isComunaDetailsPayload(comuna)) throw new Error('Resposta incompleta da comuna; o cache anterior foi preservado.');
  return comuna;
}

export const comunaOptions = (slug: string) => queryOptions<ComunaDetails>({
  queryKey: queryKeys.comuna.detail(slug),
  queryFn: ({ signal }) => loadComunaDetails(slug, signal),
  ...contentPolicy.comuna,
  placeholderData: () => placeholderComunaDetails(slug),
});

export function useComuna(slug: string) {
  const query = useQuery({ ...comunaOptions(slug), enabled: !!slug }, queryClient);
  const failed = query.isError || query.isRefetchError;
  return {
    data: accessDenied(query.error) ? null : query.data ?? null,
    status: (query.isPending ? 'loading' : failed ? 'error' : 'success') as 'loading' | 'success' | 'error',
    error: query.error,
    reload: query.refetch,
  };
}

/** Primeira página de publicações da comuna, com a mesma chave usada pela tela. */
export const comunaPostsOptions = (slug: string) => infiniteQueryOptions({
  queryKey: queryKeys.comuna.posts(slug),
  queryFn: ({ pageParam }) => getComunaPosts(slug, pageParam),
  initialPageParam: null as string | null,
  getNextPageParam: (page) => page.nextCursor ?? undefined,
  ...contentPolicy.comuna,
});

/**
 * Aquece detalhe e primeira página da comuna antes da navegação.
 *
 * O resumo da lista é gravado separadamente para a capa aparecer na primeira
 * renderização. Se a leitura falhar ou demorar, a tela de destino segue o fluxo
 * normal de loading/erro e tenta de novo. Uma lista já carregada não é refeita
 * no `onPressIn` (evita multiplicar páginas em rede lenta).
 */
export function prepareComuna(input: string | Comuna, options: { includePosts?: boolean } = {}): Promise<void> {
  const slug = typeof input === 'string' ? input : input.id;
  const summary = typeof input === 'string' ? readComunaSummary(input) : input;
  if (typeof input !== 'string') rememberComunaSummary(input);

  const tasks = [prefetchQueryOnce(comunaOptions(slug))];
  // Comuna privada sem participação não expõe publicações: o prefetch não deve
  // provocar um 403 antes de a tela decidir mostrar o recado de acesso.
  const canReadPosts = !(summary?.visibility === 'private' && !summary.viewerIsMember);
  if (options.includePosts !== false && canReadPosts) {
    tasks.push(prefetchInfiniteQueryOnce(comunaPostsOptions(slug)));
  }
  return Promise.all(tasks).then(() => undefined);
}

/** Invalida as leituras derivadas de uma comuna; o detalhe é atualizado por quem chamou. */
export async function invalidateComunaReads(slug: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.comuna.posts(slug) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.comuna.pins(slug) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.comuna.square(slug) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.comuna.eventsAll(slug) }),
  ]);
}

export function writeComuna(comuna: ComunaDetails): void {
  queryClient.setQueryData(queryKeys.comuna.detail(comuna.id), comuna);
  rememberComunaSummary(comuna);
}

export function applyComunaMembership(slug: string, membership?: MembershipDto | null): void {
  const current = queryClient.getQueryData<ComunaDetails>(queryKeys.comuna.detail(slug));
  if (!current) return;
  const next: ComunaDetails = membership ? {
    ...current,
    viewerIsMember: membership.isMember,
    viewerRole: membership.role as ComunaDetails['viewerRole'],
    memberCount: membership.memberCount,
  } : {
    ...current,
    viewerIsMember: false,
    viewerRole: null,
    memberCount: Math.max(0, current.memberCount - (current.viewerIsMember ? 1 : 0)),
  };
  if (!next.viewerIsMember) delete next.viewerPermissions;
  writeComuna(next);
  if (current.visibility !== 'private') return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.posts(slug) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.square(slug) });
  if (next.viewerIsMember) void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.pins(slug) });
  else queryClient.removeQueries({ queryKey: queryKeys.comuna.pins(slug), exact: true });
}
