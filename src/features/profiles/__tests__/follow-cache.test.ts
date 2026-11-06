import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from '@/types/models';

import { patchFollowCaches, restoreFollowCaches, revalidateFollowSurfaces, snapshotFollowCaches } from '../follow-cache';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, USE_MOCKS: true, MOCK_LATENCY_MS: 0 }));

const profile = (id: string, followerCount: number, followingCount: number): Profile => ({
  user: { id, name: id, handle: id, initials: 'ID', tone: 'red' },
  bio: '', meta: '', summary: '', stats: [], comunaIds: [], creator: null,
  followerCount, followingCount,
});

beforeEach(() => { queryClient.clear(); });
afterEach(() => { queryClient.clear(); });

describe('cache de follow', () => {
  it('atualiza contadores do perfil e a relação na lista, e desfaz no rollback', () => {
    queryClient.setQueryData(['profile', 'bia'], profile('bia', 2, 0));
    queryClient.setQueryData(['profile', 'ana'], profile('ana', 0, 4));
    queryClient.setQueryData(['relations', 'seguidores', 'bia'], {
      pages: [{ items: [{ id: 'bia', viewerFollowing: false, viewerRequested: false }], nextCursor: null }],
      pageParams: [null],
    });
    queryClient.setQueryData(queryKeys.feed.list('seguindo', ''), {
      pages: [{ items: [{ id: 'post', authorId: 'bia', text: 'oi' }], nextCursor: null }],
      pageParams: [null],
    });
    const discoveryKey = queryKeys.discovery.home('ana');
    queryClient.setQueryData(discoveryKey, {
      topics: [], comunas: [], posts: [], recentPosts: [], documents: [], events: [],
      people: [{ id: 'bia', name: 'Bia', viewerFollowing: false, viewerRequested: false }],
      next: { comunas: null, people: null, posts: null, events: null, documents: null },
    });
    const searchKey = queryKeys.discovery.search('bia', 'people');
    queryClient.setQueryData(searchKey, {
      pages: [{ items: [{ id: 'bia', kind: 'people', value: { id: 'bia', name: 'Bia', viewerFollowing: false, viewerRequested: false } }], nextCursor: null }],
      pageParams: [null],
    });
    const before = snapshotFollowCaches();
    patchFollowCaches({
      targetId: 'bia', viewerId: 'ana',
      previous: { following: false, requested: false },
      next: { following: true, requested: false },
    });
    expect(queryClient.getQueryData<Profile>(queryKeys.profile.detail('bia'))?.followerCount).toBe(3);
    expect(queryClient.getQueryData<Profile>(queryKeys.profile.detail('ana'))?.followingCount).toBe(5);
    const list = queryClient.getQueryData<{ pages: { items: { viewerFollowing: boolean }[] }[] }>(queryKeys.profile.relations('seguidores', 'bia'));
    expect(list?.pages[0].items[0].viewerFollowing).toBe(true);
    expect(queryClient.getQueryData<{ people: { viewerFollowing: boolean }[] }>(discoveryKey)?.people[0].viewerFollowing).toBe(true);
    const search = queryClient.getQueryData<{ pages: { items: { value: { viewerFollowing: boolean } }[] }[] }>(searchKey);
    expect(search?.pages[0].items[0].value.viewerFollowing).toBe(true);

    patchFollowCaches({
      targetId: 'bia', viewerId: 'ana',
      previous: { following: true, requested: false },
      next: { following: false, requested: false },
    });
    const feed = queryClient.getQueryData<{ pages: { items: { authorId: string }[] }[] }>(queryKeys.feed.list('seguindo', ''));
    expect(feed?.pages[0].items).toEqual([]);
    restoreFollowCaches(before);
    expect(queryClient.getQueryData<Profile>(queryKeys.profile.detail('bia'))?.followerCount).toBe(2);
    expect(queryClient.getQueryData<{ pages: { items: unknown[] }[] }>(queryKeys.feed.list('seguindo', ''))?.pages[0].items).toHaveLength(1);
    expect(queryClient.getQueryData<{ people: { viewerFollowing: boolean }[] }>(discoveryKey)?.people[0].viewerFollowing).toBe(false);
  });

  it('pedido pendente não mexe na contagem de seguidores', () => {
    queryClient.setQueryData(queryKeys.profile.detail('bia'), profile('bia', 2, 0));
    patchFollowCaches({
      targetId: 'bia', viewerId: 'ana',
      previous: { following: false, requested: false },
      next: { following: false, requested: true },
    });
    expect(queryClient.getQueryData<Profile>(queryKeys.profile.detail('bia'))?.followerCount).toBe(2);
  });

  it('revalidar relação atinge perfil, listas, feed Seguindo e descoberta/busca', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve());
    revalidateFollowSurfaces();
    expect(invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey)).toEqual([
      ['profile'],
      ['relations'],
      ['feed', 'seguindo'],
      ['discovery'],
      ['search'],
    ]);
    invalidate.mockRestore();
  });
});
