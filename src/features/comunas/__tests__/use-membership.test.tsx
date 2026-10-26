import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { ApiError, NetworkError } from '@/lib/errors';

import { joinComuna, leaveComuna } from '../api';
import { useComunaMembership } from '../use-membership';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, API_BASE_URL: 'http://api.test/api/v1' }));
jest.mock('../api', () => ({ joinComuna: jest.fn(), leaveComuna: jest.fn() }));

const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));

const join = jest.mocked(joinComuna);
const leave = jest.mocked(leaveComuna);

function wrapper({ children }: { children: ReactNode }) {
  return <InteractionsProvider>{children}</InteractionsProvider>;
}

const hortas = { id: 'hortas', name: 'Hortas', viewerIsMember: false };

beforeEach(() => {
  join.mockReset();
  leave.mockReset();
  mockShow.mockReset();
});

describe('useComunaMembership (API)', () => {
  it('começa pelo estado do servidor e só muda depois da resposta da API', async () => {
    let answer: () => void = () => {};
    join.mockReturnValue(
      new Promise((resolve) => {
        answer = () => resolve({ slug: 'hortas', isMember: true, role: 'member', memberCount: 2 });
      }),
    );
    const { result } = await renderHook(() => useComunaMembership(hortas), { wrapper });
    expect(result.current.joined).toBe(false);

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.toggleJoin();
    });
    expect(result.current.pending).toBe(true);
    expect(result.current.joined).toBe(false);

    // Toque repetido durante o envio não manda outra requisição.
    await act(() => result.current.toggleJoin());
    expect(join).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer();
      await pending;
    });
    expect(result.current.joined).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(join).toHaveBeenCalledWith('hortas');
  });

  it('sai de uma comuna de que já participava', async () => {
    leave.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useComunaMembership({ ...hortas, viewerIsMember: true }), { wrapper });

    await act(() => result.current.toggleJoin());

    expect(leave).toHaveBeenCalledWith('hortas');
    expect(result.current.joined).toBe(false);
  });

  it('comuna privada: mantém o estado e explica o motivo', async () => {
    join.mockRejectedValue(new ApiError(403, '/errors/comuna-requires-approval', 'Esta comuna é privada.'));
    const { result } = await renderHook(() => useComunaMembership(hortas), { wrapper });

    await act(() => result.current.toggleJoin());

    expect(result.current.joined).toBe(false);
    expect(mockShow).toHaveBeenCalledWith(expect.stringContaining('privada'));
  });

  it('sem rede: mantém o estado e permite tentar de novo', async () => {
    join.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce({ slug: 'hortas', isMember: true, role: 'member', memberCount: 2 });
    const { result } = await renderHook(() => useComunaMembership(hortas), { wrapper });

    await act(() => result.current.toggleJoin());
    expect(result.current.joined).toBe(false);
    expect(mockShow).toHaveBeenCalledWith(expect.stringContaining('Sem conexão'));

    await act(() => result.current.toggleJoin());
    expect(result.current.joined).toBe(true);
  });
});
