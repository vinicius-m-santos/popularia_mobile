import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { DiscoveryData } from '../api';

import { getDiscoveryData } from '../api';
import { useDiscovery } from '../queries';

jest.mock('../api', () => ({ getDiscoveryData: jest.fn() }));

const mocked = jest.mocked(getDiscoveryData);

const data: DiscoveryData = {
  topics: [], comunas: [], people: [], posts: [], recentPosts: [], documents: [], events: [],
  next: { comunas: null, people: null, posts: null, events: null, documents: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
});

afterEach(async () => {
  await cleanup();
  queryClient.clear();
});

describe('cache de descoberta', () => {
  it('usa uma entrada por pessoa/assunto/escopo', async () => {
    mocked.mockResolvedValue(data);
    const { result } = await renderHook(() => ({
      left: useDiscovery('me', 'tec', 'tec'),
      right: useDiscovery('me', 'tec', 'tec'),
    }));
    await waitFor(() => expect(result.current.left.status).toBe('success'));
    expect(result.current.right.status).toBe('success');
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKeys.discovery.home('me', 'tec', 'tec'))).toBe(data);
  });

  it('rejeita payload parcial e preserva o cache anterior', async () => {
    const key = queryKeys.discovery.home('me');
    queryClient.setQueryData(key, data);
    queryClient.getQueryCache().find({ queryKey: key, exact: true })?.setState({ dataUpdatedAt: Date.now() - 120_000 });
    mocked.mockResolvedValue({ topics: [] } as never);
    const { result } = await renderHook(() => ({ home: useDiscovery('me') }));
    await waitFor(() => expect(result.current.home.status).toBe('error'));
    expect(queryClient.getQueryData(key)).toBe(data);
  });
});
