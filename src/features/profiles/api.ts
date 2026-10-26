/** Acesso a perfis de pessoas e às publicações de cada uma. */
import { USE_MOCKS } from '@/constants/config';
import { findUser, toFeedItems } from '@/features/lookup';
import { NotFoundError } from '@/lib/errors';
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
  assertMocks();
  const profile = buildProfile(id);
  if (!profile) throw new NotFoundError('Pessoa');
  return mockDelay(profile);
}

/** Publicações de uma pessoa, das mais recentes para as mais antigas. */
export async function getUserPosts(id: string): Promise<FeedItem[]> {
  assertMocks();
  const list = posts
    .filter((p) => p.authorId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mockDelay(toFeedItems(list));
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
