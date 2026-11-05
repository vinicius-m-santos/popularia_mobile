import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';

import { PerformanceQaHarness } from '../qa-harness';

jest.mock('@/features/posts/components/post-card', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PostCard: ({ item }: { item: { id: string; text: string } }) => <Text>{item.text}</Text>,
  };
});

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
});

describe('harness de 20 cartões', () => {
  it('monta exatamente os 20 cartões do fixture quando a instrumentação está ligada', async () => {
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();

    await render(<PerformanceQaHarness />);

    expect(screen.getAllByText(/Publicação de QA/)).toHaveLength(20);
  });

  it('não monta cartões com a instrumentação desligada', async () => {
    await render(<PerformanceQaHarness />);
    expect(screen.queryByText(/Publicação de QA/)).toBeNull();
  });
});
