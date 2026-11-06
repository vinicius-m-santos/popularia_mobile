import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { ComunaDetails } from '@/types/models';

import { getComuna } from '../api';
import { applyComunaMembership, invalidateComunaReads, useComuna } from '../queries';

jest.mock('../api', () => ({ getComuna: jest.fn() }));

const mocked = jest.mocked(getComuna);

function comuna(patch: Partial<ComunaDetails> = {}): ComunaDetails {
  return {
    id: 'hortas',
    name: 'Hortas',
    handle: 'hortas',
    initials: 'HO',
    tone: 'red',
    place: 'São Paulo',
    foundedYear: '2024',
    description: 'Mutirões',
    memberCount: 3,
    coverAlt: '',
    topics: [],
    stats: [],
    rules: [],
    moderationNote: '',
    pinned: null,
    moderatorIds: [],
    founderRole: '',
    featuredMemberIds: [],
    visibility: 'public',
    status: 'active',
    viewerIsMember: false,
    viewerRole: null,
    moderators: [],
    members: [],
    featuredMembers: [],
    ...patch,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
});

afterEach(async () => {
  await cleanup();
  queryClient.clear();
});

describe('cache por domínio da comuna', () => {
  it('compartilha o detalhe e não repete a leitura entre duas telas', async () => {
    mocked.mockResolvedValue(comuna());
    const useTest = () => ({ left: useComuna('hortas'), right: useComuna('hortas') });
    const { result } = await renderHook(useTest);
    await waitFor(() => expect(result.current.left.data?.name).toBe('Hortas'));
    expect(result.current.right.data?.name).toBe('Hortas');
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('rejeita payload parcial em vez de gravar uma comuna incompleta', async () => {
    mocked.mockResolvedValue({ id: 'hortas', name: 'Hortas' } as never);
    const { result } = await renderHook(() => useComuna('hortas'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(queryClient.getQueryData(queryKeys.comuna.detail('hortas'))).toBeUndefined();
  });

  it('participar/sair altera só os campos de membership e preserva o restante do detalhe', () => {
    queryClient.setQueryData(queryKeys.comuna.detail('vila'), comuna({
      id: 'vila', name: 'Vila', handle: 'vila', visibility: 'private', viewerIsMember: false, viewerPermissions: undefined,
    }));
    applyComunaMembership('vila', { slug: 'vila', isMember: true, role: 'member', memberCount: 9 });
    const joined = queryClient.getQueryData<ComunaDetails>(queryKeys.comuna.detail('vila'));
    expect(joined).toMatchObject({ name: 'Vila', description: 'Mutirões', viewerIsMember: true, viewerRole: 'member', memberCount: 9 });

    applyComunaMembership('vila', null);
    const left = queryClient.getQueryData<ComunaDetails>(queryKeys.comuna.detail('vila'));
    expect(left?.viewerIsMember).toBe(false);
    expect(left?.viewerRole).toBeNull();
    expect(left?.name).toBe('Vila');
    expect(left?.viewerPermissions).toBeUndefined();
  });

  it('invalida só as leituras derivadas daquela comuna', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve());
    await invalidateComunaReads('hortas');
    expect(invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey)).toEqual([
      ['comuna', 'hortas', 'posts'],
      ['comuna', 'hortas', 'pins'],
      ['comuna', 'hortas', 'square'],
      ['comuna', 'hortas', 'events'],
    ]);
    invalidate.mockRestore();
  });
});
