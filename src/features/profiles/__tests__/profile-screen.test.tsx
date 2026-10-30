import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { settleQueryClient } from '@/features/events/query-test-utils';
import { queryClient } from '@/lib/query/client';
import type { FeedItem, Profile } from '@/types/models';

import * as profileApi from '../api';
import ProfileScreen from '../profile-screen';

let mockProfileId: string | undefined;
const mockGoBack = jest.fn();

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockAnimatedView({ children, style }: { children?: React.ReactNode; style?: object }) {
    return React.createElement(View, { style }, children);
  }
  return {
    __esModule: true,
    default: { View: MockAnimatedView },
    cancelAnimation: () => {},
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (updater: () => object) => updater(),
    withTiming: (value: number, _config?: unknown, callback?: (finished: boolean) => void) => {
      callback?.(true);
      return value;
    },
    runOnJS: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  function MockMaterialIcon() {
    return null;
  }
  return MockMaterialIcon;
});

jest.mock('@/constants/config', () => {
  const actual = jest.requireActual<typeof import('@/constants/config')>('@/constants/config');
  return { ...actual, DEMO_MODE: true, USE_MOCKS: true };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: mockProfileId }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => { callback(); }, [callback]);
  },
}));

jest.mock('@/lib/routes', () => ({
  goBack: (...args: unknown[]) => mockGoBack(...args),
  useNav: () => ({ openRelations: jest.fn(), openComuna: jest.fn(), openPost: jest.fn() }),
}));

jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/moderation/actions-sheet', () => ({ useActionsSheet: () => ({ open: jest.fn() }) }));
jest.mock('../profile-photo', () => ({ ProfilePhoto: () => null }));
jest.mock('@/features/gamification/progress-screen', () => ({ ProfileProgress: () => null }));
jest.mock('@/features/posts/components/post-card', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockPostCard({ item }: { item: { id: string; text: string } }) {
    return <Text testID={`post-${item.id}`}>{item.text}</Text>;
  }
  return { PostCard: MockPostCard };
});
jest.mock('@/features/library/library-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LibraryPane: ({ header }: { header?: React.ReactNode }) => (
      <View><Text>Biblioteca do perfil</Text>{header}</View>
    ),
  };
});

jest.mock('@/features/account/account-context', () => {
  const me = { id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red' as const };
  const profile = {
    name: 'Camila Rocha', handle: 'camilarocha', city: 'Belo Horizonte', state: '', country: 'Brasil',
    countryCode: 'BR', stateIbgeCode: '', municipalityIbgeCode: '', bio: 'Professora de redação',
  };
  const replaceAvatarUrl = jest.fn();
  return { useMe: () => me, useAccount: () => ({ account: null, profile, replaceAvatarUrl }) };
});

jest.mock('@/features/interactions/interactions-context', () => {
  const joinedComunaIds: string[] = [];
  const localPosts: never[] = [];
  return {
    useInteractions: () => ({
      joinedComunaIds, localPosts, membershipOf: () => null, isOn: () => false, toggle: () => {}, setOn: () => {},
      localCommentsFor: () => [], commentCountOf: (_id: string, count: number) => count,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

jest.mock('@/features/comunas/api', () => {
  const actual = jest.requireActual<typeof import('@/features/comunas/api')>('@/features/comunas/api');
  return { ...actual, getComunas: jest.fn(async () => []), getMyComunas: jest.fn(async () => []) };
});

jest.mock('../api', () => {
  const actual = jest.requireActual<typeof import('../api')>('../api');
  return { ...actual, getProfile: jest.fn(), getUserPostsPage: jest.fn() };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const handlers: { onDeactivate?: (event: { translationX: number; velocityX: number; canceled: boolean }) => void } = {};
  (globalThis as { __profileSwipe?: typeof handlers }).__profileSwipe = handlers;
  return {
    usePanGesture: (config: typeof handlers) => {
      handlers.onDeactivate = config.onDeactivate;
      return { type: 'pan' };
    },
    useNativeGesture: () => ({ type: 'native' }),
    GestureDetector: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    GestureHandlerRootView: View,
  };
});

jest.mock('@/components/list/popularia-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const log: number[] = [];
  (globalThis as { __profileScroll?: number[] }).__profileScroll = log;
  const PopulariaList = React.forwardRef((props: {
    data?: { id: string }[];
    renderItem: (info: { item: { id: string } }) => React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    onScroll?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  }, ref: React.Ref<{ scrollToOffset: (params: { offset: number }) => void }>) => {
    React.useImperativeHandle(ref, () => ({
      scrollToOffset: ({ offset }: { offset: number }) => { log.push(offset); },
    }));
    const data = props.data ?? [];
    return (
      <View>
        {data.map((item) => <View key={item.id}>{props.renderItem({ item })}</View>)}
        {props.ListFooterComponent}
        <Pressable accessibilityLabel="Simular rolagem do perfil" onPress={() => props.onScroll?.({ nativeEvent: { contentOffset: { y: 320 } } })} />
      </View>
    );
  });
  PopulariaList.displayName = 'PopulariaList';
  return { PopulariaList };
});

const getProfile = jest.mocked(profileApi.getProfile);
const getUserPostsPage = jest.mocked(profileApi.getUserPostsPage);

function profile(patch: Partial<Profile> = {}): Profile {
  return {
    user: { id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red' },
    bio: 'Bio do perfil', meta: 'Belo Horizonte · desde 2025', summary: 'Professora',
    stats: [], comunaIds: [], creator: null, followerCount: 3, followingCount: 4,
    ...patch,
  };
}

function videoPost(): FeedItem {
  return {
    id: 'video-1', text: 'Vídeo do perfil', authorId: 'me', comunaId: null, createdAt: '2026-10-30T00:00:00Z',
    supportCount: 0, commentCount: 0, echoCount: 0,
    attachment: { id: 'media-1', type: 'video', mimeType: 'video/mp4', byteSize: 10, width: 720, height: 1280, durationMs: 3000, url: 'https://cdn.example/v.mp4' },
    author: { id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red' },
    comuna: null, event: null, topCommentAuthor: null,
  };
}

function swipeHandlers() {
  return (globalThis as { __profileSwipe?: { onDeactivate?: (event: { translationX: number; velocityX: number; canceled: boolean }) => void } }).__profileSwipe;
}

function scrollLog() {
  return (globalThis as { __profileScroll?: number[] }).__profileScroll ?? [];
}

async function swipe(translationX: number, velocityX = 0) {
  const onDeactivate = swipeHandlers()?.onDeactivate;
  if (!onDeactivate) throw new Error('O swipe do perfil não foi ligado.');
  await act(async () => { onDeactivate({ translationX, velocityX, canceled: false }); });
}

beforeEach(() => {
  settleQueryClient();
  queryClient.clear();
  mockProfileId = undefined;
  scrollLog().length = 0;
  jest.clearAllMocks();
  getProfile.mockResolvedValue(profile());
  getUserPostsPage.mockResolvedValue({ items: [], nextCursor: null });
});

afterEach(() => { queryClient.clear(); });

describe('swipe das abas do perfil', () => {
  it('toque, swipe e volta trocam a aba sem navegar nem refazer a busca', async () => {
    await render(<ProfileScreen />);
    expect(await screen.findByText('O que você quer compartilhar?')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Publicações', selected: true })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Episódios' })).toBeNull();
    const calls = getUserPostsPage.mock.calls.length;

    await swipe(120);
    expect(screen.getByRole('tab', { name: 'Publicações', selected: true })).toBeTruthy();
    expect(screen.getByText('Nenhuma publicação ainda.')).toBeTruthy();

    await swipe(-80);
    expect(screen.getByRole('tab', { name: 'Mídia', selected: true })).toBeTruthy();
    expect(screen.getByText('Nenhuma imagem ou vídeo publicado ainda.')).toBeTruthy();
    expect(screen.queryByText('Nenhuma publicação ainda.')).toBeNull();

    await swipe(90);
    expect(screen.getByRole('tab', { name: 'Publicações', selected: true })).toBeTruthy();
    expect(screen.getByText('Nenhuma publicação ainda.')).toBeTruthy();

    jest.mocked(router.push).mockClear();
    mockGoBack.mockClear();
    await swipe(-1200);
    expect(screen.getByRole('tab', { name: 'Mídia', selected: true })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(getUserPostsPage.mock.calls.length).toBe(calls);

    await fireEvent.press(screen.getByRole('tab', { name: 'Comunas' }));
    expect(await screen.findByText('Ainda não participa de nenhuma comuna.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Comunas', selected: true })).toBeTruthy();
    expect(getUserPostsPage.mock.calls.length).toBe(calls);
  });

  it('guarda a rolagem da aba e a restaura sem buscar de novo', async () => {
    await render(<ProfileScreen />);
    await screen.findByText('Nenhuma publicação ainda.');
    await fireEvent.press(screen.getByLabelText('Simular rolagem do perfil'));
    const calls = getUserPostsPage.mock.calls.length;
    await swipe(-80);
    await screen.findByText('Nenhuma imagem ou vídeo publicado ainda.');
    await swipe(80);
    await screen.findByText('Nenhuma publicação ainda.');
    expect(scrollLog().at(-1)).toBe(320);
    expect(getUserPostsPage.mock.calls.length).toBe(calls);
  });

  it('a última aba não passa do limite e o voltar da biblioteca não entra no histórico', async () => {
    await render(<ProfileScreen />);
    await screen.findByText('Nenhuma publicação ainda.');
    await fireEvent.press(screen.getByRole('tab', { name: 'Biblioteca pessoal' }));
    expect(await screen.findByText('Biblioteca do perfil')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Biblioteca pessoal', selected: true })).toBeTruthy();
    await swipe(-80);
    expect(screen.getByText('Biblioteca do perfil')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Biblioteca pessoal', selected: true })).toBeTruthy();
    mockGoBack.mockClear();
    await fireEvent.press(screen.getByLabelText('Voltar'));
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(await screen.findByText('Nenhuma publicação ainda.')).toBeTruthy();
  });

  it('perfil de outra pessoa usa as abas visíveis e não mostra ações do próprio perfil', async () => {
    mockProfileId = 'taina';
    getProfile.mockResolvedValue(profile({
      user: { id: 'taina', name: 'Tainá Souza', handle: 'taina', initials: 'TS', tone: 'black' },
      bio: 'Bio da Tainá',
    }));
    await render(<ProfileScreen />);
    expect(await screen.findByText('Tainá Souza')).toBeTruthy();
    expect(screen.getByText('Mensagem')).toBeTruthy();
    expect(screen.queryByText('Editar perfil')).toBeNull();
    expect(screen.queryByText('O que você quer compartilhar?')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Episódios' })).toBeNull();
    await swipe(-80);
    expect(screen.getByRole('tab', { name: 'Mídia', selected: true })).toBeTruthy();
    await swipe(-80);
    expect(screen.getByRole('tab', { name: 'Comunas', selected: true })).toBeTruthy();
  });

  it('criadora ganha Episódios entre Mídia e Comunas', async () => {
    mockProfileId = 'taina';
    getProfile.mockResolvedValue(profile({
      user: { id: 'taina', name: 'Tainá Souza', handle: 'taina', initials: 'TS', tone: 'black' },
      creator: {
        mastheadKicker: 'Podcast', mastheadTitle: 'Leitura', mastheadLeft: 'No ar', mastheadRight: '42',
        episodes: [{ number: '01', title: 'Primeiro episódio', meta: '32 min' }],
      },
    }));
    await render(<ProfileScreen />);
    expect(await screen.findByRole('tab', { name: 'Episódios' })).toBeTruthy();
    await swipe(-80);
    await swipe(-80);
    expect(screen.getByRole('tab', { name: 'Episódios', selected: true })).toBeTruthy();
    expect(screen.getByText('Primeiro episódio')).toBeTruthy();
    expect(screen.queryByText('Ainda não participa de nenhuma comuna.')).toBeNull();
  });

  it('sair da aba desmonta a publicação e voltar reaproveita o cache', async () => {
    getUserPostsPage.mockResolvedValue({ items: [videoPost()], nextCursor: null });
    await render(<ProfileScreen />);
    expect(await screen.findByText('Vídeo do perfil')).toBeTruthy();
    const calls = getUserPostsPage.mock.calls.length;
    await swipe(-80);
    expect(screen.queryByText('Vídeo do perfil')).toBeNull();
    expect(screen.getByLabelText('Abrir vídeo, 0:03')).toBeTruthy();
    await swipe(80);
    expect(screen.getByText('Vídeo do perfil')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir vídeo, 0:03')).toBeNull();
    expect(getUserPostsPage.mock.calls.length).toBe(calls);
  });
});
