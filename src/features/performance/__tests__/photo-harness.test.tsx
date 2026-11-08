import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';

import { PhotoQaHarness } from '../photo-harness';
import { QA_PHOTO_FEED_COUNT } from '../photo-harness-fixture';

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: ({
      data,
      renderItem,
      onLoad,
      testID,
    }: {
      data: unknown[];
      renderItem: (input: { item: unknown; index: number }) => React.ReactElement;
      onLoad?: (info: { elapsedTimeInMs: number }) => void;
      testID?: string;
    }) => {
      React.useEffect(() => { onLoad?.({ elapsedTimeInMs: 12.5 }); }, [onLoad]);
      return <View testID={testID}>{data.map((item, index) => React.cloneElement(renderItem({ item, index }), { key: index }))}</View>;
    },
  };
});

jest.mock('@/features/posts/components/post-card', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PostCard: ({ item }: { item: { id: string } }) => <Text>{item.id}</Text>,
  };
});

beforeEach(() => {
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
});

describe('feed de QA com 120 fotos', () => {
  it('monta o dataset e registra o onLoad da lista virtualizada', async () => {
    await render(<PhotoQaHarness />);

    expect(screen.getByTestId('photo-feed-harness')).toBeTruthy();
    expect(screen.getByText('qa-photo-post-1')).toBeTruthy();
    expect(screen.getByText(`qa-photo-post-${QA_PHOTO_FEED_COUNT}`)).toBeTruthy();
    expect(getPerformanceSnapshot().lists[0]).toMatchObject({
      list: 'photo-feed:original',
      itemCount: QA_PHOTO_FEED_COUNT,
    });
  });

  it('não renderiza nada quando a instrumentação está desligada', async () => {
    setPerformanceInstrumentationOverride(null);
    await render(<PhotoQaHarness />);

    expect(screen.queryByTestId('photo-feed-harness')).toBeNull();
  });
});
