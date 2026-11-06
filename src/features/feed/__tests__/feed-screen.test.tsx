import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';

import FeedScreen from '@/app/(tabs)/(inicio)/index';
import { resetMockRouteFocused, setMockRouteFocused } from '@/hooks/testing/route-focus';
import type { FeedItem } from '@/types/models';

const mockToday = new Date();
const mockYesterday = new Date(Date.now() - 86_400_000);

const mockFeedItems = [
  {
    id: 'blocked-today',
    author: { id: 'user-blocked', handle: 'bloqueado', name: 'Pessoa bloqueada', initials: 'PB', tone: 'red' },
    createdAt: mockToday.toISOString(),
    text: 'Publicação de quem foi bloqueado',
  },
  {
    id: 'visible-yesterday',
    author: { id: 'user-visible', handle: 'visivel', name: 'Pessoa visível', initials: 'PV', tone: 'red' },
    createdAt: mockYesterday.toISOString(),
    text: 'Publicação visível',
  },
] as FeedItem[];

const mockFeed = {
  items: mockFeedItems,
  status: 'success',
  hasMore: false,
  loadingMore: false,
  loadMoreError: null,
  isRefreshing: false,
  refreshError: null,
  refresh: jest.fn(),
  loadMore: jest.fn(),
};

type MockListProps = {
  data: FeedItem[];
  renderItem: (info: { item: FeedItem; index: number }) => React.ReactNode;
  extraData?: unknown;
  onViewableItemsChanged?: (info: { viewableItems: { key: string }[] }) => void;
  viewabilityConfig?: unknown;
};

let mockListProps: MockListProps | null = null;

jest.mock('expo-router', () => {
  const { useMockFocusEffect } = jest.requireActual<typeof import('@/hooks/testing/route-focus')>('@/hooks/testing/route-focus');
  return { useScrollToTop: () => undefined, useFocusEffect: useMockFocusEffect };
});
jest.mock('@/hooks/use-cached-pages', () => ({ useCachedPages: () => mockFeed }));
jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({
    joinedComunaIds: [],
    followedUserIds: [],
    isOn: (kind: string, id: string) => kind === 'mutedUsers' && id === 'bloqueado',
  }),
}));
jest.mock('@/components/screen', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/list/popularia-list', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PopulariaList: (props: MockListProps) => {
      mockListProps = props;
      return (
        <View>{props.data.map((item, index) => <View key={item.id}>{props.renderItem({ item, index })}</View>)}</View>
      );
    },
  };
});
jest.mock('@/components/day-rule', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DayRule: ({ label }: { label: string }) => <Text>{label}</Text> };
});
jest.mock('@/features/posts/components/post-card', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useMediaVisible } = jest.requireActual<typeof import('@/hooks/use-list-visibility')>('@/hooks/use-list-visibility');
  return {
    PostCard: ({ item }: { item: FeedItem }) => {
      const mediaVisible = useMediaVisible(item.id);
      return <Text testID={`post-${item.id}`}>{`${item.id}:${mediaVisible ? 'visible' : 'hidden'}`}</Text>;
    },
  };
});
jest.mock('@/features/feed/components/feed-header', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { FeedHeader: () => <View /> };
});
jest.mock('@/features/feed/components/welcome-banner', () => ({ WelcomeBanner: () => null }));
jest.mock('@/features/feed/components/composer-prompt', () => ({ ComposerPrompt: () => null }));
jest.mock('@/features/gamification/progress-screen', () => ({ HomeProgress: () => null }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/query/client', () => ({ contentPolicy: { feed: {} } }));

describe('feed com pessoa bloqueada', () => {
  beforeEach(() => resetMockRouteFocused());

  it('não deixa a regra do dia órfã quando a primeira publicação some', async () => {
    await render(<FeedScreen />);

    expect(screen.queryByTestId('post-blocked-today')).toBeNull();
    expect(screen.queryByText('Hoje')).toBeNull();
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:hidden');
    expect(screen.getByText('Ontem')).toBeTruthy();
  });

  it('assina a viewport por postId sem trocar props da lista ao rolar', async () => {
    await render(<FeedScreen />);

    const firstRenderProps = mockListProps;
    expect(firstRenderProps).not.toBeNull();
    expect(firstRenderProps?.extraData).toBeUndefined();
    expect(firstRenderProps?.onViewableItemsChanged).toEqual(expect.any(Function));
    expect(firstRenderProps?.viewabilityConfig).toBeDefined();
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:hidden');

    await act(async () => {
      firstRenderProps?.onViewableItemsChanged?.({ viewableItems: [{ key: 'visible-yesterday' }] });
    });

    // Só o cartão que entrou na viewport re-renderiza; a lista mantém as props.
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:visible');
    expect(mockListProps).toBe(firstRenderProps);
    expect(mockListProps?.renderItem).toBe(firstRenderProps?.renderItem);
    expect(mockListProps?.onViewableItemsChanged).toBe(firstRenderProps?.onViewableItemsChanged);

    await act(async () => {
      firstRenderProps?.onViewableItemsChanged?.({ viewableItems: [] });
    });
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:hidden');
    expect(mockListProps).toBe(firstRenderProps);
  });

  it('desliga a mídia fora do foco e reabilita só a viewport retida', async () => {
    await render(<FeedScreen />);
    const list = mockListProps;
    const onViewableItemsChanged = list?.onViewableItemsChanged;
    expect(onViewableItemsChanged).toEqual(expect.any(Function));

    await act(async () => {
      onViewableItemsChanged?.({ viewableItems: [{ key: 'visible-yesterday' }] });
    });
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:visible');

    // Push de uma publicação: a lista continua montada, mas vai para o pôster.
    await act(async () => {
      setMockRouteFocused(false);
    });
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:hidden');

    // Back rápido: só a janela retida volta a valer.
    await act(async () => {
      setMockRouteFocused(true);
    });
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:visible');
    expect(mockListProps).toBe(list);
    expect(mockListProps?.onViewableItemsChanged).toBe(onViewableItemsChanged);

    // Coberta de novo, a viewport pode mudar; no retorno, só o que está visível habilita.
    await act(async () => {
      setMockRouteFocused(false);
    });
    await act(async () => {
      onViewableItemsChanged?.({ viewableItems: [] });
    });
    await act(async () => {
      setMockRouteFocused(true);
    });
    expect(screen.getByTestId('post-visible-yesterday').props.children).toBe('visible-yesterday:hidden');
  });
});
