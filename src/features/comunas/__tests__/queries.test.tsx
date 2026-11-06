import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { queryClient } from '@/lib/query/client';
import type { ComunaDetails } from '@/types/models';

import * as api from '../api';
import { comunaKeys, rememberComunaSummary, toComunaSummary, updateComunaMembership } from '../keys';
import { comunaOptions, invalidateComunaReads, useComuna, writeComuna } from '../queries';

jest.mock('../api', () => {
  const actual = jest.requireActual<typeof import('../api')>('../api');
  return { ...actual, getComuna: jest.fn() };
});

const mocked = jest.mocked(api);

function comuna(patch: Partial<ComunaDetails> = {}): ComunaDetails {
  return {
    id: 'hortas',
    serverId: 'u1',
    visibility: 'public',
    status: 'active',
    name: 'Hortas',
    handle: 'hortas',
    initials: 'HO',
    tone: 'red',
    place: 'São Paulo · SP',
    foundedYear: '2026',
    description: 'Mutirões.',
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
    viewerIsMember: true,
    viewerRole: 'member',
    moderators: [],
    featuredMembers: [],
    members: [],
    ...patch,
  };
}

function invalidated(key: readonly unknown[]) {
  return queryClient.getQueryCache().find({ queryKey: [...key] })?.state.isInvalidated ?? false;
}

beforeEach(async () => {
  await queryClient.cancelQueries();
  queryClient.clear();
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

function Probe() {
  const comuna = useComuna('hortas');
  return <Text>{`${comuna.status}:${comuna.data?.name ?? ''}`}</Text>;
}

function Host({ screen: which }: { screen: 'comuna' | 'outra' }) {
  return which === 'comuna' ? <Probe /> : <Text>outra tela</Text>;
}

describe('query keys da comuna', () => {
  it('agrupa detalhe, resumo, posts, fixados, evento e Praça sob a mesma raiz', () => {
    expect(comunaKeys.group('hortas')).toEqual(['comuna', 'hortas']);
    expect(comunaKeys.detail('hortas')).toEqual(comunaKeys.group('hortas'));
    expect(comunaKeys.summary('hortas')).toEqual(['comuna', 'hortas', 'summary']);
    expect(comunaKeys.posts('hortas')).toEqual(['comuna', 'hortas', 'posts']);
    expect(comunaKeys.pins('hortas')).toEqual(['comuna', 'hortas', 'pins']);
    expect(comunaKeys.square('hortas')).toEqual(['comuna', 'hortas', 'square']);
    expect(comunaKeys.events('hortas', 'upcoming')).toEqual(['comuna', 'hortas', 'events', 'upcoming']);
    expect(comunaKeys.eventsAll('hortas')).toEqual(['comuna', 'hortas', 'events']);
  });

  it('invalida só as leituras derivadas da comuna pedida', async () => {
    queryClient.setQueryData(comunaKeys.detail('hortas'), comuna());
    queryClient.setQueryData(comunaKeys.posts('hortas'), { pages: [], pageParams: [] });
    queryClient.setQueryData(comunaKeys.pins('hortas'), []);
    queryClient.setQueryData(comunaKeys.square('hortas'), {});
    queryClient.setQueryData(comunaKeys.events('hortas', 'upcoming'), { pages: [], pageParams: [] });
    queryClient.setQueryData(comunaKeys.detail('tarifa'), comuna({ id: 'tarifa', name: 'Tarifa' }));

    await invalidateComunaReads('hortas');

    expect(invalidated(comunaKeys.posts('hortas'))).toBe(true);
    expect(invalidated(comunaKeys.pins('hortas'))).toBe(true);
    expect(invalidated(comunaKeys.square('hortas'))).toBe(true);
    expect(invalidated(comunaKeys.events('hortas', 'upcoming'))).toBe(true);
    expect(invalidated(comunaKeys.detail('hortas'))).toBe(false);
    expect(invalidated(comunaKeys.detail('tarifa'))).toBe(false);
  });
});

describe('detalhe compartilhado', () => {
  it('reaproveita o detalhe fresco sem request adicional', async () => {
    mocked.getComuna.mockResolvedValue(comuna());

    await queryClient.fetchQuery(comunaOptions('hortas'));
    const cached = await queryClient.fetchQuery(comunaOptions('hortas'));

    expect(cached.name).toBe('Hortas');
    expect(mocked.getComuna).toHaveBeenCalledTimes(1);
  });

  it('volta à comuna dentro do staleTime com conteúdo imediato e sem request', async () => {
    mocked.getComuna.mockResolvedValue(comuna());
    const view = await render(<Host screen="comuna" />);
    expect(await screen.findByText('success:Hortas')).toBeTruthy();
    const calls = mocked.getComuna.mock.calls.length;

    await view.rerender(<Host screen="outra" />);
    expect(screen.getByText('outra tela')).toBeTruthy();
    await view.rerender(<Host screen="comuna" />);

    expect(screen.getByText('success:Hortas')).toBeTruthy();
    expect(mocked.getComuna).toHaveBeenCalledTimes(calls);
    view.unmount();
  });

  it('usa o resumo da lista como placeholder enquanto o detalhe chega', async () => {
    rememberComunaSummary(comuna({ viewerIsMember: false, viewerRole: null }));
    let resolve!: (value: ComunaDetails) => void;
    mocked.getComuna.mockReturnValue(new Promise<ComunaDetails>((done) => { resolve = done; }));

    const { result, unmount } = await renderHook(() => useComuna('hortas'));

    expect(result.current.status).toBe('success');
    expect(result.current.data).toMatchObject({ name: 'Hortas', viewerIsMember: false });
    // O resumo não carrega pessoas nem permissões; o detalhe continua sendo a fonte delas.
    expect(result.current.data?.members).toEqual([]);
    expect(mocked.getComuna).toHaveBeenCalledTimes(1);

    await act(async () => { resolve(comuna({ description: 'Detalhe completo.', viewerIsMember: true })); });
    await waitFor(() => expect(result.current.data?.description).toBe('Detalhe completo.'));
    unmount();
  });

  it('edição grava o detalhe e o resumo compartilhados', () => {
    queryClient.setQueryData(comunaKeys.detail('hortas'), comuna());
    writeComuna(comuna({ description: 'Mutirões e feira.' }));

    expect(queryClient.getQueryData<ComunaDetails>(comunaKeys.detail('hortas'))?.description).toBe('Mutirões e feira.');
    expect(queryClient.getQueryData(comunaKeys.summary('hortas'))).toMatchObject({ description: 'Mutirões e feira.' });
  });
});

describe('participação', () => {
  it('entrar atualiza detalhe e resumo e invalida as listas da comuna', () => {
    queryClient.setQueryData(comunaKeys.detail('hortas'), comuna({ visibility: 'private', viewerIsMember: false, viewerRole: null, memberCount: 3 }));
    queryClient.setQueryData(comunaKeys.summary('hortas'), toComunaSummary(comuna({ visibility: 'private', viewerIsMember: false, viewerRole: null, memberCount: 3 })));
    queryClient.setQueryData(comunaKeys.posts('hortas'), { pages: [], pageParams: [] });
    queryClient.setQueryData(comunaKeys.pins('hortas'), []);
    queryClient.setQueryData(comunaKeys.square('hortas'), {});

    updateComunaMembership('hortas', true, 4);

    expect(queryClient.getQueryData<ComunaDetails>(comunaKeys.detail('hortas'))).toMatchObject({
      viewerIsMember: true,
      viewerRole: 'member',
      memberCount: 4,
    });
    expect(queryClient.getQueryData(comunaKeys.summary('hortas'))).toMatchObject({
      viewerIsMember: true,
      viewerRole: 'member',
      memberCount: 4,
    });
    expect(invalidated(comunaKeys.posts('hortas'))).toBe(true);
    expect(invalidated(comunaKeys.pins('hortas'))).toBe(true);
    expect(invalidated(comunaKeys.square('hortas'))).toBe(true);
  });

  it('sair remove permissões antigas do detalhe e descarta fixados', () => {
    const permissions = { canPost: true } as ComunaDetails['viewerPermissions'];
    queryClient.setQueryData(comunaKeys.detail('hortas'), comuna({ visibility: 'private', viewerIsMember: true, viewerPermissions: permissions }));
    queryClient.setQueryData(comunaKeys.pins('hortas'), []);

    updateComunaMembership('hortas', false);

    const detail = queryClient.getQueryData<ComunaDetails>(comunaKeys.detail('hortas'));
    expect(detail?.viewerIsMember).toBe(false);
    expect(detail?.viewerRole).toBeNull();
    expect(detail?.viewerPermissions).toBeUndefined();
    expect(queryClient.getQueryData(comunaKeys.pins('hortas'))).toBeUndefined();
  });
});
