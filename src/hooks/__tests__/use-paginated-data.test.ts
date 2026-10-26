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
