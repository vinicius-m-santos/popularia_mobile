import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { setPostEcho, setPostSaved, setPostSupport } from '@/features/posts/api';
import { patchReactionCaches, readReactionSnapshot, resetReactionSession, subscribePostReactions } from '@/features/posts/reactions';
import { readSaved, resetSavedSession, subscribeSavedPost, toggleSavedPost } from '@/features/posts/save';
import { NetworkError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/posts/api', () => {
  const actual = jest.requireActual<typeof import('@/features/posts/api')>('@/features/posts/api');
  return { ...actual, setPostSaved: jest.fn(), setPostSupport: jest.fn(), setPostEcho: jest.fn() };
});
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ account: { id: 'me' } }) }));
jest.mock('@/features/gamification/feedback', () => ({ acknowledgeGamification: jest.fn() }));
const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));

function wrapper({ children }: { children: ReactNode }) {
  return <InteractionsProvider>{children}</InteractionsProvider>;
}

function feed(id: string, overrides: { saved?: boolean; support?: number; echo?: number } = {}): FeedItem {
  return {
    id, authorId: 'ana', comunaId: null, createdAt: '2026-10-29T12:00:00Z', text: `Texto ${id}`,
    supportCount: overrides.support ?? 0, commentCount: 0, echoCount: overrides.echo ?? 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved: overrides.saved ?? false },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null, event: null, topCommentAuthor: null,
  };
}

function pages(...items: FeedItem[][]) {
  return {
    pages: items.map((page, index) => ({ items: page, nextCursor: index === items.length - 1 ? null : `cursor-${index}` })),
    pageParams: items.map((_, index) => index === 0 ? null : `cursor-${index - 1}`),
  };
}

function confirmedSupport(id: string, active: boolean, count = active ? 1 : 0): FeedItem {
  return { ...feed(id, { support: count }), viewer: { ...feed(id).viewer!, supported: active } };
}

function confirmedEcho(id: string, active: boolean, count = active ? 1 : 0): FeedItem {
  return { ...feed(id, { echo: count }), viewer: { ...feed(id).viewer!, echoed: active } };
}

function savedIds(): string[] {
  const data = queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['saved-posts']);
  return data?.pages.flatMap((page) => page.items.map((item) => item.id)) ?? [];
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSavedSession();
  resetReactionSession();
  queryClient.clear();
  jest.mocked(setPostSaved).mockResolvedValue(undefined);
  jest.mocked(setPostSupport).mockImplementation(async (id, active) => confirmedSupport(id, active));
  jest.mocked(setPostEcho).mockImplementation(async (id, active) => confirmedEcho(id, active));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('notificações observáveis', () => {
  it('apoia com uma notificação, sem acordar nos lock/unlock e sem repetir a confirmação', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribePostReactions('p1', listener);
    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });

    await act(async () => { await result.current.toggleSupport(); });

    expect(result.current.supported).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('salva com uma notificação por mudança real', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSavedPost('p1', listener);

    await act(async () => { await toggleSavedPost(feed('p1'), mockShow); });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(readSaved('p1')).toBe(true);
    unsubscribe();
  });

  it('uma falha notifica a ida otimista e a volta, nada além disso', async () => {
    jest.mocked(setPostSupport).mockRejectedValueOnce(new NetworkError());
    const listener = jest.fn();
    const unsubscribe = subscribePostReactions('p1', listener);
    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });

    await act(async () => { await result.current.toggleSupport(); });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(result.current.supported).toBe(false);
    expect(readReactionSnapshot('p1')).toEqual({ support: { count: 0, mine: false } });
    unsubscribe();
  });
});

describe('escritas de cache', () => {
  it('apoia só as queries que contêm o post, uma vez cada', async () => {
    const feedKey = ['feed', 'para-voce', ''];
    const otherFeedKey = ['feed', 'seguindo', ''];
    const profileKey = ['profile-posts', 'ana'];
    const detailKey = ['post', 'p1'];
    const savedKey = ['saved-posts'];
    queryClient.setQueryData(feedKey, pages([feed('p1')]));
    queryClient.setQueryData(otherFeedKey, pages([feed('p2')]));
    queryClient.setQueryData(profileKey, pages([feed('p1')]));
    queryClient.setQueryData(detailKey, feed('p1'));
    queryClient.setQueryData(savedKey, pages([feed('p1')]));
    const otherBefore = queryClient.getQueryData(otherFeedKey);
    const spy = jest.spyOn(queryClient, 'setQueryData');

    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });
    await act(async () => { await result.current.toggleSupport(); });

    expect(spy).toHaveBeenCalledTimes(4);
    expect(queryClient.getQueryData<FeedItem>(detailKey)?.supportCount).toBe(1);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(feedKey)?.pages[0].items[0].viewer?.supported).toBe(true);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(profileKey)?.pages[0].items[0].viewer?.supported).toBe(true);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(savedKey)?.pages[0].items[0].supportCount).toBe(1);
    expect(queryClient.getQueryData(otherFeedKey)).toBe(otherBefore);
    expect(spy.mock.calls.some(([key]) => JSON.stringify(key) === JSON.stringify(otherFeedKey))).toBe(false);
  });

  it('não escreve quando o patch não muda o valor', async () => {
    queryClient.setQueryData(['post', 'p1'], confirmedSupport('p1', true, 1));
    const spy = jest.spyOn(queryClient, 'setQueryData');

    const changed = patchReactionCaches('p1', 'support', { count: 1, mine: true });

    expect(changed).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('confirmação com contagem diferente atualiza store e listas', async () => {
    jest.mocked(setPostSupport).mockResolvedValueOnce(confirmedSupport('p1', true, 9));
    queryClient.setQueryData(['post', 'p1'], feed('p1'));
    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });

    await act(async () => { await result.current.toggleSupport(); });

    expect(result.current.supportCount).toBe(9);
    expect(queryClient.getQueryData<FeedItem>(['post', 'p1'])?.supportCount).toBe(9);
  });

  it('salva só as queries afetadas e não redispara a lista de outro post', async () => {
    const feedKey = ['feed', 'para-voce', ''];
    const otherFeedKey = ['feed', 'seguindo', ''];
    const profileKey = ['profile-posts', 'ana'];
    const detailKey = ['post', 'p1'];
    queryClient.setQueryData(feedKey, pages([feed('p1')]));
    queryClient.setQueryData(otherFeedKey, pages([feed('p2')]));
    queryClient.setQueryData(profileKey, pages([feed('p1')]));
    queryClient.setQueryData(detailKey, feed('p1'));
    queryClient.setQueryData(['saved-posts'], pages([]));
    const otherBefore = queryClient.getQueryData(otherFeedKey);
    const spy = jest.spyOn(queryClient, 'setQueryData');

    await act(async () => { await toggleSavedPost(feed('p1'), mockShow); });

    expect(spy).toHaveBeenCalledTimes(4);
    expect(queryClient.getQueryData(otherFeedKey)).toBe(otherBefore);
    expect(queryClient.getQueryData<FeedItem>(detailKey)?.viewer?.saved).toBe(true);
    expect(savedIds()).toEqual(['p1']);
  });

  it('prepend na lista de salvos preserva as páginas seguintes', async () => {
    const secondPage = { items: [feed('p3', { saved: true })], nextCursor: null };
    const firstPage = { items: [feed('p2', { saved: true })], nextCursor: 'cursor-1' };
    queryClient.setQueryData(['saved-posts'], { pages: [firstPage, secondPage], pageParams: [null, 'cursor-1'] });

    await act(async () => { await toggleSavedPost(feed('p1'), mockShow); });

    const after = queryClient.getQueryData<{ pages: unknown[] }>(['saved-posts']);
    expect(savedIds()).toEqual(['p1', 'p2', 'p3']);
    expect(after?.pages[1]).toBe(secondPage);
  });

  it('atualiza o post em todas as páginas e feeds que o contêm sem mudar a ordem', async () => {
    const firstPage = { items: [feed('p1'), feed('p2')], nextCursor: 'cursor-1' };
    const secondPage = { items: [feed('p3'), feed('p1')], nextCursor: null };
    const feedKey = ['feed', 'para-voce', ''];
    const followingKey = ['feed', 'seguindo', ''];
    queryClient.setQueryData(feedKey, { pages: [firstPage, secondPage], pageParams: [null, 'cursor-1'] });
    queryClient.setQueryData(followingKey, pages([feed('p1')]));

    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });
    await act(async () => { await result.current.toggleSupport(); });

    const after = queryClient.getQueryData<{ pages: { items: FeedItem[]; nextCursor: string | null }[] }>(feedKey);
    expect(after?.pages).toHaveLength(2);
    // O item alterado muda nos dois feeds; os vizinhos continuam com a mesma referência.
    expect(after?.pages[0].items[0].viewer?.supported).toBe(true);
    expect(after?.pages[0].items[1]).toBe(firstPage.items[1]);
    expect(after?.pages[1].items[0]).toBe(secondPage.items[0]);
    expect(after?.pages[1].items[1].viewer?.supported).toBe(true);
    expect(after?.pages[0].nextCursor).toBe('cursor-1');
    expect(after?.pages[1].nextCursor).toBeNull();
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(followingKey)?.pages[0].items[0].viewer?.supported).toBe(true);
  });

  it('rollback do apoio não sobrescreve um valor mais novo vindo de refetch', () => {
    queryClient.setQueryData(['post', 'p1'], confirmedSupport('p1', true, 5));

    // A resposta otimista era 1/true; o refetch já trouxe 5/true. O rollback
    // antigo não pode desfazer esse valor mais novo.
    const changed = patchReactionCaches('p1', 'support', { count: 0, mine: false }, { onlyIf: { count: 1, mine: true } });

    expect(changed).toBe(0);
    const detail = queryClient.getQueryData<FeedItem>(['post', 'p1']);
    expect(detail?.supportCount).toBe(5);
    expect(detail?.viewer?.supported).toBe(true);
  });
});

describe('concorrência e rollback', () => {
  it('falha de apoio não desfaz um eco concluído em paralelo', async () => {
    let rejectSupport!: (error: unknown) => void;
    jest.mocked(setPostSupport).mockImplementationOnce(() => new Promise((_, fail) => { rejectSupport = fail; }));
    const feedKey = ['feed', 'para-voce', ''];
    const profileKey = ['profile-posts', 'ana'];
    const detailKey = ['post', 'p1'];
    const savedKey = ['saved-posts'];
    queryClient.setQueryData(feedKey, pages([feed('p1')]));
    queryClient.setQueryData(profileKey, pages([feed('p1')]));
    queryClient.setQueryData(detailKey, feed('p1'));
    queryClient.setQueryData(savedKey, pages([feed('p1')]));
    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });

    let supportAction = Promise.resolve();
    await act(async () => { supportAction = result.current.toggleSupport(); });
    await act(async () => { await result.current.toggleEcho(); });

    expect(result.current.echoed).toBe(true);
    expect(result.current.echoCount).toBe(1);

    await act(async () => {
      rejectSupport(new NetworkError());
      await supportAction;
    });

    expect(result.current.supported).toBe(false);
    expect(result.current.echoed).toBe(true);
    expect(result.current.echoCount).toBe(1);
    const cached = queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(feedKey)?.pages[0].items[0];
    expect(cached?.viewer?.supported).toBe(false);
    expect(cached?.viewer?.echoed).toBe(true);
    expect(cached?.echoCount).toBe(1);
    const detail = queryClient.getQueryData<FeedItem>(detailKey);
    expect(detail?.viewer?.supported).toBe(false);
    expect(detail?.viewer?.echoed).toBe(true);
    const profile = queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(profileKey)?.pages[0].items[0];
    expect(profile?.viewer?.supported).toBe(false);
    expect(profile?.viewer?.echoed).toBe(true);
    const saved = queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(savedKey)?.pages[0].items[0];
    expect(saved?.viewer?.supported).toBe(false);
    expect(saved?.viewer?.echoed).toBe(true);
  });

  it('falha de salvamento não desfaz o salvamento de outro post', async () => {
    let rejectFirst!: (error: unknown) => void;
    jest.mocked(setPostSaved).mockImplementationOnce(() => new Promise((_, fail) => { rejectFirst = fail; }));
    queryClient.setQueryData(['feed', 'para-voce', ''], pages([feed('p1'), feed('p2')]));
    queryClient.setQueryData(['saved-posts'], pages([]));
    const notify = jest.fn();

    let firstAction = Promise.resolve(false);
    await act(async () => { firstAction = toggleSavedPost(feed('p1'), notify); });
    await act(async () => { await toggleSavedPost(feed('p2'), notify); });
    // p1 segue otimista enquanto a requisição dele não voltou.
    expect(savedIds()).toEqual(['p2', 'p1']);

    await act(async () => {
      rejectFirst(new NetworkError());
      await firstAction;
    });

    expect(savedIds()).toEqual(['p2']);
    expect(readSaved('p1')).toBe(false);
    expect(readSaved('p2')).toBe(true);
    const items = queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['feed', 'para-voce', ''])?.pages[0].items;
    expect(items?.find((item) => item.id === 'p1')?.viewer?.saved).toBe(false);
    expect(items?.find((item) => item.id === 'p2')?.viewer?.saved).toBe(true);
  });

  it('falha de salvamento reverte feed, perfil, detalhe e salvos', async () => {
    jest.mocked(setPostSaved).mockRejectedValueOnce(new NetworkError());
    const feedKey = ['feed', 'para-voce', ''];
    const profileKey = ['profile-posts', 'ana'];
    const detailKey = ['post', 'p1'];
    queryClient.setQueryData(feedKey, pages([feed('p1', { saved: true })]));
    queryClient.setQueryData(profileKey, pages([feed('p1', { saved: true })]));
    queryClient.setQueryData(detailKey, feed('p1', { saved: true }));
    queryClient.setQueryData(['saved-posts'], pages([feed('p1', { saved: true })]));
    const notify = jest.fn();

    await act(async () => { await toggleSavedPost(feed('p1', { saved: true }), notify); });

    expect(readSaved('p1')).toBe(true);
    expect(savedIds()).toEqual(['p1']);
    expect(queryClient.getQueryData<FeedItem>(detailKey)?.viewer?.saved).toBe(true);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(feedKey)?.pages[0].items[0].viewer?.saved).toBe(true);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(profileKey)?.pages[0].items[0].viewer?.saved).toBe(true);
    expect(notify).toHaveBeenCalled();
  });

  it('dois toques rápidos no apoio geram uma requisição e depois permitem alternar de novo', async () => {
    let resolveSupport!: (item: FeedItem) => void;
    jest.mocked(setPostSupport).mockImplementationOnce(() => new Promise((resolve) => { resolveSupport = resolve; }));
    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });

    let action = Promise.resolve();
    await act(async () => {
      action = result.current.toggleSupport();
      void result.current.toggleSupport();
    });

    expect(setPostSupport).toHaveBeenCalledTimes(1);
    expect(result.current.supported).toBe(true);

    await act(async () => {
      resolveSupport(confirmedSupport('p1', true));
      await action;
    });
    expect(result.current.supported).toBe(true);

    await act(async () => { await result.current.toggleSupport(); });
    expect(setPostSupport).toHaveBeenCalledTimes(2);
    expect(result.current.supported).toBe(false);
  });
});
