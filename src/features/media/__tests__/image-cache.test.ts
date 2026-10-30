import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { queryClient } from '@/lib/query/client';
import type { FeedItem, Profile } from '@/types/models';

import { publishAvatar, publishCover } from '../image-cache';

afterEach(() => queryClient.clear());

const author = { id: 'user-1', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' as const, avatarUrl: 'https://cdn/old.jpg' };

function post(id: string): FeedItem {
  return {
    id, authorId: author.id, comunaId: null, createdAt: '2026-01-01T00:00:00Z', text: 'texto',
    supportCount: 0, commentCount: 0, echoCount: 0, author, comuna: null, event: null, topCommentAuthor: null,
  };
}

beforeEach(() => {
  queryClient.clear();
});

describe('cache de foto e capa', () => {
  it('atualiza o perfil, o feed e os comentários já carregados sem mexer em outra pessoa', () => {
    const other = { ...author, id: 'user-2', name: 'Bia', avatarUrl: 'https://cdn/bia.jpg' };
    queryClient.setQueryData(['profile', 'me'], { user: author, bio: '', meta: '', summary: '', stats: [], comunaIds: [], creator: null } satisfies Profile);
    queryClient.setQueryData(['feed', 'para-voce'], { pages: [{ items: [post('p1'), { ...post('p2'), author: other, authorId: other.id }], nextCursor: null }], pageParams: [null] });
    queryClient.setQueryData(['comments', 'p1'], { items: [{ id: 'c1', author }, { id: 'c2', author: other }] });

    publishAvatar('user-1', 'https://cdn/new.jpg');

    expect(queryClient.getQueryData<Profile>(['profile', 'me'])?.user.avatarUrl).toBe('https://cdn/new.jpg');
    const feed = queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['feed', 'para-voce']);
    expect(feed?.pages[0].items[0].author.avatarUrl).toBe('https://cdn/new.jpg');
    expect(feed?.pages[0].items[1].author.avatarUrl).toBe('https://cdn/bia.jpg');
    expect(queryClient.getQueryData<{ items: { author: { avatarUrl: string } }[] }>(['comments', 'p1'])?.items.map((item) => item.author.avatarUrl)).toEqual(['https://cdn/new.jpg', 'https://cdn/bia.jpg']);
    expect(queryClient.getQueryData(['user-avatar', 'user-1'])).toBe('https://cdn/new.jpg');
  });

  it('atualiza a capa da comuna no detalhe e na lista em cache', () => {
    const comuna = { id: 'hortas', serverId: 'uuid-1', name: 'Hortas', coverAlt: 'capa', coverUrl: 'https://cdn/old-cover.jpg', memberCount: 3 };
    const other = { ...comuna, id: 'outra', serverId: 'uuid-2', coverUrl: 'https://cdn/other.jpg' };
    queryClient.setQueryData(['comuna', 'hortas'], comuna);
    queryClient.setQueryData(['comunas'], { items: [comuna, other] });

    publishCover({ id: 'hortas', serverId: 'uuid-1' }, 'https://cdn/new-cover.jpg');

    expect(queryClient.getQueryData<typeof comuna>(['comuna', 'hortas'])?.coverUrl).toBe('https://cdn/new-cover.jpg');
    expect(queryClient.getQueryData<{ items: typeof comuna[] }>(['comunas'])?.items.map((item) => item.coverUrl)).toEqual(['https://cdn/new-cover.jpg', 'https://cdn/other.jpg']);
  });
});
