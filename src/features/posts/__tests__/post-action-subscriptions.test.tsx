import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { setPostEcho, setPostSaved, setPostSupport } from '@/features/posts/api';
import { readReactionSnapshot, resetReactionSession, subscribePostReactions, writeReaction } from '@/features/posts/reactions';
import { readSavedSnapshot, resetSavedSession, subscribeSavedPost, toggleSavedPost } from '@/features/posts/save';
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

function feed(id: string, saved = false): FeedItem {
  return {
    id, authorId: 'ana', comunaId: null, createdAt: '2026-10-29T12:00:00Z', text: `Texto ${id}`,
    supportCount: 0, commentCount: 0, echoCount: 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null, event: null, topCommentAuthor: null,
  };
}

function confirmedSupport(id: string, active: boolean): FeedItem {
  return { ...feed(id), supportCount: active ? 1 : 0, viewer: { ...feed(id).viewer!, supported: active } };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSavedSession();
  resetReactionSession();
  queryClient.clear();
  jest.mocked(setPostSaved).mockResolvedValue(undefined);
  jest.mocked(setPostSupport).mockImplementation(async (id, active) => confirmedSupport(id, active));
  jest.mocked(setPostEcho).mockImplementation(async (id, active) => ({
    ...feed(id),
    echoCount: active ? 1 : 0,
    viewer: { ...feed(id).viewer!, echoed: active },
  }));
});

describe('assinaturas por publicação', () => {
  it('ao salvar, notifica só os listeners do post alterado', async () => {
    const changed = jest.fn();
    const untouched = jest.fn();
    const unsubscribeChanged = subscribeSavedPost('p1', changed);
    const unsubscribeUntouched = subscribeSavedPost('p2', untouched);

    await act(async () => { await toggleSavedPost(feed('p1'), mockShow); });

    expect(changed).toHaveBeenCalled();
    expect(untouched).not.toHaveBeenCalled();
    const snapshot = readSavedSnapshot('p1');
    expect(snapshot).toBe(true);
    expect(readSavedSnapshot('p1')).toBe(snapshot);
    expect(readSavedSnapshot('p2')).toBeUndefined();

    unsubscribeChanged();
    unsubscribeUntouched();
  });

  it('notifica só o post alterado e mantém o snapshot de reações estável', () => {
    const p1 = jest.fn();
    const p2 = jest.fn();
    subscribePostReactions('p1', p1);
    subscribePostReactions('p2', p2);

    expect(readReactionSnapshot('p1')).toBeUndefined();
    writeReaction('p1', 'support', { count: 1, mine: true });
    const snapshot = readReactionSnapshot('p1');
    expect(snapshot).toEqual({ support: { count: 1, mine: true } });
    expect(readReactionSnapshot('p1')).toBe(snapshot);
    expect(p1).toHaveBeenCalledTimes(1);
    expect(p2).not.toHaveBeenCalled();

    // A confirmação do servidor com o mesmo valor não troca a referência nem notifica.
    p1.mockClear();
    writeReaction('p1', 'support', { count: 1, mine: true });
    expect(readReactionSnapshot('p1')).toBe(snapshot);
    expect(p1).not.toHaveBeenCalled();

    // Outro post mudando não altera a referência deste.
    writeReaction('p2', 'echo', { count: 2, mine: true });
    expect(readReactionSnapshot('p1')).toBe(snapshot);
    expect(p1).not.toHaveBeenCalled();
    expect(p2).toHaveBeenCalledTimes(1);
  });

  it('cancela a assinatura de forma idempotente sem derrubar outro listener', () => {
    const removed = jest.fn();
    const kept = jest.fn();
    const unsubscribeRemoved = subscribePostReactions('p1', removed);
    const unsubscribeKept = subscribePostReactions('p1', kept);

    unsubscribeRemoved();
    unsubscribeRemoved();

    writeReaction('p1', 'support', { count: 1, mine: true });
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);

    unsubscribeKept();
    unsubscribeKept();
    writeReaction('p1', 'support', { count: 2, mine: true });
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('o reset da sessão avisa todos os posts e zera os snapshots', () => {
    const p1 = jest.fn();
    const p2 = jest.fn();
    const unsubscribeOne = subscribePostReactions('p1', p1);
    const unsubscribeTwo = subscribePostReactions('p2', p2);
    writeReaction('p1', 'support', { count: 1, mine: true });
    writeReaction('p2', 'echo', { count: 1, mine: true });
    p1.mockClear();
    p2.mockClear();

    resetReactionSession();

    expect(p1).toHaveBeenCalledTimes(1);
    expect(p2).toHaveBeenCalledTimes(1);
    expect(readReactionSnapshot('p1')).toBeUndefined();
    expect(readReactionSnapshot('p2')).toBeUndefined();
    unsubscribeOne();
    unsubscribeTwo();
  });

  it('um cartão não renderiza quando outro post muda de estado', async () => {
    let rendersOne = 0;
    let rendersTwo = 0;
    const first = await renderHook(() => { rendersOne += 1; return usePostActions(feed('p1')); }, { wrapper });
    const second = await renderHook(() => { rendersTwo += 1; return usePostActions(feed('p2')); }, { wrapper });
    const beforeFirst = rendersOne;
    const beforeSecond = rendersTwo;

    await act(async () => { await first.result.current.toggleSupport(); });

    expect(rendersOne).toBeGreaterThan(beforeFirst);
    expect(rendersTwo).toBe(beforeSecond);
    expect(first.result.current.supported).toBe(true);
    expect(second.result.current.supportCount).toBe(0);

    await act(async () => { await second.result.current.toggleSave(); });

    expect(rendersOne).toBeGreaterThan(beforeFirst);
    expect(rendersTwo).toBeGreaterThan(beforeSecond);
    expect(first.result.current.saved).toBe(false);
    expect(second.result.current.saved).toBe(true);
  });

  it('ecoa um post sem tocar no outro', async () => {
    const first = await renderHook(() => usePostActions(feed('p1')), { wrapper });
    const second = await renderHook(() => usePostActions(feed('p2')), { wrapper });

    await act(async () => { await first.result.current.toggleEcho(); });

    expect(setPostEcho).toHaveBeenCalledWith('p1', true);
    expect(first.result.current.echoed).toBe(true);
    expect(first.result.current.echoCount).toBe(1);
    expect(second.result.current.echoed).toBe(false);
    expect(second.result.current.echoCount).toBe(0);
  });

  it('troca de postId, desmonta e não continua assinando o cartão anterior', async () => {
    let renders = 0;
    const view = await renderHook(
      ({ post }: { post: FeedItem }) => { renders += 1; return usePostActions(post); },
      { initialProps: { post: feed('p1') }, wrapper },
    );

    await view.rerender({ post: feed('p2') });
    const afterSwitch = renders;

    await act(async () => { writeReaction('p1', 'support', { count: 9, mine: true }); });
    expect(renders).toBe(afterSwitch);
    expect(view.result.current.supported).toBe(false);

    await act(async () => { writeReaction('p2', 'support', { count: 2, mine: true }); });
    expect(renders).toBe(afterSwitch + 1);
    expect(view.result.current.supportCount).toBe(2);

    await view.unmount();
    expect(() => writeReaction('p2', 'support', { count: 3, mine: true })).not.toThrow();
  });

  it('mostra o apoio otimista e desfaz tudo se a rede falhar', async () => {
    let reject!: (error: unknown) => void;
    jest.mocked(setPostSupport).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    const { result } = await renderHook(() => usePostActions(feed('p1')), { wrapper });
    const unsubscribe = subscribePostReactions('p1', jest.fn());

    let action = Promise.resolve();
    await act(async () => { action = result.current.toggleSupport(); });
    expect(result.current.supported).toBe(true);
    expect(result.current.supportCount).toBe(1);

    await act(async () => {
      reject(new NetworkError());
      await action;
    });

    expect(result.current.supported).toBe(false);
    expect(result.current.supportCount).toBe(0);
    expect(mockShow).toHaveBeenCalled();
    expect(readReactionSnapshot('p1')).toEqual({ support: { count: 0, mine: false } });
    unsubscribe();
  });
});
