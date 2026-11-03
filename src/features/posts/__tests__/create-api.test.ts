import { describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import { createPost } from '@/features/posts/api';

jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

const post = {
  id: 'post-1',
  body: 'Texto normal',
  title: null,
  createdAt: '2026-11-02T12:00:00Z',
  author: { id: 'user-1', handle: 'ana', displayName: 'Ana', avatarUrl: null },
  comuna: null,
  commentCount: 0,
  supportCount: 0,
  echoCount: 0,
  viewer: { isAuthor: true, canComment: true, canDelete: true, canRemove: false, saved: false, canPin: false, pinned: false, supported: false, echoed: false },
  topic: null,
  document: null,
  media: null,
  poll: null,
  mentions: [],
  event: null,
  topComment: null,
  topics: [],
};

describe('createPost', () => {
  it('envia tópicos vazios explícitos em publicação normal de perfil', async () => {
    jest.mocked(apiRequest).mockResolvedValue(post);
    await createPost({ comunaServerId: null, text: 'Texto normal' });
    expect(apiRequest).toHaveBeenCalledWith('/posts', expect.objectContaining({
      method: 'POST',
      auth: true,
      body: { comunaId: null, body: 'Texto normal', topics: [] },
    }));
  });
});
