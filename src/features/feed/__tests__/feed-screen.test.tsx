import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import FeedScreen from '@/app/(tabs)/(inicio)/index';
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

jest.mock('expo-router', () => ({ useScrollToTop: () => undefined }));
jest.mock('@/hooks/use-cached-pages', () => ({ useCachedPages: () => mockFeed }));
jest.mock('@/hooks/use-list-visibility', () => ({
  useListVisibility: () => ({ visibleIds: new Set<string>(), onViewableItemsChanged: jest.fn() }),
  mediaViewabilityConfig: {},
}));
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
    PopulariaList: ({ data, renderItem }: { data: FeedItem[]; renderItem: (info: { item: FeedItem; index: number }) => React.ReactNode }) => (
      <View>{data.map((item, index) => <View key={item.id}>{renderItem({ item, index })}</View>)}</View>
    ),
  };
});
jest.mock('@/components/day-rule', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DayRule: ({ label }: { label: string }) => <Text>{label}</Text> };
});
jest.mock('@/features/posts/components/post-card', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PostCard: ({ item }: { item: FeedItem }) => <Text>{item.id}</Text> };
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
  it('não deixa a regra do dia órfã quando a primeira publicação some', async () => {
    await render(<FeedScreen />);

    expect(screen.queryByText('blocked-today')).toBeNull();
    expect(screen.queryByText('Hoje')).toBeNull();
    expect(screen.getByText('visible-yesterday')).toBeTruthy();
    expect(screen.getByText('Ontem')).toBeTruthy();
  });
});
