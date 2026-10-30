import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TopicScreen } from '../topic-screen';

const mockUseCachedPages = jest.fn();
const mockLoadMore = jest.fn();
let mockListState: { status: string; loadMore: () => void; hasMore: boolean } | null = null;

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ slug: 'tecnologia' }), router: { canGoBack: () => true, back: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { displayName: 'Tecnologia' } }) }));
jest.mock('@/lib/query/client', () => ({ queryClient: {}, contentPolicy: { feed: {}, profile: {} } }));
jest.mock('@/hooks/use-cached-pages', () => ({ useCachedPages: () => mockUseCachedPages() }));
jest.mock('@/components/list/popularia-list', () => ({ PopulariaList: ({ state, data, ListHeaderComponent }: {
  state: { status: string; loadMore: () => void; hasMore: boolean }; data: { id: string }[]; ListHeaderComponent: ReactNode;
}) => {
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  mockListState = state;
  return <View>{ListHeaderComponent}<Text>{state.status}</Text><Text>{data.length ? 'posts' : 'empty'}</Text></View>;
} }));

describe('tela de tópico', () => {
  beforeEach(() => {
    mockUseCachedPages.mockReset();
    mockLoadMore.mockReset();
    mockListState = null;
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
});
