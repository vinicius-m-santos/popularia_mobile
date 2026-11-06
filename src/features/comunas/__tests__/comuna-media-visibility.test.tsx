/**
 * POP-21: viewport e autoplay de vídeo nas publicações da comuna.
 *
 * O cenário usa o fixture de QA com 200 publicações (o mesmo de POP-5/POP-28),
 * das quais 66 são vídeos. A lista é substituída por um duplo que monta todas
 * as linhas e permite disparar a viewport pelo teste; é o único jeito de
 * controlar `onViewableItemsChanged` no Jest. O `PostCard`, o `PostAttachment`
 * e o player (mock de `expo-video`) são os reais: os contadores vêm de
 * `src/lib/performance`, como no POP-20.
 *
 * Não é medição de device: os números provam só a política de montagem.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useVideoPlayer } from 'expo-video';

import { buildQaFeedItems, qaFeedPage } from '@/features/performance/qa-fixture';
import { resetMockRouteFocused, setMockRouteFocused } from '@/hooks/testing/route-focus';
import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';
import type { ComunaDetails, FeedItem } from '@/types/models';
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

jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: jest.fn() }));

jest.mock('expo-router', () => {
  const { useMockFocusEffect } = jest.requireActual<typeof import('@/hooks/testing/route-focus')>('@/hooks/testing/route-focus');
  return {
    router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: () => ({ id: 'hortas' }),
    useFocusEffect: useMockFocusEffect,
  };
});

jest.mock('@/lib/routes', () => ({
  goBack: jest.fn(),
  useNav: () => ({ openPost: jest.fn(), openComuna: jest.fn(), openProfile: jest.fn(), openRelations: jest.fn(), openHashtag: jest.fn() }),
}));

jest.mock('@/features/posts/queries', () => ({ preparePost: jest.fn() }));

jest.mock('@/features/interactions/use-post-actions', () => ({
  usePostActions: () => ({
    supportCount: 0,
    supported: false,
    commentCount: 0,
    echoCount: 0,
    echoed: false,
    saved: false,
    toggleSupport: jest.fn(),
    toggleEcho: jest.fn(),
    toggleSave: jest.fn(),
  }),
}));
jest.mock('@/features/moderation/actions-sheet', () => ({ useActionsSheet: () => ({ open: jest.fn() }) }));

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

jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: View };
});

// Visualizadores não entram neste teste; o alvo é a política de montagem do player.
jest.mock('@/features/posts/components/photo-viewer', () => ({ PhotoViewer: () => null }));
jest.mock('@/features/posts/components/video-viewer', () => ({ VideoViewer: () => null }));

type MockPlayer = {
  status: string;
  playing: boolean;
  muted: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
  play: jest.Mock;
  pause: jest.Mock;
  generateThumbnailsAsync: jest.Mock;
  onPlayingChange?: (isPlaying: boolean) => void;
};

const players = globalThis as { __comunaPlayers?: MockPlayer[] };

jest.mock('expo-video', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    useVideoPlayer: jest.fn((_source: unknown, setup?: (player: MockPlayer) => void) => {
      const ref = React.useRef<MockPlayer | null>(null);
      if (!ref.current) {
        const player: MockPlayer = {
          status: 'ready',
          playing: false,
          muted: true,
          playbackRate: 1,
          currentTime: 0,
          duration: 15,
          play: jest.fn(),
          pause: jest.fn(),
          generateThumbnailsAsync: jest.fn(async () => []),
        };
        player.play.mockImplementation(() => {
          player.playing = true;
          player.onPlayingChange?.(true);
        });
        player.pause.mockImplementation(() => {
          player.playing = false;
          player.onPlayingChange?.(false);
        });
        ref.current = player;
        const store = globalThis as { __comunaPlayers?: MockPlayer[] };
        if (!store.__comunaPlayers) store.__comunaPlayers = [];
        store.__comunaPlayers.push(player);
        setup?.(player);
      }
      return ref.current;
    }),
    VideoView: View,
  };
});

jest.mock('expo', () => ({
  ...jest.requireActual<typeof import('expo')>('expo'),
  useEvent: () => ({ status: 'ready' }),
  useEventListener: (player: MockPlayer, event: string, callback: (payload: { isPlaying: boolean }) => void) => {
    if (event === 'playingChange') player.onPlayingChange = (isPlaying) => callback({ isPlaying });
  },
}));

jest.mock('@/features/comunas/components/comuna-hero', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ComunaHero: ({ comuna }: { comuna: { name: string } }) => (
      React.createElement(View, null, React.createElement(Text, { accessibilityRole: 'header' }, comuna.name))
    ),
  };
});

jest.mock('@/features/squares/square-entry', () => ({ SquareEntry: () => null }));
jest.mock('@/features/events/next-event', () => ({ NextEvent: () => null }));
jest.mock('@/features/comunas/components/rules-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { RulesList: () => React.createElement(Text, null, 'Regras da comuna') };
});
jest.mock('@/features/comunas/components/members-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { MembersList: () => React.createElement(Text, null, 'Membros da comuna'), ServerMembersList: () => React.createElement(Text, null, 'Membros da comuna') };
});
jest.mock('@/features/library/library-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { LibraryPane: () => React.createElement(Text, null, 'Biblioteca da comuna') };
});

type MockRow = { id: string; kind?: string; item?: FeedItem };
type MockListProps = {
  data?: MockRow[];
  renderItem: (info: { item: MockRow; index: number }) => ReactNode;
  keyExtractor: (item: MockRow) => string;
  onViewableItemsChanged?: (info: { viewableItems: { key: string }[] }) => void;
  viewabilityConfig?: unknown;
};

/** A lista real monta uma janela; aqui 40 cartões bastam para medir a política do player. */
const mockRenderedPosts = 40;

/**
 * Duplo da lista: entrega as props ao teste (para disparar a viewport) e monta
 * uma janela de cartões. A virtualização em si é coberta no teste de POP-28.
 */
jest.mock('@/components/list/popularia-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('@/components/list/popularia-list')>('@/components/list/popularia-list');
  function ControlledList(props: MockListProps) {
    const g = globalThis as { __comunaListProps?: MockListProps };
    g.__comunaListProps = props;
    let posts = 0;
    const rows = (props.data ?? []).filter((row) => {
      if (row.kind !== 'post') return true;
      posts += 1;
      return posts <= mockRenderedPosts;
    });
    return React.createElement(
      View,
      null,
      rows.map((item, index) => React.createElement(View, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))),
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
    rules: [],
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

/** 200 publicações; a cada 3, uma é vídeo (`qa-post-3`, `qa-post-6`, …). */
const FIXTURE = buildQaFeedItems(200);
const VIDEO_IDS = FIXTURE.filter((item) => item.attachment?.type === 'video').map((item) => item.id);

function listProps() {
  return (globalThis as { __comunaListProps?: MockListProps }).__comunaListProps;
}

/** Espera a lista carregar as 200 publicações e montar a janela de cartões. */
async function waitForPosts() {
  await waitFor(() => {
    expect(listProps()?.data?.filter((row) => row.kind === 'post')).toHaveLength(200);
    expect(screen.getAllByText(/Publicação de QA/).length).toBe(mockRenderedPosts);
  });
}

async function showViewport(ids: string[]) {
  await act(() => {
    listProps()?.onViewableItemsChanged?.({ viewableItems: ids.map((key) => ({ key })) });
  });
}

function videoCounters() {
  return getPerformanceSnapshot().video;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetMockRouteFocused();
  queryClient.clear();
  (globalThis as { __comunaListProps?: MockListProps }).__comunaListProps = undefined;
  players.__comunaPlayers = [];
  AppState.currentState = 'active';
  mockInteractions.postsVersion = 0;
  mockInteractions.membershipOf = () => undefined;
  mocked.getComuna.mockResolvedValue(comuna());
  mocked.getComunaPosts.mockImplementation(async () => qaFeedPage(null, 200, FIXTURE));
  mocked.getPinnedPosts.mockResolvedValue([]);
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
});

afterEach(() => {
  AppState.currentState = 'active';
  setPerformanceInstrumentationOverride(null);
  queryClient.clear();
});

describe('mídia da comuna na viewport', () => {
  it('com 200 publicações e 66 vídeos, só os vídeos da viewport montam player', async () => {
    await render(<ComunaScreen />);
    await waitForPosts();
    expect(VIDEO_IDS.length).toBeGreaterThanOrEqual(3);
    expect(videoCounters().mountedNow).toBe(0);
    expect(useVideoPlayer).not.toHaveBeenCalled();

    await showViewport(VIDEO_IDS.slice(0, 3));
    await waitFor(() => expect(players.__comunaPlayers).toHaveLength(3));
    expect(videoCounters().mountedNow).toBe(3);
    expect(videoCounters().playingNow).toBe(1);
    expect((players.__comunaPlayers ?? []).filter((player) => player.playing)).toHaveLength(1);
  });

  it('scroll rápido troca a viewport sem deixar player órfão da janela anterior', async () => {
    await render(<ComunaScreen />);
    await waitForPosts();

    await showViewport(VIDEO_IDS.slice(0, 3));
    await waitFor(() => expect(videoCounters().mountedNow).toBe(3));

    await showViewport(VIDEO_IDS.slice(3, 6));
    await waitFor(() => expect(videoCounters().mountedNow).toBe(3));
    expect(getPerformanceSnapshot().counters.videoMounts).toBe(6);
    expect(videoCounters()).toMatchObject({ mountedNow: 3, playingNow: 1 });

    // A viewport anterior foi desmontada de fato, não ficou tocando escondida.
    const unmounted = new Set(
      getPerformanceSnapshot().video.events
        .filter((event) => event.event === 'unmount')
        .map((event) => event.mediaId),
    );
    for (const item of FIXTURE.filter((entry) => VIDEO_IDS.slice(0, 3).includes(entry.id))) {
      expect(unmounted.has(item.attachment?.id ?? '')).toBe(true);
    }

    await showViewport([]);
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 0, playingNow: 0 }));
  });

  it('troca de aba desmonta os players e a volta começa com a viewport vazia', async () => {
    await render(<ComunaScreen />);
    await waitForPosts();

    await showViewport(VIDEO_IDS.slice(0, 2));
    await waitFor(() => expect(videoCounters().mountedNow).toBe(2));

    await fireEvent.press(screen.getByRole('tab', { name: 'Regras' }));
    expect(await screen.findByText('Regras da comuna')).toBeTruthy();
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 0, playingNow: 0 }));

    // A viewport da aba anterior não vale para a lista remontada: nada toca até a
    // nova viewability chegar.
    await fireEvent.press(screen.getByRole('tab', { name: 'Publicações' }));
    await waitForPosts();
    expect(videoCounters()).toMatchObject({ mountedNow: 0, playingNow: 0 });

    await showViewport([VIDEO_IDS[10]]);
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 1, playingNow: 1 }));
  });

  it('desmontagem da tela libera todos os players', async () => {
    const view = await render(<ComunaScreen />);
    await waitForPosts();

    await showViewport(VIDEO_IDS.slice(0, 3));
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 3, playingNow: 1 }));

    await view.unmount();
    expect(videoCounters()).toMatchObject({ mountedNow: 0, playingNow: 0 });
  });

  it('perde o foco da rota sem deixar player e retoma só a viewport retida', async () => {
    await render(<ComunaScreen />);
    await waitForPosts();

    await showViewport(VIDEO_IDS.slice(0, 2));
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 2, playingNow: 1 }));

    // Push de uma publicação/troca de aba: a lista continua montada, mas a
    // mídia visível desmonta e nenhum player fica tocando fora de foco.
    await act(async () => {
      setMockRouteFocused(false);
    });
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 0, playingNow: 0 }));

    // Back rápido: a mesma janela é reabilitada e volta a tocar um único vídeo.
    await act(async () => {
      setMockRouteFocused(true);
    });
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 2, playingNow: 1 }));

    // Coberta de novo, a viewport pode mudar; no retorno, só o que está
    // visível agora monta player e a lista não é remontada.
    await act(async () => {
      setMockRouteFocused(false);
    });
    await showViewport([VIDEO_IDS[10]]);
    expect(videoCounters()).toMatchObject({ mountedNow: 0, playingNow: 0 });
    await act(async () => {
      setMockRouteFocused(true);
    });
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 1, playingNow: 1 }));
  });

  it('pausa a reprodução quando o app vai para segundo plano', async () => {
    await render(<ComunaScreen />);
    await waitForPosts();

    await showViewport([VIDEO_IDS[0]]);
    await waitFor(() => expect(videoCounters()).toMatchObject({ mountedNow: 1, playingNow: 1 }));

    const listener = jest.mocked(AppState.addEventListener);
    const index = listener.mock.calls.findIndex(([event]) => event === 'change');
    expect(index).toBeGreaterThanOrEqual(0);
    const onChange = listener.mock.calls[index][1];
    await act(() => onChange('background' as AppStateStatus));

    expect(players.__comunaPlayers?.[0]?.pause).toHaveBeenCalled();
    expect(videoCounters()).toMatchObject({ mountedNow: 1, playingNow: 0 });
  });

  it('usa a mesma configuração de viewport do feed', async () => {
    const { mediaViewabilityConfig } = jest.requireActual<typeof import('@/hooks/use-list-visibility')>('@/hooks/use-list-visibility');
    await render(<ComunaScreen />);
    await waitFor(() => expect(listProps()).toBeTruthy());
    expect(listProps()?.viewabilityConfig).toBe(mediaViewabilityConfig);
    expect(listProps()?.onViewableItemsChanged).toEqual(expect.any(Function));
  });
});
