import { describe, expect, it, jest } from '@jest/globals';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { useFollow } from '@/features/interactions/use-post-actions';

import { FollowButton } from '../components/follow-button';
import { PersonRow } from '../components/person-row';

jest.mock('@/features/account/account-context', () => ({
  useMe: () => ({ id: 'me' }),
  useAccount: () => ({ account: { id: 'real-id' } }),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

function wrapper({ children }: { children: ReactNode }) {
  return <InteractionsProvider>{children}</InteractionsProvider>;
}

describe('seguir a si mesmo', () => {
  it.each(['me', 'real-id'])('bloqueia a ação no hook e oculta o botão para %s', async (id) => {
    const { result } = await renderHook(() => useFollow(id), { wrapper });
    await act(() => { result.current.toggleFollow(); });
    expect(result.current.canFollow).toBe(false);
    expect(result.current.following).toBe(false);
    await render(<FollowButton user={{ id, name: 'Você' }} />, { wrapper });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a lista de pessoas não oferece seguir o próprio usuário', async () => {
    await render(<PersonRow user={{ id: 'me', name: 'Você', handle: 'voce', initials: 'VO', tone: 'red' }} subtitle="Perfil" onOpen={() => {}} />, { wrapper });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('continua permitindo seguir e deixar de seguir outra pessoa', async () => {
    const { result } = await renderHook(() => useFollow('outra'), { wrapper });
    await act(() => { result.current.toggleFollow(); });
    expect(result.current.following).toBe(true);
    await act(() => { result.current.toggleFollow(); });
    expect(result.current.following).toBe(false);
  });
});
