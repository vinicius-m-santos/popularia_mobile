import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { queryClient } from '@/lib/query/client';

import { invalidateAfterPostCreated, invalidateAfterPostDeleted } from '../invalidation';

function keysFrom(calls: unknown[][], field: 'queryKey'): unknown[][] {
  return calls.map((call) => (call[0] as Record<typeof field, unknown[]>)[field]);
}

beforeEach(() => { queryClient.clear(); });
afterEach(() => { queryClient.clear(); });

describe('invalidação de publicação', () => {
  it('publicar atinge feed, perfil de quem publicou e as comunas de destino, sem outras pessoas/comunas', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve());
    invalidateAfterPostCreated({ author: 'ana', comunaIds: ['hortas', null, 'hortas', 'vila'] });
    expect(keysFrom(invalidate.mock.calls, 'queryKey')).toEqual([
      ['feed'],
      ['profile-posts', 'ana'],
      ['comuna', 'hortas', 'posts'],
      ['comuna', 'vila', 'posts'],
      ['discovery'],
      ['search'],
    ]);
    invalidate.mockRestore();
  });

  it('sem autoria conhecida, a invalidação de perfil é ampla como antes', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve());
    invalidateAfterPostCreated({ comunaIds: [] });
    expect(keysFrom(invalidate.mock.calls, 'queryKey')).toContainEqual(['profile-posts']);
    invalidate.mockRestore();
  });

  it('excluir remove o detalhe/preview e invalida as listas que poderiam mostrar a publicação', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve());
    const remove = jest.spyOn(queryClient, 'removeQueries').mockImplementation(() => undefined);
    invalidateAfterPostDeleted({ postId: 'p1', author: 'ana', comunaId: 'hortas' });
    expect(remove.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey)).toEqual([
      ['post', 'p1'],
      ['post-preview', 'p1'],
    ]);
    expect(keysFrom(invalidate.mock.calls, 'queryKey')).toEqual([
      ['feed'],
      ['profile-posts', 'ana'],
      ['comuna', 'hortas', 'posts'],
      ['comuna', 'hortas', 'pins'],
      ['topic-posts'],
      ['discovery'],
      ['search'],
    ]);
    invalidate.mockRestore();
    remove.mockRestore();
  });
});
