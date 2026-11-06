import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { mergeById, type Page } from '@/lib/pagination';
import { ApiError } from '@/lib/errors';

import { usePaginatedData, type PaginatedData } from '../use-paginated-data';

type Item = { id: string };
type Loader = (cursor: string | null) => Promise<Page<Item>>;
const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));

/** Promessa controlada pelo teste, para simular respostas fora de ordem. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Dataset determinístico de três páginas encadeadas por cursor. */
function paged(groups: string[][]): { pages: Page<Item>[]; byCursor: Map<string, Page<Item>> } {
  const pages = groups.map((group, index) => ({
    items: items(...group),
    nextCursor: index === groups.length - 1 ? null : group[group.length - 1],
  }));
  const byCursor = new Map<string, Page<Item>>();
  for (let index = 1; index < pages.length; index += 1) byCursor.set(pages[index - 1].nextCursor!, pages[index]);
  return { pages, byCursor };
}

async function loadAllPages(
  result: { current: PaginatedData<Item> },
  load: { mock: { calls: unknown[] } },
  pageCount: number,
  pageSize: number,
) {
  await waitFor(() => expect(result.current.items).toHaveLength(pageSize));
  for (let pageIndex = 1; pageIndex < pageCount; pageIndex += 1) {
    const calls = load.mock.calls.length;
    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength((pageIndex + 1) * pageSize));
    expect(load.mock.calls.length).toBe(calls + 1);
  }
}

describe('mergeById', () => {
  it('junta listas sem repetir IDs, mantendo a primeira ocorrência', () => {
    expect(mergeById(items('a', 'b'), items('b', 'c'), items('a'))).toEqual(items('a', 'b', 'c'));
  });
});

describe('usePaginatedData', () => {
  it('descarta conteúdo em cache quando a participação privada é revogada', async () => {
    const load = jest.fn<Loader>()
      .mockResolvedValueOnce({ items: items('privado'), nextCursor: null })
      .mockRejectedValueOnce(new ApiError(403, '/errors/comuna-private', 'Privada'));
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.items).toEqual(items('privado')));
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.items).toEqual([]);
  });
  it('carrega a primeira página e as seguintes pelo cursor, sem duplicar itens', async () => {
    const load = jest.fn(async (cursor: string | null): Promise<Page<Item>> =>
      cursor === null ? { items: items('a', 'b'), nextCursor: 'b' } : { items: items('b', 'c'), nextCursor: null },
    );
    const { result } = await renderHook(() => usePaginatedData(load));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.items).toEqual(items('a', 'b'));
    expect(result.current.hasMore).toBe(true);

    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    expect(result.current.items).toEqual(items('a', 'b', 'c'));
    expect(load).toHaveBeenLastCalledWith('b');
  });

  it('ignora "carregar mais" repetido enquanto a página seguinte não chega', async () => {
    const next = deferred<Page<Item>>();
    const load = jest.fn((cursor: string | null) =>
      cursor === null ? Promise.resolve({ items: items('a'), nextCursor: 'a' }) : next.promise,
    );
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    await act(() => result.current.loadMore());

    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({ items: items('b'), nextCursor: null }));
    expect(result.current.items).toEqual(items('a', 'b'));
  });

  it('falha ao carregar mais: mantém os itens e permite tentar de novo', async () => {
    let fail = true;
    const load = jest.fn(async (cursor: string | null): Promise<Page<Item>> => {
      if (cursor === null) return { items: items('a'), nextCursor: 'a' };
      if (fail) throw new Error('offline');
      return { items: items('b'), nextCursor: null };
    });
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadMoreError).not.toBeNull());
    expect(result.current.items).toEqual(items('a'));

    fail = false;
    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toEqual(items('a', 'b')));
    expect(result.current.loadMoreError).toBeNull();
  });

  it('falha ao atualizar com itens na tela: não apaga o conteúdo', async () => {
    let fail = false;
    const load = jest.fn(async (): Promise<Page<Item>> => {
      if (fail) throw new Error('offline');
      return { items: items('a', 'b'), nextCursor: null };
    });
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.status).toBe('success'));

    fail = true;
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.refreshError).not.toBeNull());

    expect(result.current.status).toBe('success');
    expect(result.current.items).toEqual(items('a', 'b'));
    expect(result.current.isRefreshing).toBe(false);
  });

  it('atualizar substitui a lista pela primeira página nova', async () => {
    let version = 1;
    const load = jest.fn(async (): Promise<Page<Item>> =>
      version === 1 ? { items: items('a'), nextCursor: null } : { items: items('novo', 'a'), nextCursor: null },
    );
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.status).toBe('success'));

    version = 2;
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.items).toEqual(items('novo', 'a')));
  });

  it('revalida uma lista vazia em segundo plano sem exibir loader', async () => {
    const next = deferred<Page<Item>>();
    const load = jest.fn<Loader>()
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockImplementationOnce(() => next.promise);
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(() => result.current.revalidate());
    expect(result.current.status).toBe('success');
    expect(result.current.items).toEqual([]);
    expect(result.current.isRefreshing).toBe(false);

    await act(async () => next.resolve({ items: items('novo'), nextCursor: null }));
    expect(result.current.items).toEqual(items('novo'));
  });

  it('mantém conteúdo e layout quando a revalidação silenciosa falha', async () => {
    const next = deferred<Page<Item>>();
    const load = jest.fn<Loader>()
      .mockResolvedValueOnce({ items: items('a'), nextCursor: null })
      .mockImplementationOnce(() => next.promise);
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.items).toEqual(items('a')));

    await act(() => result.current.revalidate());
    await act(async () => next.reject(new Error('offline')));
    expect(result.current.status).toBe('success');
    expect(result.current.items).toEqual(items('a'));
    expect(result.current.refreshError).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it('revalida três páginas sem descartar o histórico nem pedir as páginas de novo', async () => {
    const dataset = paged([['a', 'b'], ['c', 'd'], ['e', 'f']]);
    const load = jest.fn<Loader>(async (cursor) => cursor === null ? dataset.pages[0] : dataset.byCursor.get(cursor)!);
    const { result } = await renderHook(() => usePaginatedData(load));
    await loadAllPages(result, load, 3, 2);
    expect(result.current.hasMore).toBe(false);
    const callsBefore = load.mock.calls.length;
    const refreshed = deferred<Page<Item>>();
    load.mockImplementationOnce(() => refreshed.promise);

    await act(() => result.current.revalidate());
    // Enquanto a primeira página viaja, as três páginas continuam na tela.
    expect(result.current.items).toEqual(items('a', 'b', 'c', 'd', 'e', 'f'));

    await act(async () => refreshed.resolve(dataset.pages[0]));
    await waitFor(() => expect(load.mock.calls.length).toBe(callsBefore + 1));
    expect(result.current.items).toEqual(items('a', 'b', 'c', 'd', 'e', 'f'));
    expect(result.current.status).toBe('success');
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.refreshError).toBeNull();
  });

  it('revalidação com inserções no topo preserva o histórico e não repete o item de fronteira', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    const load = jest.fn<Loader>(async (cursor) => cursor === null ? dataset.pages[0] : dataset.byCursor.get(cursor)!);
    const { result } = await renderHook(() => usePaginatedData(load));
    await loadAllPages(result, load, 3, 3);
    const callsBefore = load.mock.calls.length;
    const refreshed = deferred<Page<Item>>();
    load.mockImplementationOnce(() => refreshed.promise);

    await act(() => result.current.revalidate());
    // Duas publicações novas empurraram "a" para o fim da primeira página.
    await act(async () => refreshed.resolve({ items: items('x', 'y', 'a'), nextCursor: 'a' }));
    await waitFor(() => expect(load.mock.calls.length).toBe(callsBefore + 1));

    expect(result.current.items.map((item) => item.id)).toEqual(['x', 'y', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  });

  it('revalidação com mudança de ordem não duplica o item movido nem perde a continuação', async () => {
    const dataset = paged([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
    const load = jest.fn<Loader>(async (cursor) => cursor === null ? dataset.pages[0] : dataset.byCursor.get(cursor)!);
    const { result } = await renderHook(() => usePaginatedData(load));
    await loadAllPages(result, load, 3, 3);
    const callsBefore = load.mock.calls.length;
    const refreshed = deferred<Page<Item>>();
    load.mockImplementationOnce(() => refreshed.promise);

    await act(() => result.current.revalidate());
    // "f" foi fixado no topo; a ordem antiga continua depois do âncora "b".
    await act(async () => refreshed.resolve({ items: items('f', 'a', 'b'), nextCursor: 'b' }));
    await waitFor(() => expect(load.mock.calls.length).toBe(callsBefore + 1));

    expect(result.current.items.map((item) => item.id)).toEqual(['f', 'a', 'b', 'c', 'd', 'e', 'g', 'h', 'i']);
    expect(new Set(result.current.items.map((item) => item.id)).size).toBe(result.current.items.length);
  });

  it('revalidação com falha mantém as três páginas e permite tentar de novo', async () => {
    const dataset = paged([['a', 'b'], ['c', 'd'], ['e', 'f']]);
    const load = jest.fn<Loader>(async (cursor) => cursor === null ? dataset.pages[0] : dataset.byCursor.get(cursor)!);
    const { result } = await renderHook(() => usePaginatedData(load));
    await loadAllPages(result, load, 3, 2);
    const callsBefore = load.mock.calls.length;
    const failed = deferred<Page<Item>>();
    load.mockImplementationOnce(() => failed.promise);

    await act(() => result.current.revalidate());
    await act(async () => failed.reject(new Error('offline')));

    expect(result.current.status).toBe('success');
    expect(result.current.items).toEqual(items('a', 'b', 'c', 'd', 'e', 'f'));
    expect(result.current.refreshError).toBeNull();
    expect(result.current.isRefreshing).toBe(false);

    await act(() => result.current.revalidate());
    await waitFor(() => expect(load.mock.calls.length).toBe(callsBefore + 2));
    expect(result.current.items).toEqual(items('a', 'b', 'c', 'd', 'e', 'f'));
  });

  it('revalidação com acesso revogado limpa as páginas carregadas', async () => {
    const dataset = paged([['a', 'b'], ['c', 'd'], ['e', 'f']]);
    const load = jest.fn<Loader>(async (cursor) => cursor === null ? dataset.pages[0] : dataset.byCursor.get(cursor)!);
    const { result } = await renderHook(() => usePaginatedData(load));
    await loadAllPages(result, load, 3, 2);
    load.mockRejectedValueOnce(new ApiError(403, '/errors/comuna-private', 'Privada'));

    await act(() => result.current.revalidate());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadMoreError).toBeNull();
  });

  it('ignora loadMore enquanto a revalidação sela o histórico e retoma pelo cursor preservado', async () => {
    const dataset = paged([['a'], ['b']]);
    const load = jest.fn<Loader>(async (cursor) => cursor === null ? dataset.pages[0] : dataset.byCursor.get(cursor)!);
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.items).toEqual(items('a')));
    const refreshed = deferred<Page<Item>>();
    load.mockImplementationOnce(() => refreshed.promise);

    await act(() => result.current.revalidate());
    const callsDuringRevalidation = load.mock.calls.length;
    await act(() => result.current.loadMore());
    expect(load).toHaveBeenCalledTimes(callsDuringRevalidation);

    await act(async () => refreshed.resolve(dataset.pages[0]));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(callsDuringRevalidation));

    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toEqual(items('a', 'b')));
    expect(load).toHaveBeenLastCalledWith('a');
  });

  it('descarta o loadMore da consulta anterior quando a aba muda', async () => {
    const slow = deferred<Page<Item>>();
    const loadA = jest.fn<Loader>(async (cursor) => cursor === null
      ? { items: items('a'), nextCursor: 'a' }
      : slow.promise);
    const loadB = jest.fn<Loader>(async () => ({ items: items('b'), nextCursor: null }));
    const { result, rerender } = await renderHook<PaginatedData<Item>, { load: Loader }>(
      ({ load }) => usePaginatedData(load),
      { initialProps: { load: loadA } },
    );
    await waitFor(() => expect(result.current.items).toEqual(items('a')));

    await act(() => result.current.loadMore());
    await rerender({ load: loadB });
    await waitFor(() => expect(result.current.items).toEqual(items('b')));

    await act(async () => slow.resolve({ items: items('c'), nextCursor: null }));
    expect(result.current.items).toEqual(items('b'));
    expect(result.current.hasMore).toBe(false);
  });

  it('descarta a resposta atrasada de uma consulta anterior (troca de aba)', async () => {
    const slow = deferred<Page<Item>>();
    const loadA = jest.fn(() => slow.promise);
    const loadB = jest.fn(async () => ({ items: items('b1'), nextCursor: null }));
    const { result, rerender } = await renderHook<PaginatedData<Item>, { load: Loader }>(
      ({ load }) => usePaginatedData(load),
      { initialProps: { load: loadA } },
    );

    await rerender({ load: loadB });
    await waitFor(() => expect(result.current.items).toEqual(items('b1')));

    await act(async () => slow.resolve({ items: items('a1'), nextCursor: null }));
    expect(result.current.items).toEqual(items('b1'));
  });

  it('append acrescenta um item criado sem duplicar se ele chegar depois pela API', async () => {
    const load = jest.fn(async (cursor: string | null): Promise<Page<Item>> =>
      cursor === null ? { items: items('a'), nextCursor: 'a' } : { items: items('meu'), nextCursor: null },
    );
    const { result } = await renderHook(() => usePaginatedData(load));
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(() => result.current.append({ id: 'meu' }));
    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    expect(result.current.items).toEqual(items('a', 'meu'));
  });

  it('erro na primeira página vai para o estado de erro', async () => {
    const load = jest.fn(async (): Promise<Page<Item>> => {
      throw new Error('offline');
    });
    const { result } = await renderHook(() => usePaginatedData(load));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.items).toEqual([]);
  });
});
