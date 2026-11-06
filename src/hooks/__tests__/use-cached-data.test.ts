import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/lib/errors';
import { isQueryStale, queryClient, revalidateIfStale } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import { useCachedData } from '../use-cached-data';

const policy = { staleTime: 60_000, gcTime: 60_000 };

beforeEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
});

afterEach(async () => {
  await cleanup();
  queryClient.clear();
});

describe('useCachedData', () => {
  it('compartilha uma única request entre duas telas com a mesma entity key', async () => {
    let finish: (value: string) => void = () => {};
    const load = jest.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const { result } = await renderHook(() => ({
      left: useCachedData({ queryKey: queryKeys.comuna.detail('hortas'), load, ...policy }),
      right: useCachedData({ queryKey: queryKeys.comuna.detail('hortas'), load, ...policy }),
    }));

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await act(async () => finish('comuna'));
    await waitFor(() => expect(result.current.left.data).toBe('comuna'));
    expect(result.current.right.data).toBe('comuna');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('remonta com cache fresco sem repetir a request', async () => {
    const load = jest.fn(async () => 'comuna');
    const useTest = () => useCachedData({ queryKey: queryKeys.comuna.detail('hortas'), load, ...policy });
    const first = await renderHook(useTest);
    await waitFor(() => expect(first.result.current.data).toBe('comuna'));
    await first.unmount();
    const second = await renderHook(useTest);
    expect(second.result.current.data).toBe('comuna');
    expect(second.result.current.status).toBe('success');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('não deixa payload de uma chave contaminar outra entidade', async () => {
    const hortas = jest.fn(async () => ({ id: 'hortas', name: 'Hortas' }));
    const vila = jest.fn(async () => ({ id: 'vila', name: 'Vila' }));
    const { result } = await renderHook(() => ({
      hortas: useCachedData({ queryKey: queryKeys.comuna.detail('hortas'), load: hortas, ...policy }),
      vila: useCachedData({ queryKey: queryKeys.comuna.detail('vila'), load: vila, ...policy }),
    }));
    await waitFor(() => expect(result.current.hortas.data?.name).toBe('Hortas'));
    expect(result.current.vila.data?.name).toBe('Vila');
    expect(hortas).toHaveBeenCalledTimes(1);
    expect(vila).toHaveBeenCalledTimes(1);
  });

  it('remove o conteúdo quando o servidor nega acesso na revalidação', async () => {
    const load = jest.fn<() => Promise<string>>()
      .mockResolvedValueOnce('privado')
      .mockRejectedValueOnce(new ApiError(403, '/errors/access', 'Indisponível'));
    const { result } = await renderHook(() => useCachedData({ queryKey: queryKeys.comuna.detail('privada'), load, ...policy }));
    await waitFor(() => expect(result.current.data).toBe('privado'));
    await act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });

  it('só revalida no foco quando a janela de frescor acabou', async () => {
    const load = jest.fn(async () => 'comuna');
    await renderHook(() => useCachedData({ queryKey: queryKeys.comuna.detail('hortas'), load, ...policy }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    revalidateIfStale(queryKeys.comuna.detail('hortas'), policy.staleTime);
    expect(load).toHaveBeenCalledTimes(1);

    const query = queryClient.getQueryCache().find({ queryKey: queryKeys.comuna.detail('hortas'), exact: true });
    query?.setState({ dataUpdatedAt: Date.now() - policy.staleTime - 1 });
    expect(isQueryStale(queryKeys.comuna.detail('hortas'), policy.staleTime)).toBe(true);
    await act(async () => {
      revalidateIfStale(queryKeys.comuna.detail('hortas'), policy.staleTime);
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
