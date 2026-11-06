import type { QueryKey } from '@tanstack/react-query';

import type { FeedItem } from '@/types/models';

/**
 * Raízes que guardam publicações completas. Toda ação de publicação (apoiar,
 * ecoar, salvar, votar, fixar, excluir) varre só estas raízes; detalhe de
 * comuna, eventos, perfis e descoberta não são tocados por engano.
 *
 * `comuna` e `topic-posts` entram porque as listas de comuna/tópico passaram a
 * usar o cache paginado compartilhado. Os predicados abaixo confirmam que a
 * query realmente contém a publicação antes de qualquer escrita.
 */
export const POST_CACHE_ROOTS = new Set([
  'feed',
  'profile-posts',
  'post',
  'post-preview',
  'saved-posts',
  'comuna',
  'topic-posts',
]);

export function isPostCacheRoot(queryKey: QueryKey): boolean {
  return POST_CACHE_ROOTS.has(String(queryKey[0]));
}

export function isFeedItemPayload(value: unknown): value is FeedItem {
  return !!value && typeof value === 'object'
    && typeof (value as { id?: unknown }).id === 'string'
    && typeof (value as { text?: unknown }).text === 'string'
    && 'author' in value;
}

export function isPostPagePayload(value: unknown): value is { items: (FeedItem | null)[]; nextCursor: string | null } {
  return !!value && typeof value === 'object'
    && 'items' in value
    && Array.isArray((value as { items: unknown }).items);
}

export function isPostInfinitePayload(value: unknown): value is { pages: unknown[]; pageParams: unknown[] } {
  return !!value && typeof value === 'object'
    && 'pages' in value
    && Array.isArray((value as { pages: unknown }).pages);
}

/** Localiza a publicação tanto no detalhe quanto em páginas, listas diretas e itens reciclados. */
export function containsPost(data: unknown, postId: string): boolean {
  if (isFeedItemPayload(data)) return data.id === postId;
  if (Array.isArray(data)) return data.some((item) => isFeedItemPayload(item) && item.id === postId);
  if (isPostInfinitePayload(data)) {
    return data.pages.some((page) => isPostPagePayload(page) && page.items.some((item) => item?.id === postId));
  }
  if (isPostPagePayload(data)) return data.items.some((item) => item?.id === postId);
  return false;
}
