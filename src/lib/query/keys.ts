import type { QueryKey } from '@tanstack/react-query';

import type { DiscoveryFilter } from '@/features/explore/api';
import type { LibraryFilters } from '@/features/library/types';
import { queryClient } from '@/lib/query/client';

function compact(filters: Record<string, unknown>): Record<string, string | number | boolean> {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}

/** Fonte única das chaves de cache por domínio. */
export const queryKeys = {
  avatar: { all: ['user-avatar'] as const, detail: (userId: string) => ['user-avatar', userId] as const },
  feed: {
    all: ['feed'] as const,
    list: (tab: string, ...scope: string[]) => ['feed', tab, ...scope] as const,
    following: ['feed', 'seguindo'] as const,
  },
  post: {
    all: ['post'] as const,
    detail: (id: string) => ['post', id] as const,
    previewAll: ['post-preview'] as const,
    preview: (id: string) => ['post-preview', id] as const,
  },
  profile: {
    all: ['profile'] as const,
    detail: (id: string) => ['profile', id] as const,
    postsAll: ['profile-posts'] as const,
    posts: (author: string) => ['profile-posts', author] as const,
    relationsAll: ['relations'] as const,
    relations: (kind: string, id: string) => ['relations', kind, id] as const,
  },
  comuna: {
    all: ['comuna'] as const,
    detail: (slug: string) => ['comuna', slug] as const,
    summary: (slug: string) => ['comuna', slug, 'summary'] as const,
    posts: (slug: string) => ['comuna', slug, 'posts'] as const,
    pins: (slug: string) => ['comuna', slug, 'pins'] as const,
    square: (slug: string) => ['comuna', slug, 'square'] as const,
    cover: (slug: string) => ['comuna-cover', slug] as const,
    mark: (slug: string) => ['comuna-mark', slug] as const,
    eventsAll: (slug: string) => ['comuna', slug, 'events'] as const,
    events: (slug: string, when: string) => ['comuna', slug, 'events', when] as const,
    isPostsKey: (key: QueryKey) => key[0] === 'comuna' && key[2] === 'posts',
    isEventsKey: (key: QueryKey) => key[0] === 'comuna' && key[2] === 'events',
  },
  discovery: {
    all: ['discovery'] as const,
    home: (userId: string, topic?: string | null, scope = '') => ['discovery', userId, topic ?? null, scope] as const,
    topicDocuments: (userId: string, topic: string) => ['discovery', 'topic-documents', userId, topic] as const,
    searchAll: ['search'] as const,
    search: (userId: string, query: string, filter: string, topic?: string | null) =>
      ['search', userId, query, filter, topic ?? null] as const,
  },
  library: {
    all: ['library'] as const,
    collectionsAll: ['library', 'collections'] as const,
    documents: (userId: string, filters: LibraryFilters) => ['library', 'documents', userId, compact(filters)] as const,
    collections: (userId: string, filters: Pick<LibraryFilters, 'scope' | 'owner' | 'comuna'>) =>
      ['library', 'collections', userId, compact(filters)] as const,
    collection: (userId: string, id: string) => ['library', 'collection', userId, id] as const,
  },
  squares: {
    all: ['squares'] as const,
    list: (userId: string, section: 'mine' | 'discover', term: string) => ['squares', userId, section, term] as const,
  },
  topic: {
    all: ['topic'] as const,
    info: (slug: string) => ['topic', slug] as const,
    postsAll: ['topic-posts'] as const,
    posts: (slug: string) => ['topic-posts', slug] as const,
  },
  saved: { all: ['saved-posts'] as const },
  event: {
    all: ['event'] as const,
    detail: (id: string) => ['event', id] as const,
    attendees: (id: string, status: string) => ['event-attendees', id, status] as const,
  },
  notification: {
    all: ['notifications'] as const,
    session: (identity: string) => ['notifications', identity] as const,
    unread: (identity: string) => ['notifications', identity, 'unread'] as const,
  },
  moderation: {
    comunaReportsAll: (slug: string) => ['comuna-reports', slug] as const,
    comunaReports: (slug: string, bucket: string) => ['comuna-reports', slug, bucket] as const,
    platformReportsAll: ['platform-reports'] as const,
    platformReports: (bucket: string) => ['platform-reports', bucket] as const,
  },
  gamification: { detail: (accountId: string) => ['gamification', accountId] as const },
  mention: { suggestions: (term: string) => ['mention-suggestions', term] as const },
} as const;

/** Aliases para os consumidores entregues em POP-38. */
export const discoveryKeys = {
  root: queryKeys.discovery.all,
  detail: queryKeys.discovery.home,
  topicDocuments: queryKeys.discovery.topicDocuments,
  searchRoot: queryKeys.discovery.searchAll,
  search: (meId: string, term: string, filter: DiscoveryFilter, topicId: string | null): QueryKey =>
    queryKeys.discovery.search(meId, term, filter, topicId),
} as const;

export const libraryKeys = {
  root: queryKeys.library.all,
  collectionsRoot: queryKeys.library.collectionsAll,
  documents: queryKeys.library.documents,
  collections: queryKeys.library.collections,
  collection: queryKeys.library.collection,
} as const;

export const squaresKeys = { root: queryKeys.squares.all, list: queryKeys.squares.list } as const;

export function invalidateLibrary(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.library.all, refetchType: 'active' });
}
