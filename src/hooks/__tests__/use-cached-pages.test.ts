import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useCachedPages } from '../use-cached-pages';
import { queryClient } from '@/lib/query/client';
import { ApiError } from '@/lib/errors';
import {
  createRequestTrace,
  finishRequest,
  getPerformanceSnapshot,
  recordRequestAttempt,
  resetPerformanceSession,
  setPerformanceInstrumentationOverride,
} from '@/lib/performance';
import type { Page } from '@/lib/pagination';

type Item = { id: string };
const page = (...ids: string[]): Page<Item> => ({ items: ids.map((id) => ({ id })), nextCursor: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
/** Monta páginas encadeadas por cursor, como a API devolve. */
function paged(groups: string[][]): { pages: Page<Item>[]; nextByCursor: Map<string, Page<Item>> } {
  const pages = groups.map((group, index) => ({
    items: group.map((id) => ({ id })),
    nextCursor: index === groups.length - 1 ? null : group[group.length - 1],
  }));
  const nextByCursor = new Map<string, Page<Item>>();
  for (let index = 1; index < pages.length; index += 1) {
    nextByCursor.set(pages[index - 1].nextCursor!, pages[index]);
  }
  return { pages, nextByCursor };
}
async function loadPages(
  result: { current: { loadMore: () => void; items: Item[]; isFetching: boolean } },
  load: { mock: { calls: { length: number } } },
  totalPages: number,
  pageSize: number,
) {
  await waitFor(() => expect(result.current.items).toHaveLength(pageSize));
  for (let pageIndex = 1; pageIndex < totalPages; pageIndex += 1) {
    const calls = load.mock.calls.length;
    await act(async () => { result.current.loadMore(); });
    await waitFor(() => expect(result.current.items).toHaveLength((pageIndex + 1) * pageSize));
    expect(load.mock.calls.length).toBe(calls + 1);
    await waitFor(() => expect(result.current.isFetching).toBe(false));
  }
}
const policy = { staleTime: 60_000, gcTime: 60_000 };
beforeEach(() => { queryClient.clear(); queryClient.setDefaultOptions({ queries: { retry: false } }); });
afterEach(async () => {
  await cleanup();
  queryClient.clear();
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
});

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

  it('recupera a lista quando o retry da primeira página funciona', async () => {
    const load = jest.fn(async (): Promise<Page<Item>> => {
      throw new Error('offline');
    });
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, ...policy }));
    await waitFor(() => expect(result.current.status).toBe('error'));

    load.mockResolvedValueOnce(page('a'));
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.items).toEqual(page('a').items);
    expect(result.current.refreshError).toBeNull();
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

describe('refresh incremental', () => {
  const eightPages = paged([['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j'], ['k', 'l'], ['m', 'n'], ['o', 'p']]);

  it('depois de 8 páginas busca só a primeira e mantém a lista estável', async () => {
    let firstPage = eightPages.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? eightPages.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 8, 2);
    expect(result.current.items).toEqual(eightPages.pages.flatMap((entry) => entry.items));
    expect(result.current.items).toHaveLength(16);

    const calls = load.mock.calls.length;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(load.mock.calls.slice(calls).map(([cursor]) => cursor)).toEqual([null]);
    expect(result.current.items).toEqual(eightPages.pages.flatMap((entry) => entry.items));
    expect(result.current.hasMore).toBe(false);
  });

  it('conta como refresh apenas o prefixo buscado e não as 8 páginas antigas', async () => {
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();
    let firstPage = eightPages.pages[0];
    const load = jest.fn(async (cursor: string | null) => {
      const trace = createRequestTrace('/feed', 'GET')!;
      recordRequestAttempt(trace, 1, 'success', 200);
      finishRequest(trace, 'success');
      return cursor ? eightPages.nextByCursor.get(cursor)! : firstPage;
    });
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 8, 2);

    resetPerformanceSession();
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    const snapshot = getPerformanceSnapshot();
    expect(snapshot.requestsByScreen.feed).toMatchObject({ count: 1, refreshCount: 1, errors: 0 });
    expect(snapshot.counters.logicalRequests).toBe(1);
  });

  it('inserções no topo entram sem pular o item que saiu da primeira página', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    let firstPage = dataset.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? dataset.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 3, 3);

    firstPage = page('x', 'y', 'a');
    firstPage.nextCursor = 'a';
    const calls = load.mock.calls.length;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['x', 'y', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    expect(load.mock.calls.slice(calls).map(([cursor]) => cursor)).toEqual([null]);
  });

  it('deleções no topo somem sem duplicar o item de fronteira', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    let firstPage = dataset.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? dataset.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 3, 3);

    firstPage = page('a', 'c', 'd');
    firstPage.nextCursor = 'd';
    const calls = load.mock.calls.length;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['a', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  });

  it('mudança de ordem não repete o item movido nem perde a continuação', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    let firstPage = dataset.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? dataset.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 3, 3);

    firstPage = page('f', 'a', 'b');
    firstPage.nextCursor = 'b';
    const calls = load.mock.calls.length;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['f', 'a', 'b', 'c', 'd', 'e', 'g', 'h', 'i']);
  });

  it('busca a página de ligação quando o prefixo novo ainda não alcançou o histórico', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    const bridge = page('w', 'a', 'b');
    bridge.nextCursor = 'b';
    dataset.nextByCursor.set('z', bridge);
    let firstPage = dataset.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? dataset.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 3, 3);

    firstPage = page('x', 'y', 'z');
    firstPage.nextCursor = 'z';
    const calls = load.mock.calls.length;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 2));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(load.mock.calls.slice(calls).map(([cursor]) => cursor)).toEqual([null, 'z']);
    expect(result.current.items.map((item) => item.id)).toEqual(['x', 'y', 'z', 'w', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  });

  it('revalida em foco sem indicador, preservando páginas e cursor', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    let firstPage = dataset.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? dataset.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, ...policy }));
    await loadPages(result, load, 2, 3);

    firstPage = page('x', 'a', 'b');
    firstPage.nextCursor = 'b';
    const calls = load.mock.calls.length;
    await act(async () => { result.current.revalidate(); });
    await waitFor(() => expect(result.current.items).toHaveLength(7));
    expect(load.mock.calls.length).toBe(calls + 1);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.items.map((item) => item.id)).toEqual(['x', 'a', 'b', 'c', 'd', 'e', 'f']);

    await act(async () => { result.current.loadMore(); });
    await waitFor(() => expect(result.current.items).toHaveLength(10));
    expect(load.mock.calls.at(-1)?.[0]).toBe('f');
  });

  it('continua a paginação do último cursor preservado depois do refresh', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    let firstPage = dataset.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? dataset.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 2, 3);
    expect(result.current.hasMore).toBe(true);

    firstPage = page('x', 'a', 'b');
    firstPage.nextCursor = 'b';
    const calls = load.mock.calls.length;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(['x', 'a', 'b', 'c', 'd', 'e', 'f']);
    expect(result.current.hasMore).toBe(true);

    await act(async () => { result.current.loadMore(); });
    await waitFor(() => expect(result.current.items).toHaveLength(10));
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(load.mock.calls.at(-1)?.[0]).toBe('f');
    expect(result.current.items.map((item) => item.id)).toEqual(['x', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    expect(result.current.hasMore).toBe(false);
  });

  it('aborta o refresh e não deixa o indicador preso ao trocar de aba', async () => {
    const slow = deferred<Page<Item>>();
    let refreshSignal: AbortSignal | undefined;
    let slowMode = false;
    const loadA = jest.fn(async (_cursor: string | null, signal: AbortSignal) => {
      if (slowMode) {
        refreshSignal = signal;
        return slow.promise;
      }
      return page('a');
    });
    const loadB = jest.fn(async () => page('other'));
    const { result, rerender } = await renderHook<ReturnType<typeof useCachedPages<Item>>, { tab: string }>(
      ({ tab }) => useCachedPages({ queryKey: ['feed', tab], load: tab === 'a' ? loadA : loadB, ...policy }),
      { initialProps: { tab: 'a' } },
    );
    await waitFor(() => expect(result.current.items).toEqual(page('a').items));

    slowMode = true;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    expect(refreshSignal).toBeDefined();

    await rerender({ tab: 'b' });
    await waitFor(() => expect(result.current.items).toEqual(page('other').items));
    expect(refreshSignal?.aborted).toBe(true);

    await rerender({ tab: 'a' });
    expect(result.current.isRefreshing).toBe(false);
    await act(async () => slow.resolve(page('a')));
  });

  it('substitui o histórico quando o refresh alcança o fim antes dele', async () => {
    const dataset = paged([['a', 'b'], ['c', 'd']]);
    let firstPage = dataset.pages[0];
    const load = jest.fn(async (cursor: string | null) => cursor ? dataset.nextByCursor.get(cursor)! : firstPage);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await loadPages(result, load, 2, 2);

    firstPage = page('x', 'y');
    firstPage.nextCursor = null;
    const calls = load.mock.calls.length;
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['x', 'y']);
    expect(result.current.hasMore).toBe(false);
  });

  it('não substitui o histórico quando o refresh recebe uma página parcial', async () => {
    const load = jest.fn<() => Promise<Page<Item>>>()
      .mockResolvedValueOnce(page('a'))
      .mockResolvedValueOnce({ nextCursor: null } as unknown as Page<Item>);
    const { result } = await renderHook(() => useCachedPages({ queryKey: ['feed'], load, performanceScope: 'feed', ...policy }));
    await waitFor(() => expect(result.current.items).toEqual(page('a').items));

    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.refreshError).not.toBeNull());
    expect(result.current.items).toEqual(page('a').items);
    expect(queryClient.getQueryData<{ pages: Page<Item>[] }>(['feed'])?.pages[0].items).toEqual(page('a').items);
  });
});
