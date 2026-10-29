import { singlePage, type Page } from '@/lib/pagination';
/** Acesso a perfis de pessoas e às publicações de cada uma. */
import { DEMO_MODE, USE_MOCKS } from '@/constants/config';
import { getMe, type MeDto } from '@/features/account/api';
import { toFeedItem, toUser } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import { MAX_PAGE_LIMIT, type PageDto, type PostDto } from '@/lib/api/dto';
import { findUser, toFeedItems } from '@/features/lookup';
import { ApiError, NotFoundError } from '@/lib/errors';
import { mockDelay } from '@/lib/mock-delay';
import { posts } from '@/mocks/posts';
import { featuredPeopleIds, profiles } from '@/mocks/profiles';
import { users } from '@/mocks/users';
import type { FeedItem, Profile, User } from '@/types/models';

function assertMocks() {
  if (!USE_MOCKS) throw new Error('A integração com a API ainda não foi implementada.');
}

function buildProfile(id: string): Profile | null {
  const user = findUser(id);
  if (!user) return null;
  const mock = profiles[id];
  const postCount = posts.filter((p) => p.authorId === id).length;
  const stats = mock?.stats ?? [
    { value: '860', label: 'Seguidores' },
    { value: String(postCount), label: 'Publicações' },
    { value: String(mock?.comunaIds.length ?? 0), label: 'Comunas' },
  ];
  return {
    user,
    bio: mock?.bio ?? 'Participa de comunas na Popularia.',
    meta: mock?.meta ?? 'Na Popularia desde 2025',
    summary: mock?.summary ?? `@${user.handle}`,
    stats,
    followerCount: statNumber(stats, 'seguidores'),
    followingCount: statNumber(stats, 'seguindo'),
    comunaIds: mock?.comunaIds ?? [],
    creator: mock?.creator ?? null,
  };
}

function statNumber(stats: { value: string; label: string }[], label: string) {
  const digits = stats.find((stat) => stat.label.toLowerCase() === label)?.value.replace(/[^\d]/g, '') ?? '';
  return digits ? Number(digits) : 0;
}

type ProfileDto = Pick<MeDto, 'id' | 'handle' | 'displayName' | 'bio' | 'city' | 'isPrivate' | 'followerCount' | 'avatarUrl'> & {
  followingCount?: number;
  viewerFollowing?: boolean;
  viewerRequested?: boolean;
} & ({ memberSince: string } | { createdAt: string });

/** Permite pintar o próprio perfil a partir da conta já restaurada. */
export function toProfile(dto: ProfileDto): Profile {
  const since = 'memberSince' in dto ? dto.memberSince : dto.createdAt;
  return {
    user: { ...toUser(dto), viewerFollowing: dto.viewerFollowing, viewerRequested: dto.viewerRequested, isPrivate: dto.isPrivate },
    bio: dto.bio, isPrivate: dto.isPrivate,
    followerCount: dto.followerCount ?? 0, followingCount: dto.followingCount ?? 0,
    meta: [dto.city, `Na Popularia desde ${new Date(since).getFullYear()}`].filter(Boolean).join(' · '),
    summary: dto.bio, stats: [], comunaIds: [], creator: null,
  };
}

export async function getProfile(id: string, signal?: AbortSignal): Promise<Profile> {
  if (!DEMO_MODE) {
    try {
      const dto = id === 'me' ? await getMe(signal) : await apiRequest<ProfileDto>(`/users/${encodeURIComponent(id)}`, { auth: true, ...(signal ? { signal } : {}) });
      return toProfile(dto);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw new NotFoundError('Pessoa');
      throw error;
    }
  }
  assertMocks();
  const profile = buildProfile(id);
  if (!profile) throw new NotFoundError('Pessoa');
  return mockDelay(profile);
}

/** Uma página por intenção de leitura. O chamador fornece o handle já conhecido de /me. */
export async function getUserPostsPage(id: string, cursor: string | null, signal?: AbortSignal): Promise<Page<FeedItem>> {
  if (!DEMO_MODE) {
    const query = new URLSearchParams({ limit: String(MAX_PAGE_LIMIT) });
    if (cursor) query.set('cursor', cursor);
    const page = await apiRequest<PageDto<PostDto>>(`/users/${encodeURIComponent(id)}/posts?${query}`, { auth: true, ...(signal ? { signal } : {}) });
    return { items: page.items.map(toFeedItem), nextCursor: page.nextCursor };
  }
  assertMocks();
  const list = posts.filter((p) => p.authorId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mockDelay(singlePage(toFeedItems(list)));
}

export type RelationKind = 'seguidores' | 'seguindo';

type RelationDto = {
  id: string;
  handle: string;
  displayName: string;
  isPrivate: boolean;
  following: boolean;
  requested: boolean;
  avatarUrl?: string | null;
};

export async function getRelationPage(kind: RelationKind, id: string, cursor: string | null, signal?: AbortSignal): Promise<Page<User>> {
  if (!DEMO_MODE) {
    const query = new URLSearchParams({ limit: String(MAX_PAGE_LIMIT) });
    if (cursor) query.set('cursor', cursor);
    const path = kind === 'seguindo' ? 'following' : 'followers';
    const page = await apiRequest<PageDto<RelationDto>>(`/users/${encodeURIComponent(id)}/${path}?${query}`, { auth: true, ...(signal ? { signal } : {}) });
    return {
      items: page.items.map((person) => ({
        ...toUser(person),
        isPrivate: person.isPrivate,
        viewerFollowing: person.following,
        viewerRequested: person.requested,
      })),
      nextCursor: page.nextCursor,
    };
  }
  assertMocks();
  return mockDelay(singlePage([]));
}

export type FollowState = { following: boolean; requested?: boolean };
export async function getFollowing(id: string, receive?: (state: FollowState) => void): Promise<boolean> {
  const state = await apiRequest<FollowState>(`/users/${encodeURIComponent(id)}/follow`, { auth: true });
  receive?.(state);
  return state.following;
}

export async function setFollowing(id: string, following: boolean): Promise<FollowState | void> {
  return apiRequest<FollowState | void>(`/users/${encodeURIComponent(id)}/follow`, { method: following ? 'PUT' : 'DELETE', auth: true });
}

/** Pessoas e criadores em destaque no Explorar. */
export async function getFeaturedPeople(): Promise<Profile[]> {
  assertMocks();
  return mockDelay(featuredPeopleIds.map(buildProfile).filter((p): p is Profile => p !== null));
}

/** Pessoas que aparecem na busca (todas menos a própria). */
export async function getSearchablePeople(ownUserId: string): Promise<Profile[]> {
  assertMocks();
  const ids = users.filter((u) => u.id !== ownUserId).map((u) => u.id);
  return mockDelay(ids.map(buildProfile).filter((p): p is Profile => p !== null));
}
