import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { useFollow } from '@/features/interactions/use-post-actions';
import { NetworkError } from '@/lib/errors';

import { getFollowing, setFollowing } from '../api';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('../api', () => ({ getFollowing: jest.fn(), setFollowing: jest.fn() }));
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ account: { id: 'real-id' } }) }));
const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));

function wrapper({ children }: { children: ReactNode }) { return <InteractionsProvider>{children}</InteractionsProvider>; }

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getFollowing).mockResolvedValue(false);
  jest.mocked(setFollowing).mockResolvedValue(undefined);
});

describe('follow persistido', () => {
  it('carrega a relação do servidor e confirma seguir/deixar de seguir', async () => {
    jest.mocked(getFollowing).mockResolvedValue(true);
    const { result } = await renderHook(() => useFollow('outra'), { wrapper });
    await waitFor(() => expect(result.current.following).toBe(true));
    await act(async () => { await result.current.toggleFollow(); });
    expect(setFollowing).toHaveBeenCalledWith('outra', false);
    expect(result.current.following).toBe(false);
    await act(async () => { await result.current.toggleFollow(); });
    expect(setFollowing).toHaveBeenLastCalledWith('outra', true);
    expect(result.current.following).toBe(true);
  });

  it('a falha mantém a relação anterior e comunica o erro', async () => {
    jest.mocked(setFollowing).mockRejectedValueOnce(new NetworkError());
    const { result } = await renderHook(() => useFollow('outra'), { wrapper });
    await act(async () => { await result.current.toggleFollow(); });
    expect(result.current.following).toBe(false);
    expect(mockShow).toHaveBeenCalled();
  });

  it('toques rápidos enviam uma única alteração', async () => {
    let resolve!: () => void;
    jest.mocked(setFollowing).mockReturnValueOnce(new Promise<void>((res) => { resolve = res; }));
    const { result } = await renderHook(() => useFollow('outra'), { wrapper });
    await act(async () => { void result.current.toggleFollow(); void result.current.toggleFollow(); });
    expect(setFollowing).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    await act(async () => { resolve(); });
    expect(result.current.following).toBe(true);
  });

  it.each(['me', 'real-id'])('não faz requests para seguir a própria identidade %s', async (id) => {
    const { result } = await renderHook(() => useFollow(id), { wrapper });
    await act(async () => { await result.current.toggleFollow(); });
    expect(getFollowing).not.toHaveBeenCalled();
    expect(setFollowing).not.toHaveBeenCalled();
  });
});
