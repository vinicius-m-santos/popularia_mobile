import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { setPostSaved } from '@/features/posts/api';
import { readSaved, resetSavedSession, toggleSavedPost } from '@/features/posts/save';
import { NetworkError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/posts/api', () => {
  const actual = jest.requireActual<typeof import('@/features/posts/api')>('@/features/posts/api');
  return { ...actual, setPostSaved: jest.fn() };
});
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ account: { id: 'me' } }) }));
const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));

function wrapper({ children }: { children: ReactNode }) {
  return <InteractionsProvider>{children}</InteractionsProvider>;
}

function feed(id: string, saved = false): FeedItem {
  return {
    id, authorId: 'ana', comunaId: null, createdAt: '2026-10-29T12:00:00Z', text: `Texto ${id}`,
    supportCount: 0, commentCount: 0, echoCount: 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null, event: null, topCommentAuthor: null,
  };
}

function pages(items: FeedItem[]) {
  return { pages: [{ items, nextCursor: null }], pageParams: [null] };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSavedSession();
  queryClient.clear();
  jest.mocked(setPostSaved).mockResolvedValue(undefined);
});

describe('salvar publicação', () => {
  it('mostra o estado do servidor sem um request por cartão', async () => {
    const { result } = await renderHook(() => usePostActions(feed('p1', true)), { wrapper });
    expect(result.current.saved).toBe(true);
    expect(setPostSaved).not.toHaveBeenCalled();
  });

  it('salva na hora, reflete nos outros cartões e desfaz se o servidor recusar', async () => {
    queryClient.setQueryData(['feed', 'para-voce', ''], pages([feed('p1')]));
    queryClient.setQueryData(['post', 'p1'], feed('p1'));
    queryClient.setQueryData(['saved-posts'], pages([]));
    const first = await renderHook(() => usePostActions(feed('p1')), { wrapper });
    const second = await renderHook(() => usePostActions(feed('p1')), { wrapper });

    await act(async () => { await first.result.current.toggleSave(); });
    expect(setPostSaved).toHaveBeenCalledWith('p1', true);
    expect(first.result.current.saved).toBe(true);
    expect(second.result.current.saved).toBe(true);
    expect(queryClient.getQueryData<FeedItem>(['post', 'p1'])?.viewer?.saved).toBe(true);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['saved-posts'])?.pages[0].items.map((item) => item.id)).toEqual(['p1']);

    jest.mocked(setPostSaved).mockRejectedValueOnce(new NetworkError());
    await act(async () => { await first.result.current.toggleSave(); });
    expect(first.result.current.saved).toBe(true);
    expect(second.result.current.saved).toBe(true);
    expect(mockShow).toHaveBeenCalled();
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['saved-posts'])?.pages[0].items).toHaveLength(1);
  });

  it('remove da biblioteca e dos outros cartões', async () => {
    queryClient.setQueryData(['feed', 'para-voce', ''], pages([feed('p1', true)]));
    queryClient.setQueryData(['profile-posts', 'ana'], pages([feed('p1', true)]));
    queryClient.setQueryData(['saved-posts'], pages([feed('p1', true)]));
    const { result } = await renderHook(() => usePostActions(feed('p1', true)), { wrapper });
    await act(async () => { await result.current.toggleSave(); });
    expect(setPostSaved).toHaveBeenCalledWith('p1', false);
    expect(result.current.saved).toBe(false);
    expect(readSaved('p1', true)).toBe(false);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['saved-posts'])?.pages[0].items).toEqual([]);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['feed', 'para-voce', ''])?.pages[0].items[0].viewer?.saved).toBe(false);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['profile-posts', 'ana'])?.pages[0].items[0].viewer?.saved).toBe(false);
  });

  it('ignora o segundo toque enquanto o primeiro ainda viaja', async () => {
    let resolve!: () => void;
    jest.mocked(setPostSaved).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });
    await act(async () => { void result.current.toggleSave(); void result.current.toggleSave(); });
    expect(setPostSaved).toHaveBeenCalledTimes(1);
    expect(result.current.saved).toBe(true);
    await act(async () => { resolve(); });
    expect(result.current.saved).toBe(true);
  });

  it('confirma o salvamento mesmo se o cartão já saiu da tela', async () => {
    let resolve!: () => void;
    jest.mocked(setPostSaved).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = await renderHook(() => usePostActions(feed('p1')), { wrapper });
    let action = Promise.resolve(false);
    await act(async () => { action = view.result.current.toggleSave(); });
    await view.unmount();
    await act(async () => { resolve(); await action; });
    expect(readSaved('p1')).toBe(true);
  });

  it('desfaz o salvamento se a falha chega sem o cartão na tela', async () => {
    jest.mocked(setPostSaved).mockRejectedValueOnce(new NetworkError());
    const notify = jest.fn();
    await act(async () => { await toggleSavedPost(feed('p2'), notify); });
    expect(readSaved('p2')).toBe(false);
    expect(notify).toHaveBeenCalled();
  });
});
