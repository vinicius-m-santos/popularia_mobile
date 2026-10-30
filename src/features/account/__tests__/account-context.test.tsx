import { afterEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/query/client';
import { ApiError } from '@/lib/errors';
import { AccountProvider, useAccount } from '../account-context';
import { getMe, logout } from '../api';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/lib/monitoring', () => ({ setSentryUser: jest.fn(), clearSentryUser: jest.fn() }));
jest.mock('@/features/interactions/interactions-context', () => {
  const value = { resetAll: jest.fn(), replaceAll: jest.fn() };
  return { useInteractions: () => value };
});
jest.mock('@/lib/api/client', () => ({
  hasStoredSession: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  refreshSession: jest.fn<() => Promise<string>>().mockResolvedValue('token'),
  onSessionEnded: jest.fn(),
}));
jest.mock('../api', () => ({ getMe: jest.fn(), logout: jest.fn() }));

afterEach(async () => { await cleanup(); queryClient.clear(); });

it('limpa conta, rascunho e cache mesmo se a revogação de logout falhar', async () => {
  jest.mocked(getMe).mockResolvedValue({
    id: 'conta-anterior', displayName: 'Pessoa', handle: 'pessoa', bio: 'Privado',
    interests: [], city: null, state: null, country: null, countryCode: 'BR',
    stateIbgeCode: null, municipalityIbgeCode: null,
    email: 'pessoa@example.test', emailVerified: true, platformRole: 'user',
    createdAt: '2026-10-30T00:00:00Z', updatedAt: '2026-10-30T00:00:00Z',
    pendingOnboarding: false, hasPassword: true, legalAccepted: true, followerCount: 0,
  });
  jest.mocked(logout).mockRejectedValue(new ApiError(500, '/errors/server', 'Falha ao revogar'));
  const { result } = await renderHook(useAccount, {
    wrapper: ({ children }: { children: ReactNode }) => <AccountProvider>{children}</AccountProvider>,
  });
  await waitFor(() => expect(result.current.status).toBe('signedIn'));
  queryClient.setQueryData(['privado'], 'conteúdo anterior');
  await act(async () => { await expect(result.current.signOut()).rejects.toThrow('Falha ao revogar'); });
  expect(result.current.status).toBe('signedOut');
  expect(result.current.account).toBeNull();
  expect(result.current.profile.bio).toBe('');
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
