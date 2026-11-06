import type { QueryKey } from '@tanstack/react-query';

import type { DiscoveryFilter } from '@/features/explore/api';
import type { LibraryFilters } from '@/features/library/types';
import { queryClient } from '@/lib/query/client';

/**
 * Chaves canônicas do cache.
 *
 * A mesma consulta precisa produzir a mesma chave em qualquer tela e em
 * qualquer remontagem. Objetos de filtro têm as chaves ordenadas e valores
 * vazios removidos para que `{ q: '' }` e `{}` representem a mesma consulta
 * (o servidor também trata os dois como ausência de filtro).
 */
function compact(filters: Record<string, unknown>): Record<string, string | number | boolean> {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}

export const discoveryKeys = {
  root: ['discovery'] as const,
  /** A descoberta inicial e a de assunto não compartilham conteúdo: cada uma tem sua chave. */
  detail: (meId: string, topicId: string | null, interestKey = ''): QueryKey =>
    ['discovery', meId, topicId, interestKey],
  /** Documentos do assunto usam o mesmo contrato da busca por documentos. */
  topicDocuments: (meId: string, topicId: string): QueryKey =>
    ['discovery', 'topic-documents', meId, topicId],
  searchRoot: ['search'] as const,
  search: (meId: string, term: string, filter: DiscoveryFilter, topicId: string | null): QueryKey =>
    ['search', meId, term, filter, topicId],
} as const;

export const libraryKeys = {
  root: ['library'] as const,
  collectionsRoot: ['library', 'collections'] as const,
  documents: (meId: string, filters: LibraryFilters): QueryKey => ['library', 'documents', meId, compact(filters)],
  collections: (meId: string, filters: Pick<LibraryFilters, 'scope' | 'owner' | 'comuna'>): QueryKey =>
    ['library', 'collections', meId, compact(filters)],
  collection: (meId: string, id: string): QueryKey => ['library', 'collection', meId, id],
} as const;

export const squaresKeys = {
  root: ['squares'] as const,
  list: (meId: string, section: 'mine' | 'discover', term: string): QueryKey => ['squares', meId, section, term],
} as const;

/** Marca o domínio como obsoleto e atualiza apenas as consultas montadas. */
export function invalidateLibrary(): void {
  void queryClient.invalidateQueries({ queryKey: libraryKeys.root, refetchType: 'active' });
}
