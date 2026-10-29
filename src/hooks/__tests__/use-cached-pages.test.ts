import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useCachedPages } from '../use-cached-pages';
import { queryClient } from '@/lib/query/client';
import { ApiError } from '@/lib/errors';
import type { Page } from '@/lib/pagination';

type Item = { id: string };
const page = (...ids: string[]): Page<Item> => ({ items: ids.map((id) => ({ id })), nextCursor: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const policy = { staleTime: 60_000, gcTime: 60_000 };
beforeEach(() => { queryClient.clear(); queryClient.setDefaultOptions({ queries: { retry: false } }); });
afterEach(async () => { await cleanup(); queryClient.clear(); });

describe('cache paginado', () => {
  it('remonta com conteúdo utilizável imediatamente e zero requests adicionais enquanto fresco', async () => {
    const load = jest.fn(async () => page('a'));
    const useTestPages = () => useCachedPages({ queryKey: ['feed'], load, ...policy });
    const first = await renderHook(useTestPages);
    await waitFor(() => expect(first.result.current.items).toEqual(page('a').items));
    await first.unmount();
    const next = await renderHook(useTestPages);
    expect(next.result.current.status).toBe('success');
    expect(next.result.current.items).toEqual(page('a').items);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('deduplica onEndReached concorrente e IDs que se sobrepõem', async () => {
    const second = deferred<Page<Item>>();
    const load = jest.fn(async (cursor: string | null) => cursor ? second.promise : { ...page('a'), nextCursor: 'next' });
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, ...policy }));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(() => { result.current.loadMore(); result.current.loadMore(); });
    expect(load).toHaveBeenCalledTimes(2);
    await act(() => second.resolve(page('a', 'b')));
    await waitFor(() => expect(result.current.items).toEqual(page('a', 'b').items));
  });

  it('mantém todas as páginas e conteúdo durante atualização silenciosa', async () => {
    const load = jest.fn(async (cursor: string | null) => cursor ? page('b') : { ...page('a'), nextCursor: 'next' });
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, ...policy }));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    const first = deferred<Page<Item>>();
    load.mockImplementationOnce(() => first.promise);
    let refresh!: Promise<void>;
    await act(() => { refresh = queryClient.invalidateQueries({ queryKey: ['feed'] }); });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.isRefreshing).toBe(false);
    await act(async () => { first.resolve({ ...page('a'), nextCursor: 'next' }); await refresh; });
    expect(result.current.items).toEqual(page('a', 'b').items);
  });

  it('mantém conteúdo quando atualização falha e permite retry explícito', async () => {
    const load = jest.fn(async () => page('a'));
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, ...policy }));
    await waitFor(() => expect(result.current.status).toBe('success'));
    load.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.refreshError).not.toBeNull());
    expect(result.current.items).toEqual(page('a').items);
    expect(result.current.isRefreshing).toBe(false);
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.refreshError).toBeNull());
  });

  it('remove conteúdo revogado também do cache, inclusive ao remontar', async () => {
    const load = jest.fn(async () => page('private'));
    const useTestPages = () => useCachedPages({ queryKey: ['feed'], load, ...policy });
    const first = await renderHook(useTestPages);
    await waitFor(() => expect(first.result.current.status).toBe('success'));
    load.mockRejectedValueOnce(new ApiError(403, '/private', 'Privado'));
    await act(() => first.result.current.refresh());
    await waitFor(() => expect(first.result.current.status).toBe('error'));
    expect(first.result.current.items).toEqual([]);
    expect(queryClient.getQueryData(['feed'])).toBeUndefined();
    await first.unmount();
    load.mockImplementation(() => new Promise(() => {}));
    const next = await renderHook(useTestPages);
    expect(next.result.current.items).toEqual([]);
  });

  it('cancela a consulta anterior ao trocar aba e não mistura dados', async () => {
    let oldSignal: AbortSignal | undefined;
    const load = jest.fn(async (_cursor: string | null, signal: AbortSignal) => { oldSignal = signal; return new Promise<Page<Item>>(() => {}); });
    const next = jest.fn(async () => page('other'));
    const { result, rerender } = await renderHook<ReturnType<typeof useCachedPages<Item>>, { tab: string }>(({ tab }) => useCachedPages({ queryKey: ['feed', tab], load: tab === 'a' ? load : next, ...policy }), { initialProps: { tab: 'a' } });
    await rerender({ tab: 'b' });
    expect(oldSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.items).toEqual(page('other').items));
  });
});
