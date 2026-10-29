import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { listSavedPosts, setPostSaved } from '@/features/posts/api';
import { resetSavedSession } from '@/features/posts/save';
import { NetworkError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

import { LibraryPane } from '../library-screen';
import { SavedPostsPane, useSavedPosts } from '../saved-posts-pane';

const mockOpenPost = jest.fn();

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/posts/api', () => {
  const actual = jest.requireActual<typeof import('@/features/posts/api')>('@/features/posts/api');
  return { ...actual, listSavedPosts: jest.fn(), setPostSaved: jest.fn() };
});
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ account: { id: 'me', emailVerified: true } }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/routes', () => ({ useNav: () => ({ openPost: mockOpenPost, openProfile: jest.fn(), openComuna: jest.fn() }), goBack: jest.fn() }));
jest.mock('@/features/moderation/actions-sheet', () => ({ useActionsSheet: () => ({ open: jest.fn() }) }));

function feed(id: string, saved = true): FeedItem {
  return {
    id, authorId: 'ana', comunaId: null, createdAt: '2026-10-29T12:00:00Z', text: `Texto ${id}`,
    supportCount: 0, commentCount: 0, echoCount: 0, savedAt: '2026-10-29T18:00:00Z',
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null, event: null, topCommentAuthor: null,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <InteractionsProvider>{children}</InteractionsProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSavedSession();
  queryClient.clear();
  jest.mocked(setPostSaved).mockResolvedValue(undefined);
  jest.mocked(listSavedPosts).mockResolvedValue({ items: [], nextCursor: null });
});

describe('biblioteca de publicações salvas', () => {
  it('explica a lista vazia e separa salvos de documentos', async () => {
    await render(<LibraryPane scope="personal" initialSection="salvos" />, { wrapper });
    expect(await screen.findByText('Nada salvo ainda')).toBeTruthy();
    expect(screen.getByText('Salve publicações que você quer encontrar novamente.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Salvos' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Documentos' })).toBeTruthy();
  });

  it('carrega a página seguinte pelo cursor', async () => {
    jest.mocked(listSavedPosts)
      .mockResolvedValueOnce({ items: [feed('p1')], nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ items: [feed('p2')], nextCursor: null });
    const { result } = await renderHook(() => useSavedPosts(), { wrapper });
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['p1']));
    await act(async () => { result.current.loadMore(); });
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['p1', 'p2']));
    expect(listSavedPosts).toHaveBeenLastCalledWith('cursor-2', expect.any(AbortSignal));
  });

  it('abre a publicação e tira o item da lista na hora', async () => {
    jest.mocked(listSavedPosts).mockResolvedValue({ items: [feed('p1')], nextCursor: null });
    await render(<SavedPostsPane onShowDocuments={jest.fn()} />, { wrapper });
    await fireEvent.press(await screen.findByText('Texto p1'));
    expect(mockOpenPost).toHaveBeenCalledWith('p1');
    await fireEvent.press(screen.getByLabelText('Remover dos salvos'));
    await waitFor(() => expect(screen.queryByText('Texto p1')).toBeNull());
    expect(setPostSaved).toHaveBeenCalledWith('p1', false);
    expect(await screen.findByText('Nada salvo ainda')).toBeTruthy();
  });

  it('tenta de novo depois do erro', async () => {
    jest.mocked(listSavedPosts).mockRejectedValue(new NetworkError());
    await render(<SavedPostsPane onShowDocuments={jest.fn()} />, { wrapper });
    await screen.findByText('Tentar de novo', {}, { timeout: 4000 });
    jest.mocked(listSavedPosts).mockResolvedValue({ items: [], nextCursor: null });
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Nada salvo ainda')).toBeTruthy();
  });

  it('deixa de mostrar a publicação quando ela deixa de ser acessível', async () => {
    jest.mocked(listSavedPosts)
      .mockResolvedValueOnce({ items: [feed('secreta')], nextCursor: null })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    const { result } = await renderHook(() => useSavedPosts(), { wrapper });
    await waitFor(() => expect(result.current.items.map((item) => item.text)).toEqual(['Texto secreta']));
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.status).toBe('success');
  });
});
