/** Dados da tela Explorar: destaques e o índice usado pela busca. */
import { DEMO_MODE, USE_MOCKS } from '@/constants/config';
import { getComunas, toComuna } from '@/features/comunas/api';
import { toFeedItems } from '@/features/lookup';
import { getFeaturedPeople, getSearchablePeople } from '@/features/profiles/api';
import { mockDelay } from '@/lib/mock-delay';
import { posts } from '@/mocks/posts';
import { topicGroups, trends } from '@/mocks/topics';
import { apiRequest } from '@/lib/api/client';
import type { AuthorDto, ComunaDto, PostDto } from '@/lib/api/dto';
import { toFeedItem, toUser } from '@/features/posts/api';
import type { Page } from '@/lib/pagination';
import { searchExplore } from './search';
import type { Comuna, FeedItem, Profile, Topic, Trend, User } from '@/types/models';

export type ExploreData = {
  trends: Trend[];
  comunas: Comuna[];
  featuredPeople: Profile[];
  /** Índice da busca. Com a API, a busca passa a ser feita no servidor. */
  people: Profile[];
  posts: FeedItem[];
  topics: Topic[];
};

export async function getExploreData(ownUserId: string): Promise<ExploreData> {
  if (!USE_MOCKS) throw new Error('A integração com a API ainda não foi implementada.');
  const [comunas, featuredPeople, people, items] = await Promise.all([
    getComunas(),
    getFeaturedPeople(),
    getSearchablePeople(ownUserId),
    mockDelay(toFeedItems(posts)),
  ]);
  return {
    trends,
    comunas,
    featuredPeople,
    people,
    posts: items,
    topics: topicGroups.flatMap((g) => g.topics),
  };
}


/** Contrato agregado: previews pequenos e cursores separados para os filtros de busca. */
export type DiscoveryFilter = 'all' | 'comunas' | 'people' | 'posts' | 'events' | 'documents';
export type DiscoveryData = {
  topics: Topic[];
  comunas: Comuna[];
  people: User[];
  posts: FeedItem[];
  recentPosts: FeedItem[];
  documents: import('@/features/library/types').LibraryDocument[];
  events: import('@/features/events/types').ComunaEvent[];
  next: { comunas: string | null; people: string | null; posts: string | null; events: string | null; documents: string | null };
};
export type DiscoveryEntry =
  | { id: string; kind: 'comunas'; value: Comuna }
  | { id: string; kind: 'people'; value: User }
  | { id: string; kind: 'posts'; value: FeedItem }
  | { id: string; kind: 'events'; value: import('@/features/events/types').ComunaEvent }
  | { id: string; kind: 'documents'; value: import('@/features/library/types').LibraryDocument };

type DiscoveryDto = {
  topics: Topic[];
  comunas: ComunaDto[];
  people: (AuthorDto & { following: boolean; requested?: boolean; isPrivate?: boolean })[];
  posts: PostDto[];
  recentPosts: PostDto[];
  documents?: import('@/features/library/types').LibraryDocument[];
  events?: import('@/features/events/types').ComunaEvent[];
  next: Partial<DiscoveryData['next']>;
};

function convertDiscovery(dto: DiscoveryDto): DiscoveryData {
  return {
    ...dto,
    comunas: dto.comunas.map(toComuna),
    people: dto.people.map((p) => ({ ...toUser(p), viewerFollowing: p.following, viewerRequested: p.requested ?? false, isPrivate: p.isPrivate ?? false })),
    posts: dto.posts.map(toFeedItem),
    recentPosts: dto.recentPosts.map(toFeedItem),
    documents: dto.documents ?? [],
    events: dto.events ?? [],
    next: { comunas: null, people: null, posts: null, events: null, documents: null, ...dto.next },
  };
}

export async function getDiscoveryData(ownUserId: string, topic?: string): Promise<DiscoveryData> {
  if (!DEMO_MODE) {
    return convertDiscovery(await apiRequest<DiscoveryDto>(`/explore${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`, { auth: true }));
  }
  const data = await getExploreData(ownUserId);
  const related = data.comunas.filter((c) => !topic || c.topics[0] === topic);
  const relatedPosts = data.posts.filter((p) => !topic || related.some((c) => c.id === p.comunaId));
  return {
    topics: data.topics,
    comunas: related.slice(0, 5),
    people: topic ? [] : data.featuredPeople.map((p) => p.user).filter((u) => u.id !== ownUserId).slice(0, 5),
    posts: relatedPosts.slice(0, 3),
    recentPosts: topic ? relatedPosts.slice(3, 8) : [],
    documents: [],
    events: [],
    next: { comunas: null, people: null, posts: null, events: null, documents: null },
  };
}

export async function searchDiscovery(ownUserId: string, query: string, filter: DiscoveryFilter, topic?: string, cursor: string | null = null, signal?: AbortSignal): Promise<Page<DiscoveryEntry>> {
  let data: DiscoveryData;
  if (!DEMO_MODE) {
    const params = new URLSearchParams({ q: query, type: filter, limit: filter === 'all' ? '3' : '20' });
    if (topic) params.set('topic', topic);
    if (cursor) params.set('cursor', cursor);
    data = convertDiscovery(await apiRequest<DiscoveryDto>(`/search?${params}`, { auth: true, ...(signal ? { signal } : {}) }));
  } else {
    const source = await getExploreData(ownUserId);
    const related = source.comunas.filter((c) => !topic || c.topics[0] === topic);
    const result = searchExplore({ ...source, comunas: related, posts: source.posts.filter((p) => !topic || related.some((c) => c.id === p.comunaId)) }, query.replace(/^@/, ''));
    const limit = filter === 'all' ? 3 : 20;
    data = { topics: source.topics, comunas: result.comunas.slice(0, limit), people: topic ? [] : result.people.map((p) => p.user).slice(0, limit), posts: result.posts.slice(0, limit), recentPosts: [], documents: [], events: [], next: { comunas: null, people: null, posts: null, events: null, documents: null } };
  }
  const items: DiscoveryEntry[] = [
    ...(filter === 'all' || filter === 'comunas' ? data.comunas.map((value) => ({ id: value.id, kind: 'comunas' as const, value })) : []),
    ...(filter === 'all' || filter === 'people' ? data.people.map((value) => ({ id: value.id, kind: 'people' as const, value })) : []),
    ...(filter === 'all' || filter === 'posts' ? data.posts.map((value) => ({ id: value.id, kind: 'posts' as const, value })) : []),
    ...(filter === 'all' || filter === 'events' ? data.events.map((value) => ({ id: value.id, kind: 'events' as const, value })) : []),
    ...(filter === 'all' || filter === 'documents' ? data.documents.map((value) => ({ id: value.id, kind: 'documents' as const, value })) : []),
  ];
  return { items, nextCursor: filter === 'all' ? null : data.next[filter] };
}
