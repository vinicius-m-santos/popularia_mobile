import { queryOptions, useQuery } from '@tanstack/react-query';

import type { MembershipDto } from '@/lib/api/dto';
import { accessDenied, contentPolicy, queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { ComunaDetails } from '@/types/models';

import { getComuna } from './api';
import { placeholderComunaDetails, rememberComunaSummary } from './keys';

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
