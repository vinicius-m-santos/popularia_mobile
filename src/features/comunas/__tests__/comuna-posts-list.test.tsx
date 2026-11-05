/**
 * Lista de publicações da comuna em FlashList (POP-28).
 *
 * O fixture tem 240 publicações com fotos e vídeos (o mesmo do QA de POP-5).
 * O PostCard é substituído por um contador de montagens: assim o teste mede
 * quantos cartões a lista monta, sem depender do player ou do layout do cartão.
 * A lista real é usada na maioria dos casos; o duplo controlado aparece só para
 * disparar viewability e a rolagem das abas, eventos que o Jest não emite.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ComponentType, ReactNode } from 'react';

import { buildQaFeedItems, qaFeedPage, QA_POST_COUNT } from '@/features/performance/qa-fixture';
import type { ComunaDetails, FeedItem } from '@/types/models';
import { ApiError, NetworkError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';

import * as api from '../api';
import ComunaScreen from '../comuna-screen';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, API_BASE_URL: 'http://api.test/api/v1', API_TIMEOUT_MS: 1000 }));

jest.mock('../api', () => {
  const actual = jest.requireActual<typeof import('../api')>('../api');
  return { ...actual, getComuna: jest.fn(), getComunaPosts: jest.fn(), getPinnedPosts: jest.fn() };
});

const mockMe = { id: 'me', name: 'Eu', handle: 'eu', initials: 'EU', tone: 'red' as const };
jest.mock('@/features/account/account-context', () => ({ useMe: () => mockMe }));

const mockInteractions = {
  postsVersion: 0,
  joinedComunaIds: [] as string[],
  followedUserIds: [] as string[],
  localPosts: [] as never[],
  localComments: [] as never[],
  membershipOf: () => undefined,
  isOn: () => false,
  toggle: () => false,
  setOn: () => undefined,
  localCommentsFor: () => [],
  commentCountOf: (_id: string, count: number) => count,
};
jest.mock('@/features/interactions/interactions-context', () => ({ useInteractions: () => mockInteractions }));

const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));

jest.mock('expo-status-bar', () => ({ setStatusBarStyle: jest.fn() }));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'hortas' }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('@/lib/routes', () => ({
  goBack: jest.fn(),
  useNav: () => ({ openPost: jest.fn(), openComuna: jest.fn(), openProfile: jest.fn(), openRelations: jest.fn(), openHashtag: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    usePanGesture: () => ({ type: 'pan' }),
    useNativeGesture: () => ({ type: 'native' }),
    GestureDetector: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    GestureHandlerRootView: View,
  };
});

jest.mock('@/features/comunas/components/comuna-hero', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ComunaHero: ({ comuna, postCountLabel }: { comuna: { name: string }; postCountLabel?: string }) => (
      <View>
        <Text accessibilityRole="header">{comuna.name}</Text>
        <Text testID="comuna-post-count">{postCountLabel}</Text>
      </View>
    ),
  };
});

jest.mock('@/features/squares/square-entry', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SquareEntry: () => React.createElement(Text, null, 'Praça da comuna') };
});

jest.mock('@/features/events/next-event', () => ({ NextEvent: () => null }));

jest.mock('@/features/comunas/components/rules-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    RulesList: ({ rules }: { rules: { title: string }[] }) => (
      React.createElement(Text, null, `Regras da comuna: ${rules.map((rule) => rule.title).join(', ')}`)
    ),
  };
});

jest.mock('@/features/comunas/components/members-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MembersList: () => React.createElement(Text, null, 'Membros da comuna'),
    ServerMembersList: () => React.createElement(Text, null, 'Membros da comuna'),
  };
});

jest.mock('@/features/library/library-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LibraryPane: ({ header }: { header?: ReactNode }) => (
      React.createElement(View, null, React.createElement(Text, null, 'Biblioteca da comuna'), header)
    ),
  };
});

jest.mock('@/features/posts/components/post-card', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useMediaVisible } = jest.requireActual<typeof import('@/hooks/use-list-visibility')>('@/hooks/use-list-visibility');
  const g = globalThis as { __comunaMounts?: Map<string, number> };
  function MockPostCard({ item }: { item: FeedItem }) {
    const mediaVisible = useMediaVisible(item.id);
    React.useEffect(() => {
      if (g.__comunaMounts) g.__comunaMounts.set(item.id, (g.__comunaMounts.get(item.id) ?? 0) + 1);
    }, [item.id]);
    return (
      <Text testID={`post-${item.id}`} accessibilityLabel={mediaVisible ? 'mídia visível' : 'mídia oculta'}>
        {item.text}
      </Text>
    );
  }
  return { PostCard: MockPostCard };
});

type MockRow = { id: string; kind?: string; item?: FeedItem };
type MockListProps = {
  data?: MockRow[];
  renderItem: (info: { item: MockRow; index: number }) => ReactNode;
  keyExtractor: (item: MockRow) => string;
  getItemType?: (item: MockRow) => string;
  stickyHeaderIndices?: number[];
  performanceListId?: string;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  onViewableItemsChanged?: (info: { viewableItems: { key: string }[] }) => void;
};

jest.mock('@/components/list/popularia-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('@/components/list/popularia-list')>('@/components/list/popularia-list');
  const g = globalThis as { __comunaUseRealList?: boolean; __comunaListProps?: MockListProps };
  function ControlledList(props: MockListProps) {
    React.useEffect(() => { g.__comunaListProps = props; });
    if (g.__comunaUseRealList !== false) {
      return React.createElement(actual.PopulariaList as unknown as ComponentType<MockListProps>, props);
    }
    const data = props.data ?? [];
    const firstPost = data.find((row) => row.kind === 'post');
    return (
      <View>
        {props.ListHeaderComponent}
        {data.map((item, index) => <View key={props.keyExtractor(item)}>{props.renderItem({ item, index })}</View>)}
        {data.length === 0 ? props.ListEmptyComponent : null}
        {props.ListFooterComponent}
        <Pressable
          accessibilityLabel="Simular viewport"
          onPress={() => props.onViewableItemsChanged?.({ viewableItems: firstPost ? [{ key: firstPost.id }] : [] })}
        />
      </View>
    );
  }
  return { ...actual, PopulariaList: ControlledList };
});

const mocked = jest.mocked(api);

function comuna(patch: Partial<ComunaDetails> = {}): ComunaDetails {
  return {
    id: 'hortas',
    serverId: 'u1',
    visibility: 'public',
    status: 'active',
    name: 'Hortas',
    handle: 'hortas',
    initials: 'HO',
    tone: 'red',
    place: 'São Paulo · SP',
    foundedYear: '2026',
    description: 'Mutirões.',
    memberCount: 3,
    coverAlt: '',
    topics: [],
    stats: [],
    rules: [{ title: 'Respeito', description: 'Escute antes de responder.' }],
    moderationNote: '',
    pinned: null,
    moderatorIds: [],
    founderRole: '',
    featuredMemberIds: [],
    viewerIsMember: true,
    viewerRole: 'member',
    moderators: [],
    featuredMembers: [],
    members: [],
    ...patch,
  };
}

function mounts() {
  return (globalThis as { __comunaMounts?: Map<string, number> }).__comunaMounts ?? new Map<string, number>();
}

function mountedCards() {
  return screen.queryAllByTestId(/^post-/);
}

function listProps() {
  return (globalThis as { __comunaListProps?: MockListProps }).__comunaListProps;
}

function Harness() {
  return <ComunaScreen />;
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  (globalThis as { __comunaUseRealList?: boolean }).__comunaUseRealList = true;
  (globalThis as { __comunaListProps?: MockListProps }).__comunaListProps = undefined;
  (globalThis as { __comunaMounts?: Map<string, number> }).__comunaMounts = new Map();
  mockInteractions.postsVersion = 0;
  mockInteractions.membershipOf = () => undefined;
  mocked.getComuna.mockResolvedValue(comuna());
  mocked.getComunaPosts.mockImplementation(async (_id, cursor) => qaFeedPage(cursor));
  mocked.getPinnedPosts.mockResolvedValue([]);
});

afterEach(() => {
  queryClient.clear();
  (globalThis as { __comunaUseRealList?: boolean }).__comunaUseRealList = true;
});

describe('lista de publicações da comuna em FlashList', () => {
  it('com 240 publicações monta só a janela visível e pagina por cursor até o fim', async () => {
    await render(<Harness />);
    await screen.findByTestId('post-qa-post-1');

    expect(mocked.getComunaPosts).toHaveBeenCalledWith('hortas', null);
    expect(screen.getByTestId('comuna-post-count').props.children).toBe('80+');
    const firstWindow = mountedCards();
    expect(firstWindow.length).toBeGreaterThan(0);
    expect(firstWindow.length).toBeLessThan(40);
    expect(firstWindow.length).toBeLessThan(QA_POST_COUNT);

    await fireEvent.press(screen.getByText('Carregar mais publicações'));
    await waitFor(() => expect(mocked.getComunaPosts).toHaveBeenCalledWith('hortas', '80'));
    await waitFor(() => expect(screen.getByTestId('comuna-post-count').props.children).toBe('160+'));
    expect(mountedCards().length).toBeLessThan(40);

    await fireEvent.press(screen.getByText('Carregar mais publicações'));
    await waitFor(() => expect(mocked.getComunaPosts).toHaveBeenCalledWith('hortas', '160'));
    await waitFor(() => expect(screen.getByTestId('comuna-post-count').props.children).toBe('240'));

    // Carregou 240, mas a lista continua com a janela: nunca 240 cartões montados.
    expect(screen.queryAllByTestId(/^post-/).length).toBeLessThan(40);
    expect(screen.queryByText('Carregar mais publicações')).toBeNull();
    // Nenhum cartão foi montado duas vezes para a mesma publicação.
    for (const count of mounts().values()) expect(count).toBe(1);
  });

  it('revalida ao publicar sem remontar os cartões já visíveis', async () => {
    const view = await render(<Harness />);
    await screen.findByTestId('post-qa-post-1');
    await fireEvent.press(screen.getByText('Carregar mais publicações'));
    await waitFor(() => expect(screen.getByTestId('comuna-post-count').props.children).toBe('160+'));
    const mountCountsBefore = new Map(mounts());
    expect(mountCountsBefore.size).toBeGreaterThan(0);

    // Publicar marca postsVersion: a tela revalida a partir da primeira página. Preservar
    // todas as páginas é escopo do POP-35, ainda não implementado; a lista não é remontada
    // e os cartões visíveis continuam os mesmos.
    mockInteractions.postsVersion = 1;
    await view.rerender(<Harness />);
    await waitFor(() => expect(mocked.getComunaPosts.mock.calls.length).toBeGreaterThan(2));
    expect(mocked.getComunaPosts.mock.calls.slice(2).some((call) => call[1] === null)).toBe(true);
    await waitFor(() => expect(mountedCards().length).toBeGreaterThan(0));
    for (const [id, count] of mountCountsBefore) {
      if (mounts().has(id)) expect(mounts().get(id)).toBe(count);
    }

    // A paginação continua de onde a lista está, sem repetir o cursor anterior.
    const callsBefore = mocked.getComunaPosts.mock.calls.length;
    await waitFor(() => expect(screen.getByText('Carregar mais publicações')).toBeTruthy());
    await fireEvent.press(screen.getByText('Carregar mais publicações'));
    await waitFor(() => expect(mocked.getComunaPosts.mock.calls.length).toBe(callsBefore + 1));
    expect(mocked.getComunaPosts.mock.calls.at(-1)?.[1]).not.toBeNull();
  });

  it('preserva loading, erro com retry e vazio da aba de publicações', async () => {
    let resolvePage!: (page: { items: FeedItem[]; nextCursor: string | null }) => void;
    mocked.getComunaPosts.mockReturnValueOnce(new Promise((resolve) => { resolvePage = resolve; }));
    await render(<Harness />);
    expect(await screen.findByLabelText('Carregando publicações')).toBeTruthy();

    resolvePage({ items: [], nextCursor: null });
    expect(await screen.findByText('Nenhuma publicação ainda.')).toBeTruthy();
    expect(screen.queryByText('Carregar mais publicações')).toBeNull();
  });

  it('mostra erro de página com retry e volta a carregar', async () => {
    mocked.getComunaPosts.mockRejectedValueOnce(new NetworkError());
    await render(<Harness />);
    expect(await screen.findByText(/Não conseguimos carregar as publicações/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByTestId('post-qa-post-1')).toBeTruthy();
  });

  it('falha ao paginar mantém os cartões e permite tentar de novo', async () => {
    mocked.getComunaPosts
      .mockResolvedValueOnce({ items: buildQaFeedItems(80), nextCursor: '80' })
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce({ items: buildQaFeedItems(240).slice(80), nextCursor: null });
    await render(<Harness />);
    await screen.findByTestId('post-qa-post-1');

    await fireEvent.press(screen.getByText('Carregar mais publicações'));
    expect(await screen.findByText('Não conseguimos carregar mais publicações.')).toBeTruthy();
    expect(screen.getByTestId('post-qa-post-1')).toBeTruthy();

    await fireEvent.press(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(mocked.getComunaPosts).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByTestId('comuna-post-count').props.children).toBe('240'));
  });

  it('comuna privada sem participação mostra o recado e não monta cartões', async () => {
    mocked.getComuna.mockResolvedValue(comuna({ visibility: 'private', viewerIsMember: false }));
    mocked.getComunaPosts.mockRejectedValue(new ApiError(403, '/errors/comuna-private', 'x'));
    await render(<Harness />);

    expect(await screen.findByText('Comuna privada')).toBeTruthy();
    expect(mountedCards()).toHaveLength(0);
  });

  it('troca de abas sem refazer a página já carregada', async () => {
    await render(<Harness />);
    await screen.findByTestId('post-qa-post-1');
    const callsAfterPosts = mocked.getComunaPosts.mock.calls.length;

    await fireEvent.press(screen.getByRole('tab', { name: 'Regras' }));
    expect(await screen.findByText(/Regras da comuna/)).toBeTruthy();
    expect(mountedCards()).toHaveLength(0);
    expect(mocked.getComunaPosts.mock.calls.length).toBe(callsAfterPosts);

    await fireEvent.press(screen.getByRole('tab', { name: 'Membros' }));
    expect(await screen.findByText('Membros da comuna')).toBeTruthy();
    expect(mountedCards()).toHaveLength(0);

    await fireEvent.press(screen.getByRole('tab', { name: 'Publicações' }));
    expect(await screen.findByTestId('post-qa-post-1')).toBeTruthy();
    expect(mocked.getComunaPosts.mock.calls.length).toBe(callsAfterPosts);

    await fireEvent.press(screen.getByRole('tab', { name: 'Biblioteca' }));
    expect(await screen.findByText('Biblioteca da comuna')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Publicações' }));
    expect(await screen.findByTestId('post-qa-post-1')).toBeTruthy();
    expect(mocked.getComunaPosts.mock.calls.length).toBe(callsAfterPosts);
  });

  it('fixa a barra de abas e separa os tipos de célula', async () => {
    await render(<Harness />);
    await screen.findByTestId('post-qa-post-1');
    const props = listProps();
    expect(props?.stickyHeaderIndices).toEqual([1]);
    expect(props?.performanceListId).toBe('comuna:hortas:posts');

    const items = buildQaFeedItems(3);
    const video = items[2];
    const plain = { ...items[0], attachment: undefined, document: undefined, poll: undefined } as FeedItem;
    const poll = { ...plain, poll: { id: 'poll-1', question: 'Qual?', totalVotes: 0, votedOptionId: null, endsAt: null, options: [] } } as FeedItem;
    expect(props?.keyExtractor({ kind: 'post', id: video.id })).toBe(video.id);
    expect(props?.getItemType?.({ kind: 'post', id: video.id, item: video })).toBe('text:video');
    expect(props?.getItemType?.({ kind: 'post', id: plain.id, item: plain })).toBe('text:plain');
    expect(props?.getItemType?.({ kind: 'post', id: poll.id, item: poll })).toBe('poll:plain');
    expect(props?.getItemType?.({ kind: 'tabs', id: 'comuna-tabs' })).toBe('tabs');
  });

  it('só entrega mídia visível ao cartão que está na viewport', async () => {
    (globalThis as { __comunaUseRealList?: boolean }).__comunaUseRealList = false;
    mocked.getComunaPosts.mockResolvedValue({ items: buildQaFeedItems(3), nextCursor: null });
    await render(<Harness />);
    await screen.findByTestId('post-qa-post-1');

    expect(screen.getByTestId('post-qa-post-1').props.accessibilityLabel).toBe('mídia oculta');
    expect(screen.getByTestId('post-qa-post-2').props.accessibilityLabel).toBe('mídia oculta');

    await fireEvent.press(screen.getByLabelText('Simular viewport'));
    await waitFor(() => expect(screen.getByTestId('post-qa-post-1').props.accessibilityLabel).toBe('mídia visível'));
    expect(screen.getByTestId('post-qa-post-2').props.accessibilityLabel).toBe('mídia oculta');
  });
});
