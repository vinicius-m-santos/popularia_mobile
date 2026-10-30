import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { ActionsSheetProvider, useActionsSheet } from '@/features/moderation/actions-sheet';
import { postTarget } from '@/features/moderation/targets';
import { rememberPost, resetSavedSession } from '@/features/posts/save';
import { apiRequest } from '@/lib/api/client';
import type { PostDto } from '@/lib/api/dto';
import { ApiError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

import { getPinnedPosts } from '../api';
import { PinnedPosts } from '../components/pinned-posts';
import { movePinnedPost, pinPost, pinnedPostsKey, readPinned, resetPinSession, unpinPost } from '../pins';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, API_BASE_URL: 'http://api.test/api/v1' }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));
jest.mock('@/components/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextInput, View } = require('react-native') as typeof import('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement(View, null, children) : null,
    PopulariaBottomSheetTextInput: (props: Record<string, unknown>) => React.createElement(TextInput, props),
  };
});

const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me', handle: 'eu', name: 'Eu' }) }));
jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({ isOn: () => false, toggle: () => false, setOn: () => undefined }),
}));
jest.mock('@/features/moderation/moderation-context', () => ({ useModeration: () => ({ submitReport: jest.fn() }) }));
jest.mock('@/features/lookup', () => ({ findComuna: () => null }));
jest.mock('@/lib/routes', () => ({ useNav: () => ({ openComuna: jest.fn(), openPost: jest.fn() }), openModeration: jest.fn() }));
jest.mock('@/features/links/share', () => ({ shareDestination: jest.fn() }));
jest.mock('@/features/links/destinations', () => ({ canonicalUrl: () => 'https://popularia.test/p' }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const api = jest.mocked(apiRequest);

function item(id: string, text = `Texto ${id}`, patch: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    authorId: 'ana',
    comunaId: 'hortas',
    createdAt: '2026-10-29T12:00:00Z',
    text,
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    author: { id: 'ana', name: 'Ana Souza', handle: 'ana', initials: 'AS', tone: 'red' },
    comuna: { id: 'hortas', name: 'Hortas', status: 'active' },
    event: null,
    topCommentAuthor: null,
    ...patch,
    viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false, canPin: true, pinned: false, ...patch.viewer },
  };
}

function dto(id: string, body: string, pinned = true): PostDto {
  return {
    id,
    body,
    createdAt: '2026-10-29T12:00:00+00:00',
    author: { id: 'ana', handle: 'ana', displayName: 'Ana Souza' },
    comuna: { id: 'u1', slug: 'hortas', name: 'Hortas', status: 'active' },
    commentCount: 1,
    mentions: [],
    poll: null,
    viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false, canPin: true, pinned },
  };
}

function MenuOpener({ post }: { post: FeedItem }) {
  const sheet = useActionsSheet();
  return <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={() => sheet.open(postTarget(post))} />;
}

async function renderMenu(post: FeedItem) {
  rememberPost(post);
  const tree = ({ children }: { children: ReactNode }) => <ActionsSheetProvider>{children}</ActionsSheetProvider>;
  await render(<MenuOpener post={post} />, { wrapper: tree });
  await fireEvent.press(screen.getByLabelText('Abrir menu'));
}

beforeEach(() => {
  queryClient.setDefaultOptions({ queries: { gcTime: Infinity, retry: false } });
  queryClient.clear();
  resetPinSession();
  resetSavedSession();
  mockShow.mockReset();
  api.mockReset();
});

afterEach(() => {
  queryClient.clear();
});

describe('seção Fixados', () => {
  it('não mostra a seção quando não há fixados', async () => {
    await render(<PinnedPosts items={[]} onOpen={jest.fn()} />);
    expect(screen.queryByText('Fixados')).toBeNull();
  });

  it('mostra um fixado e abre a publicação', async () => {
    const onOpen = jest.fn();
    await render(<PinnedPosts items={[item('p1', 'Próxima reunião da comuna')]} onOpen={onOpen} />);
    expect(screen.getByText('Fixados')).toBeTruthy();
    expect(screen.getByText('Fixado 01')).toBeTruthy();
    expect(screen.getByText('Próxima reunião da comuna')).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Fixado 01/ }));
    expect(onOpen).toHaveBeenCalledWith('p1');
  });

  it('mostra três fixados na ordem recebida, com alvos de toque', async () => {
    const onMove = jest.fn();
    await render(
      <PinnedPosts
        canReorder
        items={[item('c', 'Campanha atual'), item('b', 'Próxima reunião'), item('a', 'Regras da comuna')]}
        onOpen={jest.fn()}
        onMove={onMove}
      />,
    );
    const labels = screen.getAllByText(/Fixado 0/).map((node) => node.props.children);
    expect(labels).toEqual(['Fixado 01', 'Fixado 02', 'Fixado 03']);
    expect(screen.getByText('Campanha atual')).toBeTruthy();
    expect(screen.queryByLabelText('Mover fixado 01 para cima')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Mover fixado 01 para baixo'));
    expect(onMove).toHaveBeenCalledWith('c', 2);
    await fireEvent.press(screen.getByLabelText('Mover fixado 03 para cima'));
    expect(onMove).toHaveBeenCalledWith('a', 2);
    expect(screen.getByRole('button', { name: /Fixado 02/ })).toBeTruthy();
  });

  it('explica a falha de leitura e não mostra publicação removida que não veio na lista', async () => {
    const onRetry = jest.fn();
    await render(<PinnedPosts items={[]} status="error" onRetry={onRetry} onOpen={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Não conseguimos carregar as publicações fixadas. Tentar de novo'));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.queryByText('Publicação apagada')).toBeNull();
  });

  it('enquanto carrega e ainda não há itens, não ocupa o topo', async () => {
    await render(<PinnedPosts items={[]} status="loading" onOpen={jest.fn()} />);
    expect(screen.queryByText('Fixados')).toBeNull();
  });
});

describe('menu Fixar', () => {
  it('mostra Fixar para quem pode e esconde para quem não pode', async () => {
    await renderMenu(item('p1'));
    expect(screen.getByText('Fixar publicação')).toBeTruthy();
    await screen.unmount();
    await renderMenu(item('p2', 'Comum', { viewer: { isAuthor: false, canComment: true, canDelete: false, canPin: false } }));
    expect(screen.queryByText('Fixar publicação')).toBeNull();
    expect(screen.queryByText('Desafixar publicação')).toBeNull();
  });

  it('mostra Desafixar quando a publicação já está fixada', async () => {
    await renderMenu(item('p1', 'Aviso', { viewer: { isAuthor: false, canComment: true, canDelete: false, canPin: true, pinned: true } }));
    expect(screen.getByText('Desafixar publicação')).toBeTruthy();
    expect(screen.queryByText('Fixar publicação')).toBeNull();
  });
});

describe('cache de fixados', () => {
  it('lê os fixados num único pedido da comuna', async () => {
    api.mockResolvedValueOnce({ items: [dto('p1', 'Regras')], nextCursor: null });
    await expect(getPinnedPosts('hortas')).resolves.toMatchObject([{ id: 'p1', text: 'Regras', viewer: { pinned: true, canPin: true } }]);
    expect(api).toHaveBeenCalledWith('/comunas/hortas/pinned-posts', { auth: true });
  });

  it('fixa, atualiza só a comuna e a publicação, e não mexe no feed', async () => {
    const post = item('p9', 'Campanha atual');
    const feed = { pages: [{ items: [post], nextCursor: null }], pageParams: [null] };
    queryClient.setQueryData(['feed', 'para-voce', ''], feed);
    queryClient.setQueryData(['post', 'p9'], post);
    queryClient.setQueryData(pinnedPostsKey('hortas'), [item('p1', 'Regras')]);
    api.mockResolvedValueOnce({ items: [dto('p9', 'Campanha atual'), dto('p1', 'Regras')], nextCursor: null });

    await act(async () => { await pinPost(post, mockShow); });

    expect(api).toHaveBeenCalledWith('/comunas/hortas/pinned-posts/p9', { method: 'PUT', auth: true });
    expect(queryClient.getQueryData<FeedItem[]>(pinnedPostsKey('hortas'))?.map((pin) => pin.id)).toEqual(['p9', 'p1']);
    expect(queryClient.getQueryData<FeedItem>(['post', 'p9'])?.viewer?.pinned).toBe(true);
    expect(queryClient.getQueryData(['feed', 'para-voce', ''])).toBe(feed);
    expect(feed.pages[0].items[0].viewer?.pinned).toBe(false);
    expect(readPinned('p9')).toBe(true);
  });

  it('desfaz o palpite quando o servidor recusa o quarto fixado', async () => {
    const current = [item('a', 'Um'), item('b', 'Dois'), item('c', 'Três')];
    queryClient.setQueryData(pinnedPostsKey('hortas'), current);
    api.mockRejectedValueOnce(new ApiError(409, '/errors/comuna-pin-limit', 'Esta comuna já tem 3 publicações fixadas.'));

    await act(async () => { await pinPost(item('d', 'Quatro'), mockShow); });

    expect(mockShow).toHaveBeenCalledWith('Esta comuna já tem 3 publicações fixadas.');
    expect(queryClient.getQueryData<FeedItem[]>(pinnedPostsKey('hortas'))?.map((pin) => pin.id)).toEqual(['a', 'b', 'c']);
  });

  it('desfaz a lista se a rede falha e ignora um segundo toque enquanto o primeiro viaja', async () => {
    queryClient.setQueryData(pinnedPostsKey('hortas'), [item('a', 'Um')]);
    let resolve: (value: { items: PostDto[]; nextCursor: null }) => void = () => undefined;
    api.mockImplementationOnce(() => new Promise((done) => { resolve = done as typeof resolve; }));
    const post = item('b', 'Dois');
    let first: Promise<boolean> = Promise.resolve(false);
    await act(async () => { first = pinPost(post, mockShow); await Promise.resolve(); });
    expect(queryClient.getQueryData<FeedItem[]>(pinnedPostsKey('hortas'))?.map((pin) => pin.id)).toEqual(['b', 'a']);
    await act(async () => { await pinPost(post, mockShow); });
    expect(api).toHaveBeenCalledTimes(1);
    api.mockRejectedValueOnce(new Error('rede'));
    await act(async () => {
      resolve({ items: [], nextCursor: null });
      await first;
    });
    // A resposta confirmou a lista vazia que o servidor devolveu.
    expect(queryClient.getQueryData<FeedItem[]>(pinnedPostsKey('hortas'))).toEqual([]);

    api.mockRejectedValueOnce(new Error('rede'));
    await act(async () => { await unpinPost(item('a', 'Um', { viewer: { isAuthor: false, canComment: true, canDelete: false, canPin: true, pinned: true } }), mockShow); });
    expect(mockShow).toHaveBeenCalledWith('Não conseguimos atualizar as publicações fixadas. Tente novamente.');
  });

  it('move e desafixa sem invalidar o feed', async () => {
    const feed = { pages: [{ items: [item('a')], nextCursor: null }], pageParams: [null] };
    queryClient.setQueryData(['feed', 'para-voce', ''], feed);
    queryClient.setQueryData(pinnedPostsKey('hortas'), [item('a', 'Regras'), item('b', 'Reunião')]);
    api.mockResolvedValueOnce({ items: [dto('b', 'Reunião'), dto('a', 'Regras')], nextCursor: null });
    await act(async () => { await movePinnedPost('hortas', 'a', 2, mockShow); });
    expect(api).toHaveBeenCalledWith('/comunas/hortas/pinned-posts/a/position', { method: 'PUT', body: { position: 2 }, auth: true });
    expect(queryClient.getQueryData<FeedItem[]>(pinnedPostsKey('hortas'))?.map((pin) => pin.id)).toEqual(['b', 'a']);

    api.mockResolvedValueOnce(undefined);
    await act(async () => { await unpinPost(item('b', 'Reunião', { viewer: { isAuthor: false, canComment: true, canDelete: false, canPin: true, pinned: true } }), mockShow); });
    expect(api).toHaveBeenLastCalledWith('/comunas/hortas/pinned-posts/b', { method: 'DELETE', auth: true });
    expect(queryClient.getQueryData<FeedItem[]>(pinnedPostsKey('hortas'))?.map((pin) => pin.id)).toEqual(['a']);
    expect(queryClient.getQueryData(['feed', 'para-voce', ''])).toBe(feed);
  });
});
