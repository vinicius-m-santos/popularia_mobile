import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, renderHook } from '@testing-library/react-native';
import { Component, StrictMode, type ReactNode } from 'react';
import { Text } from 'react-native';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { knownPost, resetSavedSession } from '@/features/posts/save';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/posts/api', () => {
  const actual = jest.requireActual<typeof import('@/features/posts/api')>('@/features/posts/api');
  return { ...actual, setPostSaved: jest.fn(), setPostSupport: jest.fn(), setPostEcho: jest.fn() };
});
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ account: { id: 'me' } }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

/** O StrictMode repete renders e efeitos de montagem: o teste cobre os dois. */
function StrictWrapper({ children }: { children: ReactNode }) {
  return <StrictMode><InteractionsProvider>{children}</InteractionsProvider></StrictMode>;
}

function feed(id: string, overrides: { saved?: boolean; text?: string } = {}): FeedItem {
  return {
    id, authorId: 'ana', comunaId: null, createdAt: '2026-10-29T12:00:00Z', text: overrides.text ?? `Texto ${id}`,
    supportCount: 0, commentCount: 0, echoCount: 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved: overrides.saved ?? false },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null, event: null, topCommentAuthor: null,
  };
}

class AbortedBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <Text>render abortado</Text> : this.props.children;
  }
}

function AbortedRender({ post }: { post: FeedItem }): ReactNode {
  usePostActions(post);
  throw new Error('render abortado');
}

beforeEach(() => {
  resetSavedSession();
  queryClient.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('memorização do cartão em usePostActions', () => {
  it('não memoriza um render que não chega ao commit', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const post = feed('p1');

    await render(
      <AbortedBoundary>
        <AbortedRender post={post} />
      </AbortedBoundary>,
      { wrapper: StrictWrapper },
    );

    expect(knownPost('p1')).toBeUndefined();
    spy.mockRestore();
  });

  it('memoriza depois do commit, inclusive no StrictMode', async () => {
    const post = feed('p1', { saved: true });
    const { result } = await renderHook(() => usePostActions(post), { wrapper: StrictWrapper });

    expect(result.current.saved).toBe(true);
    expect(knownPost('p1')).toBe(post);
  });

  it('substitui o cartão memorizado quando o mesmo id é atualizado', async () => {
    const first = feed('p1', { saved: false, text: 'Versão inicial' });
    const updated = feed('p1', { saved: true, text: 'Versão atualizada' });
    const view = await renderHook(({ post }: { post: FeedItem }) => usePostActions(post), {
      initialProps: { post: first },
      wrapper: StrictWrapper,
    });

    expect(knownPost('p1')).toBe(first);

    await view.rerender({ post: updated });

    expect(knownPost('p1')).toBe(updated);
    expect(view.result.current.saved).toBe(true);
  });

  it('troca de id memoriza o novo cartão e atualiza o snapshot', async () => {
    const first = feed('p1', { saved: true });
    const next = feed('p2', { saved: false });
    const view = await renderHook(({ post }: { post: FeedItem }) => usePostActions(post), {
      initialProps: { post: first },
      wrapper: StrictWrapper,
    });

    await view.rerender({ post: next });

    expect(knownPost('p2')).toBe(next);
    expect(view.result.current.saved).toBe(false);
  });

  it('remonta com o cartão mais recente e mantém o cache de sessão após o unmount', async () => {
    const first = feed('p1', { saved: false });
    const view = await renderHook(() => usePostActions(first), { wrapper: StrictWrapper });

    expect(knownPost('p1')).toBe(first);

    await view.unmount();
    // O menu ainda pode consultar o cartão depois que o cartão saiu da lista;
    // a entrada só é substituída por uma versão mais nova do mesmo id.
    expect(knownPost('p1')).toBe(first);

    const updated = feed('p1', { saved: true, text: 'Depois da remontagem' });
    const remounted = await renderHook(() => usePostActions(updated), { wrapper: StrictWrapper });

    expect(knownPost('p1')).toBe(updated);
    expect(remounted.result.current.saved).toBe(true);
  });
});
