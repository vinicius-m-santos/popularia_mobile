import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import type { PostDto } from '@/lib/api/dto';

import { listSavedPosts, setPostSaved } from '../api';

jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

const post: PostDto = {
  id: 'post-1', body: 'Ata da reunião', createdAt: '2026-10-29T12:00:00Z',
  author: { id: 'ana', handle: 'ana', displayName: 'Ana' }, comuna: null, commentCount: 0,
  viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false, saved: true },
};

beforeEach(() => { jest.clearAllMocks(); });

describe('contrato de publicações salvas', () => {
  it('salva e remove com PUT e DELETE', async () => {
    jest.mocked(apiRequest).mockResolvedValue(undefined);
    await setPostSaved('post-1', true);
    await setPostSaved('post-1', false);
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/posts/post-1/save', { method: 'PUT', auth: true });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/posts/post-1/save', { method: 'DELETE', auth: true });
  });

  it('pede a página pelo cursor e marca a publicação como salva', async () => {
    jest.mocked(apiRequest).mockResolvedValue({ items: [{ id: 'save-2', savedAt: '2026-10-29T18:00:00Z', post }], nextCursor: null });
    const page = await listSavedPosts('save-1');
    expect(apiRequest).toHaveBeenCalledWith('/me/saved-posts?cursor=save-1', expect.objectContaining({ auth: true }));
    expect(page.items.map((item) => [item.id, item.savedAt, item.viewer?.saved])).toEqual([['post-1', '2026-10-29T18:00:00Z', true]]);
    expect(page.nextCursor).toBeNull();
  });
});
