import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { useFollow } from '@/features/interactions/use-post-actions';
import { NetworkError } from '@/lib/errors';

import { readRequested, resetFollowSession } from '../follow-cache';
import { getFollowing, setFollowing } from '../api';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('../api', () => ({ getFollowing: jest.fn(), setFollowing: jest.fn() }));
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ account: { id: 'real-id' } }) }));
const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));

function wrapper({ children }: { children: ReactNode }) { return <InteractionsProvider>{children}</InteractionsProvider>; }

beforeEach(() => {
  jest.resetAllMocks();
  resetFollowSession();
  jest.mocked(getFollowing).mockResolvedValue(false);
  jest.mocked(setFollowing).mockResolvedValue(undefined);
});

describe('follow persistido', () => {
  it('usa a relação entregue em lote sem request adicional por card', async () => {
    const { result } = await renderHook(() => useFollow('outra', true), { wrapper });
    expect(result.current.following).toBe(true);
    expect(getFollowing).not.toHaveBeenCalled();
    await act(async () => { await result.current.toggleFollow(); });
    expect(setFollowing).toHaveBeenCalledWith('outra', false);
    expect(result.current.following).toBe(false);
  });

  it('descarta a confirmação tardia depois de sair de um card com relação em lote', async () => {
    let finish: () => void = () => {};
    jest.mocked(setFollowing).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const view = await renderHook(() => useFollow('outra', false), { wrapper });
    let action = Promise.resolve(false);
    await act(async () => { action = view.result.current.toggleFollow(); });
    await view.unmount();
    await act(async () => { finish(); });
    expect(await action).toBe(false);
    expect(getFollowing).not.toHaveBeenCalled();
  });

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

  it('mostra seguir na hora e desfaz se o servidor recusar', async () => {
    let reject: (error: Error) => void = () => {};
    jest.mocked(setFollowing).mockImplementationOnce(() => new Promise((_, rej) => { reject = rej; }));
    const { result } = await renderHook(() => useFollow('outra', false), { wrapper });
    await act(async () => { void result.current.toggleFollow(); });
    expect(result.current.following).toBe(true);
    await act(async () => { reject(new NetworkError()); });
    expect(result.current.following).toBe(false);
    expect(mockShow).toHaveBeenCalled();
  });

  it('perfil privado fica solicitado, sem fingir que já segue', async () => {
    const { result } = await renderHook(() => useFollow('privada', false, { isPrivate: true }), { wrapper });
    await act(async () => { await result.current.toggleFollow(); });
    expect(setFollowing).toHaveBeenCalledWith('privada', true);
    expect(result.current.following).toBe(false);
    expect(result.current.requested).toBe(true);
  });

  it('a resposta do servidor corrige o palpite mesmo depois que a tela saiu', async () => {
    let finish: (value: { following: boolean; requested: boolean }) => void = () => {};
    jest.mocked(setFollowing).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = await renderHook(() => useFollow('outra', false), { wrapper });
    await act(async () => { void view.result.current.toggleFollow(); });
    expect(view.result.current.following).toBe(true);
    await view.unmount();
    await act(async () => { finish({ following: false, requested: true }); });
    expect(readRequested('outra')).toBe(true);
    expect(getFollowing).not.toHaveBeenCalled();
  });

  it('corrige o palpite quando a privacidade só chega na resposta', async () => {
    let finish: (value: { following: boolean; requested: boolean }) => void = () => {};
    jest.mocked(setFollowing).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = await renderHook(({ following }: { following: boolean }) => useFollow('privada', following), { wrapper, initialProps: { following: false } });
    await act(async () => { void view.result.current.toggleFollow(); });
    expect(view.result.current.following).toBe(true);
    await view.rerender({ following: true });
    await act(async () => { finish({ following: false, requested: true }); });
    expect(view.result.current.following).toBe(false);
    expect(view.result.current.requested).toBe(true);
  });

  it('dois botões da mesma pessoa compartilham solicitação e cancelamento', async () => {
    function usePair() {
      return {
        a: useFollow('privada', false, { isPrivate: true }),
        b: useFollow('privada', false, { isPrivate: true }),
      };
    }
    const { result } = await renderHook(usePair, { wrapper });
    await act(async () => { await result.current.a.toggleFollow(); });
    expect(result.current.a.requested).toBe(true);
    expect(result.current.b.requested).toBe(true);
    expect(result.current.a.following).toBe(false);
    await act(async () => { await result.current.b.toggleFollow(); });
    expect(setFollowing).toHaveBeenLastCalledWith('privada', false);
    expect(result.current.a.requested).toBe(false);
    expect(result.current.b.requested).toBe(false);
  });

  it.each(['me', 'real-id'])('não faz requests para seguir a própria identidade %s', async (id) => {
    const { result } = await renderHook(() => useFollow(id), { wrapper });
    await act(async () => { await result.current.toggleFollow(); });
    expect(getFollowing).not.toHaveBeenCalled();
    expect(setFollowing).not.toHaveBeenCalled();
  });
});
