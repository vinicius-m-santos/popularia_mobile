import { useCallback } from 'react';

import { useCachedData } from '@/hooks/use-cached-data';
import { contentPolicy } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import { getDiscoveryData, type DiscoveryData } from './api';

const DISCOVERY_ARRAYS = [
  'topics',
  'comunas',
  'people',
  'posts',
  'recentPosts',
  'documents',
  'events',
] as const;

/**
 * Um payload parcial de descoberta não pode virar cache da tela: a validação
 * exige todas as coleções e o objeto de cursores. Assim um deploy antigo ou uma
 * resposta truncada falha como erro de leitura em vez de renderizar seções
 * vazias como se fossem a resposta do servidor.
 */
export function isDiscoveryDataPayload(value: unknown): value is DiscoveryData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (!DISCOVERY_ARRAYS.every((key) => Array.isArray(data[key]))) return false;
  return !!data.next && typeof data.next === 'object' && !Array.isArray(data.next);
}

async function loadDiscovery(userId: string, topicId: string | undefined, signal: AbortSignal): Promise<DiscoveryData> {
  const data = await getDiscoveryData(userId, topicId, signal);
  if (!isDiscoveryDataPayload(data)) {
    throw new Error('Resposta incompleta da descoberta; o cache anterior foi preservado.');
  }
  return data;
}

/**
 * Descoberta compartilhada por chave. A mesma combinação pessoa/assunto/escopo
 * usa uma única entrada; trocar de filtro ou termo não cria outra leitura.
 */
export function useDiscovery(userId: string, topicId?: string, scope = '') {
  const key = queryKeys.discovery.home(userId, topicId, scope);
  const load = useCallback((signal: AbortSignal) => loadDiscovery(userId, topicId, signal), [userId, topicId]);
  return {
    queryKey: key,
    ...useCachedData<DiscoveryData>({ queryKey: key, load, ...contentPolicy.discovery }),
  };
}
