/**
 * POP-20/POP-30: a lista de salvos entrega `mediaVisible` por `postId`.
 *
 * O teste isola a composição da lista: o cartão é um duplo que lê a viewport
 * pelo hook, e a viewability é disparada pelo mesmo contrato usado em produção
 * (`onViewableItemsChanged` + `mediaViewabilityConfig`).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { mediaViewabilityConfig } from '@/hooks/use-list-visibility';
import type { FeedItem } from '@/types/models';

import { SavedPostsPane } from '../saved-posts-pane';

const mockUseCachedPages = jest.fn();

type MockListProps = {
  data: FeedItem[];
  extraData?: unknown;
  viewabilityConfig?: unknown;
  onViewableItemsChanged?: (info: { viewableItems: { key: string }[] }) => void;
  renderItem?: (info: { item: FeedItem; index: number }) => ReactNode;
};

let mockListProps: MockListProps | null = null;

jest.mock('@/hooks/use-cached-pages', () => ({ useCachedPages: () => mockUseCachedPages() }));
jest.mock('@/features/posts/api', () => ({ listSavedPosts: jest.fn() }));
jest.mock('@/components/list/popularia-list', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PopulariaList: (props: MockListProps) => {
      mockListProps = props;
      return (
        <View>
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
    savedAt: '2026-10-29T18:00:00Z',
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
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved: true },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null,
    event: null,
    topCommentAuthor: null,
  };
}

describe('mídia das publicações salvas', () => {
  beforeEach(() => {
    mockUseCachedPages.mockReset();
    mockListProps = null;
  });

  it('libera a mídia só do post na viewport e acompanha a rolagem', async () => {
    const items = Array.from({ length: 30 }, (_, index) => feed(`s${index + 1}`));
    mockUseCachedPages.mockReturnValue({ items, status: 'success', hasMore: false, loadMore: jest.fn(), refresh: jest.fn(), loadingMore: false, loadMoreError: null, isRefreshing: false, refreshError: null });
    await render(<SavedPostsPane onShowDocuments={jest.fn()} />);

    expect(mockListProps?.viewabilityConfig).toBe(mediaViewabilityConfig);
    // Sem `extraData`: cada cartão assina a viewport pelo próprio `postId`.
    expect(mockListProps?.extraData).toBeUndefined();
    expect(mockListProps?.onViewableItemsChanged).toEqual(expect.any(Function));
    const onViewableItemsChanged = mockListProps?.onViewableItemsChanged;
    expect(screen.getByTestId('post-s10').props.children).toBe('oculta');
    expect(screen.getByTestId('post-s11').props.children).toBe('oculta');

    await act(async () => {
      mockListProps?.onViewableItemsChanged?.({ viewableItems: [{ key: 's10' }] });
    });
    expect(screen.getByTestId('post-s10').props.children).toBe('visível');
    expect(screen.getByTestId('post-s9').props.children).toBe('oculta');
    expect(screen.getByTestId('post-s11').props.children).toBe('oculta');

    await act(async () => {
      mockListProps?.onViewableItemsChanged?.({ viewableItems: [{ key: 's11' }] });
    });
    expect(screen.getByTestId('post-s10').props.children).toBe('oculta');
    expect(screen.getByTestId('post-s11').props.children).toBe('visível');
    expect(mockListProps?.onViewableItemsChanged).toBe(onViewableItemsChanged);
  });
});
