import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/lib/errors';

import { useAsyncData } from '../use-async-data';

describe('useAsyncData: atualização', () => {
  it('preserva conteúdo após falha de rede e permite tentar novamente', async () => {
    const load = jest.fn<() => Promise<string>>()
      .mockResolvedValueOnce('conteúdo')
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce('atualizado');
    const { result } = await renderHook(() => useAsyncData(load));
    await waitFor(() => expect(result.current.data).toBe('conteúdo'));
    await act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBe('conteúdo');
    expect(result.current.isRefreshing).toBe(false);
    await act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('atualizado'));
  });

  it.each([401, 403, 404])('remove conteúdo quando o servidor retorna %i', async (status) => {
    const load = jest.fn<() => Promise<string>>()
      .mockResolvedValueOnce('privado')
      .mockRejectedValueOnce(new ApiError(status, '/errors/access', 'Indisponível'));
    const { result } = await renderHook(() => useAsyncData(load));
    await waitFor(() => expect(result.current.data).toBe('privado'));
    await act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });
});
