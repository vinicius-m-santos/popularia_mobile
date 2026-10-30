import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { queryClient } from '@/lib/query/client';
import type { Profile } from '@/types/models';

import { patchFollowCaches, restoreFollowCaches, snapshotFollowCaches } from '../follow-cache';

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
    queryClient.setQueryData(['feed', 'seguindo', ''], {
      pages: [{ items: [{ id: 'post', authorId: 'bia', text: 'oi' }], nextCursor: null }],
      pageParams: [null],
    });
    const before = snapshotFollowCaches();
    patchFollowCaches({
      targetId: 'bia', viewerId: 'ana',
      previous: { following: false, requested: false },
      next: { following: true, requested: false },
    });
    expect(queryClient.getQueryData<Profile>(['profile', 'bia'])?.followerCount).toBe(3);
    expect(queryClient.getQueryData<Profile>(['profile', 'ana'])?.followingCount).toBe(5);
    const list = queryClient.getQueryData<{ pages: { items: { viewerFollowing: boolean }[] }[] }>(['relations', 'seguidores', 'bia']);
    expect(list?.pages[0].items[0].viewerFollowing).toBe(true);

    patchFollowCaches({
      targetId: 'bia', viewerId: 'ana',
      previous: { following: true, requested: false },
      next: { following: false, requested: false },
    });
    const feed = queryClient.getQueryData<{ pages: { items: { authorId: string }[] }[] }>(['feed', 'seguindo', '']);
    expect(feed?.pages[0].items).toEqual([]);
    restoreFollowCaches(before);
    expect(queryClient.getQueryData<Profile>(['profile', 'bia'])?.followerCount).toBe(2);
    expect(queryClient.getQueryData<{ pages: { items: unknown[] }[] }>(['feed', 'seguindo', ''])?.pages[0].items).toHaveLength(1);
  });

  it('pedido pendente não mexe na contagem de seguidores', () => {
    queryClient.setQueryData(['profile', 'bia'], profile('bia', 2, 0));
    patchFollowCaches({
      targetId: 'bia', viewerId: 'ana',
      previous: { following: false, requested: false },
      next: { following: false, requested: true },
    });
    expect(queryClient.getQueryData<Profile>(['profile', 'bia'])?.followerCount).toBe(2);
  });
});
