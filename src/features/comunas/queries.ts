import { useCallback } from 'react';

import { useCachedData } from '@/hooks/use-cached-data';
import type { MembershipDto } from '@/lib/api/dto';
import { contentPolicy, queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { ComunaDetails } from '@/types/models';

import { getComuna } from './api';

/**
 * Um payload incompleto de comuna não pode entrar na chave de detalhe. A
 * validação exige a identidade e o estado de participação; permissões e listas
 * de pessoas continuam sendo opcionais porque comunas da plataforma não têm
 * proprietário/moderadores.
 */
export function isComunaDetailsPayload(value: unknown): value is ComunaDetails {
  if (!value || typeof value !== 'object') return false;
  const comuna = value as Partial<ComunaDetails>;
  return typeof comuna.id === 'string'
    && typeof comuna.name === 'string'
    && typeof comuna.handle === 'string'
    && typeof comuna.viewerIsMember === 'boolean';
}

/** Loader único do detalhe; valida antes de devolver para o cache. */
export async function loadComunaDetails(slug: string, signal?: AbortSignal): Promise<ComunaDetails> {
  const comuna = await getComuna(slug, signal);
  if (!isComunaDetailsPayload(comuna)) {
    throw new Error('Resposta incompleta da comuna; o cache anterior foi preservado.');
  }
  return comuna;
}

/**
 * Detalhe compartilhado da comuna. Mesmo contrato de `useAsyncData`, com cache
 * por chave: duas telas abertas em sequência não repetem o GET enquanto o dado
 * estiver fresco.
 */
export function useComuna(slug: string) {
  const load = useCallback((signal: AbortSignal) => loadComunaDetails(slug, signal), [slug]);
  return useCachedData<ComunaDetails>({
    queryKey: queryKeys.comuna.detail(slug),
    load,
    ...contentPolicy.comuna,
    enabled: !!slug,
  });
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

/**
 * Grava somente os campos de que a resposta de participar/sair é dona. O
 * restante do detalhe (regras, capa, moderação, permissões de outro tipo)
 * continua intacto, evitando que um payload de membership vire o detalhe.
 */
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
  queryClient.setQueryData(queryKeys.comuna.detail(slug), next);

  // Em comuna pública a leitura não muda ao entrar/sair; só a privada abre/fecha conteúdo.
  if (current.visibility !== 'private') return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.posts(slug) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.square(slug) });
  if (next.viewerIsMember) void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.pins(slug) });
  else queryClient.removeQueries({ queryKey: queryKeys.comuna.pins(slug), exact: true });
}
