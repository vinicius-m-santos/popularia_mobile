import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { prefetchInfiniteQueryOnce, prefetchQueryOnce, queryClient } from '@/lib/query/client';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } });
});

afterEach(() => {
  queryClient.clear();
});

describe('prefetch centralizado', () => {
  it('deduplica uma consulta em voo e não dispara a segunda chamada', async () => {
    const pending = deferred<string>();
    const queryFn = jest.fn(() => pending.promise);
    const key = ['prefetch-test', 'single'];

    const first = prefetchQueryOnce({ queryKey: key, queryFn, staleTime: 60_000 });
    const second = prefetchQueryOnce({ queryKey: key, queryFn, staleTime: 60_000 });

    expect(queryFn).toHaveBeenCalledTimes(1);
    pending.resolve('ok');
    await Promise.all([first, second]);
    expect(queryClient.getQueryData(key)).toBe('ok');
  });

  it('é best-effort em rede lenta/offline: não rejeita e não repete o erro', async () => {
    const queryFn = jest.fn(async () => { throw new Error('offline'); });
    const key = ['prefetch-test', 'error'];

    await expect(prefetchQueryOnce({ queryKey: key, queryFn, retry: true })).resolves.toBeUndefined();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('respeita o staleTime: dados frescos não geram novo request', async () => {
    const key = ['prefetch-test', 'fresh'];
    await queryClient.fetchQuery({ queryKey: key, queryFn: async () => 'cached', staleTime: 60_000 });
    const queryFn = jest.fn(async () => 'network');

    await prefetchQueryOnce({ queryKey: key, queryFn, staleTime: 60_000 });

    expect(queryFn).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(key)).toBe('cached');
  });

  it('não refaz uma lista infinita já carregada, mesmo com staleTime vencido', async () => {
    const key = ['prefetch-test', 'infinite'];
    queryClient.setQueryData(key, { pages: [{ items: ['a'], nextCursor: null }], pageParams: [null] });
    const queryFn = jest.fn(async () => ({ items: ['b'], nextCursor: null }));

    await prefetchInfiniteQueryOnce({
      queryKey: key,
      queryFn,
      initialPageParam: null,
      getNextPageParam: () => undefined,
      staleTime: 0,
    });

    expect(queryFn).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(key)).toEqual({ pages: [{ items: ['a'], nextCursor: null }], pageParams: [null] });
  });

  it('aquece a primeira página de uma lista ainda vazia e deduplica chamadas concorrentes', async () => {
    const pending = deferred<{ items: string[]; nextCursor: null }>();
    const queryFn = jest.fn(() => pending.promise);
    const key = ['prefetch-test', 'infinite-empty'];
    const options = {
      queryKey: key,
      queryFn,
      initialPageParam: null as string | null,
      getNextPageParam: () => undefined,
      staleTime: 60_000,
    };

    const first = prefetchInfiniteQueryOnce(options);
    const second = prefetchInfiniteQueryOnce(options);

    expect(queryFn).toHaveBeenCalledTimes(1);
    pending.resolve({ items: ['a'], nextCursor: null });
    await Promise.all([first, second]);
    expect(queryClient.getQueryData(key)).toEqual({ pages: [{ items: ['a'], nextCursor: null }], pageParams: [null] });
  });
});
