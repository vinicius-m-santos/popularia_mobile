/** Acesso a perfis de pessoas e às publicações de cada uma. */
import { DEMO_MODE, USE_MOCKS } from '@/constants/config';
import { getMe } from '@/features/account/api';
import { toFeedItem, toUser } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import type { PageDto, PostDto } from '@/lib/api/dto';
import { findUser, toFeedItems } from '@/features/lookup';
import { ApiError, NotFoundError } from '@/lib/errors';
import { mockDelay } from '@/lib/mock-delay';
import { posts } from '@/mocks/posts';
import { featuredPeopleIds, profiles } from '@/mocks/profiles';
import { users } from '@/mocks/users';
import type { FeedItem, Profile } from '@/types/models';

function assertMocks() {
  if (!USE_MOCKS) throw new Error('A integração com a API ainda não foi implementada.');
}

function buildProfile(id: string): Profile | null {
  const user = findUser(id);
  if (!user) return null;
  const mock = profiles[id];
  const postCount = posts.filter((p) => p.authorId === id).length;
  return {
    user,
    bio: mock?.bio ?? 'Participa de comunas na Popularia.',
    meta: mock?.meta ?? 'Na Popularia desde 2025',
    summary: mock?.summary ?? `@${user.handle}`,
    stats: mock?.stats ?? [
      { value: '860', label: 'Seguidores' },
      { value: String(postCount), label: 'Publicações' },
      { value: String(mock?.comunaIds.length ?? 0), label: 'Comunas' },
    ],
    comunaIds: mock?.comunaIds ?? [],
    creator: mock?.creator ?? null,
  };
}

export async function getProfile(id: string): Promise<Profile> {
  if (!DEMO_MODE) {
    try {
      const dto = id === 'me' ? await getMe() : await apiRequest<{
        id: string; handle: string; displayName: string; bio: string; city: string | null; memberSince: string; isPrivate?: boolean; followerCount: number;
      }>(`/users/${encodeURIComponent(id)}`, { auth: true });
      const since = 'memberSince' in dto ? dto.memberSince : dto.createdAt;
      return {
        user: toUser(dto), bio: dto.bio, isPrivate: dto.isPrivate,
        meta: [dto.city, `Na Popularia desde ${new Date(since).getFullYear()}`].filter(Boolean).join(' · '),
        summary: dto.bio, stats: [{ value: String(dto.followerCount ?? 0), label: 'Seguidores' }], comunaIds: [], creator: null,
      };
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

/** Publicações de uma pessoa, das mais recentes para as mais antigas. */
export async function getUserPosts(id: string): Promise<FeedItem[]> {
  if (!DEMO_MODE) {
    const handle = id === 'me' ? (await getMe()).handle : id;
    const page = await apiRequest<PageDto<PostDto>>(`/users/${encodeURIComponent(handle)}/posts`, { auth: true });
    return page.items.map(toFeedItem);
  }
  assertMocks();
  const list = posts
    .filter((p) => p.authorId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mockDelay(toFeedItems(list));
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
