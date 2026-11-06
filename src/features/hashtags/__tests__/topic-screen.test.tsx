import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { mediaViewabilityConfig } from '@/hooks/use-list-visibility';
import { resetMockRouteFocused, setMockRouteFocused } from '@/hooks/testing/route-focus';
import type { FeedItem } from '@/types/models';

import { TopicScreen } from '../topic-screen';

const mockUseCachedPages = jest.fn();
const mockLoadMore = jest.fn();
let mockListState: { status: string; loadMore: () => void; hasMore: boolean } | null = null;

type MockListProps = {
  state: { status: string; loadMore: () => void; hasMore: boolean };
  data: FeedItem[];
  ListHeaderComponent: ReactNode;
  extraData?: unknown;
  viewabilityConfig?: unknown;
  onViewableItemsChanged?: (info: { viewableItems: { key: string }[] }) => void;
  renderItem?: (info: { item: FeedItem; index: number }) => ReactNode;
};

let mockListProps: MockListProps | null = null;

jest.mock('expo-router', () => {
  const { useMockFocusEffect } = jest.requireActual<typeof import('@/hooks/testing/route-focus')>('@/hooks/testing/route-focus');
  return { useLocalSearchParams: () => ({ slug: 'tecnologia' }), router: { canGoBack: () => true, back: jest.fn() }, useFocusEffect: useMockFocusEffect };
});
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { displayName: 'Tecnologia' } }) }));
jest.mock('@/lib/query/client', () => ({ queryClient: {}, contentPolicy: { feed: {}, profile: {} } }));
jest.mock('@/hooks/use-cached-pages', () => ({ useCachedPages: () => mockUseCachedPages() }));
jest.mock('@/components/list/popularia-list', () => {
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PopulariaList: (props: MockListProps) => {
      mockListProps = props;
      mockListState = props.state;
      return (
        <View>
          {props.ListHeaderComponent}
          <Text>{props.state.status}</Text>
          <Text>{props.data.length ? 'posts' : 'empty'}</Text>
          {props.data.map((item, index) => (
            <View key={item.id}>{props.renderItem?.({ item, index })}</View>
          ))}
        </View>
      );
    },
  };
});
jest.mock('@/features/posts/components/post-card', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useMediaVisible } = jest.requireActual<typeof import('@/hooks/use-list-visibility')>('@/hooks/use-list-visibility');
  return {
    PostCard: ({ item }: { item: FeedItem }) => {
      const mediaVisible = useMediaVisible(item.id);
      return <Text testID={`post-${item.id}`}>{mediaVisible ? 'visível' : 'oculta'}</Text>;
    },
  };
});

function feed(id: string): FeedItem {
  return {
    id,
    authorId: 'ana',
    comunaId: null,
    createdAt: '2026-10-29T12:00:00Z',
    text: `Texto ${id}`,
    attachment: {
      id: `media-${id}`,
      type: 'video',
      mimeType: 'video/mp4',
      byteSize: 1_000,
      width: 720,
      height: 1280,
      durationMs: 15_000,
      url: `https://example.test/${id}.mp4`,
    },
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved: false },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null,
    event: null,
    topCommentAuthor: null,
  };
}

describe('tela de tópico', () => {
  beforeEach(() => {
    mockUseCachedPages.mockReset();
    mockLoadMore.mockReset();
    mockListState = null;
    mockListProps = null;
    resetMockRouteFocused();
  });

  it.each(['loading', 'success', 'error'] as const)('apresenta estado %s na lista paginada', async (status) => {
    mockUseCachedPages.mockReturnValue({ items: [], status, hasMore: false, loadMore: mockLoadMore, refresh: jest.fn(), loadingMore: false, loadMoreError: null, isRefreshing: false, refreshError: null });
    await render(<TopicScreen />);
    expect(screen.getByText('#Tecnologia')).toBeTruthy();
    expect(screen.getByText(status)).toBeTruthy();
    expect(screen.getByText('empty')).toBeTruthy();
  });

  it('entrega a ação de próxima página à lista', async () => {
    mockUseCachedPages.mockReturnValue({ items: [], status: 'success', hasMore: true, loadMore: mockLoadMore, refresh: jest.fn(), loadingMore: false, loadMoreError: null, isRefreshing: false, refreshError: null });
    await render(<TopicScreen />);
    expect(mockListState?.hasMore).toBe(true);
    mockListState?.loadMore();
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('libera a mídia só do post na viewport e acompanha a rolagem', async () => {
    const items = Array.from({ length: 30 }, (_, index) => feed(`p${index + 1}`));
    mockUseCachedPages.mockReturnValue({ items, status: 'success', hasMore: false, loadMore: mockLoadMore, refresh: jest.fn(), loadingMore: false, loadMoreError: null, isRefreshing: false, refreshError: null });
    await render(<TopicScreen />);

    expect(mockListProps?.viewabilityConfig).toBe(mediaViewabilityConfig);
    // A viewport é assinada por `postId`; a lista não recebe extraData nem
    // precisa reenviar `renderItem` a cada mudança de janela.
    expect(mockListProps?.extraData).toBeUndefined();
    expect(mockListProps?.onViewableItemsChanged).toEqual(expect.any(Function));
    const onViewableItemsChanged = mockListProps?.onViewableItemsChanged;
    expect(screen.getByTestId('post-p15').props.children).toBe('oculta');
    expect(screen.getByTestId('post-p16').props.children).toBe('oculta');

    await act(async () => {
      mockListProps?.onViewableItemsChanged?.({ viewableItems: [{ key: 'p15' }] });
    });
    expect(screen.getByTestId('post-p15').props.children).toBe('visível');
    expect(screen.getByTestId('post-p14').props.children).toBe('oculta');
    expect(screen.getByTestId('post-p16').props.children).toBe('oculta');

    // Rolar para fora desliga o cartão anterior e libera somente o novo.
    await act(async () => {
      mockListProps?.onViewableItemsChanged?.({ viewableItems: [{ key: 'p16' }] });
    });
    expect(screen.getByTestId('post-p15').props.children).toBe('oculta');
    expect(screen.getByTestId('post-p16').props.children).toBe('visível');
    expect(mockListProps?.onViewableItemsChanged).toBe(onViewableItemsChanged);
  });

  it('não deixa vídeo tocando quando o tópico perde o foco', async () => {
    const items = Array.from({ length: 3 }, (_, index) => feed(`p${index + 1}`));
    mockUseCachedPages.mockReturnValue({ items, status: 'success', hasMore: false, loadMore: mockLoadMore, refresh: jest.fn(), loadingMore: false, loadMoreError: null, isRefreshing: false, refreshError: null });
    await render(<TopicScreen />);
    const onViewableItemsChanged = mockListProps?.onViewableItemsChanged;

    await act(async () => {
      onViewableItemsChanged?.({ viewableItems: [{ key: 'p2' }] });
    });
    expect(screen.getByTestId('post-p2').props.children).toBe('visível');

    await act(async () => {
      setMockRouteFocused(false);
    });
    expect(screen.getByTestId('post-p2').props.children).toBe('oculta');

    await act(async () => {
      setMockRouteFocused(true);
    });
    expect(screen.getByTestId('post-p1').props.children).toBe('oculta');
    expect(screen.getByTestId('post-p2').props.children).toBe('visível');
    expect(screen.getByTestId('post-p3').props.children).toBe('oculta');
  });
});
