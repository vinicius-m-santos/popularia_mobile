import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { settleQueryClient } from '../query-test-utils';
import { router } from 'expo-router';

import { getComuna } from '@/features/comunas/api';
import { ApiError } from '@/lib/errors';
import { openDestination } from '@/features/links/destinations';
import { queryClient } from '@/lib/query/client';

import { listEvents } from '../api';
import EventsScreen from '../events-screen';
import type { ComunaEvent } from '../types';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({ slug: 'londrina' }) }));
jest.mock('react-native-safe-area-context', () => { const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }; });
jest.mock('@/lib/routes', () => ({ goBack: jest.fn() }));
jest.mock('@/features/comunas/api', () => ({ getComuna: jest.fn() }));
jest.mock('@/features/links/destinations', () => ({ openDestination: jest.fn() }));
jest.mock('../api', () => ({ listEvents: jest.fn() }));
jest.mock('@/components/list/popularia-list', () => {
  const { View, Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PopulariaList: ({ data, renderItem, state, emptyTitle }: { data?: { id: string }[]; renderItem: (info: { item: never }) => ReactNode; state?: { hasMore?: boolean; loadMore?: () => void; status?: string; refresh?: () => void }; emptyTitle?: string }) => (
    <View>
      {data?.length ? data.map((item) => <View key={item.id}>{renderItem({ item: item as never })}</View>) : <Text>{emptyTitle}</Text>}
      {state?.hasMore ? <Pressable onPress={state.loadMore}><Text>Mais</Text></Pressable> : null}
      {state?.status === 'error' ? <Pressable onPress={state.refresh}><Text>Tentar de novo</Text></Pressable> : null}
    </View>
  ) };
});

function item(title: string, patch: Partial<ComunaEvent> = {}): ComunaEvent {
  return {
    id: title, title, description: '', format: 'in_person', status: 'scheduled', timeZone: 'America/Manaus',
    startsAt: '2026-11-05T19:00:00-04:00', endsAt: null, placeName: 'Sindicato', address: null, onlineUrl: null,
    comuna: { id: 'c', slug: 'londrina', name: 'Londrina', visibility: 'public', status: 'active' },
    organizer: null, goingCount: 2, maybeCount: 1, viewerAttendance: null, canManage: false, canRespond: true, past: false,
    createdAt: '2026-11-01T15:00:00Z', updatedAt: '2026-11-01T15:00:00Z', cancelledAt: null, ...patch,
  };
}

beforeEach(async () => {
  settleQueryClient();
  await queryClient.cancelQueries();
  queryClient.clear();
  jest.clearAllMocks();
  jest.mocked(getComuna).mockResolvedValue({ viewerPermissions: { canManageEvents: true } } as never);
});

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

describe('lista da comuna', () => {
  it('mostra os próximos, marca cancelado e pede a página seguinte', async () => {
    jest.mocked(listEvents).mockImplementation(async (_slug, _when, cursor) => (
      cursor ? { items: [item('Longe')], nextCursor: null } : { items: [item('Perto'), item('Cancelada', { status: 'cancelled' })], nextCursor: 'mais' }
    ));
    await render(<EventsScreen />);
    expect(await screen.findByText('Perto')).toBeTruthy();
    expect(screen.getByText('Evento cancelado')).toBeTruthy();
    await fireEvent.press(screen.getByText('Mais'));
    expect(await screen.findByText('Longe')).toBeTruthy();
  });

  it('lista passados do mais recente e o vazio dos próximos', async () => {
    jest.mocked(listEvents).mockImplementation(async (_slug, when) => ({ items: when === 'past' ? [item('Ontem', { past: true })] : [], nextCursor: null }));
    await render(<EventsScreen />);
    expect(await screen.findByText('Nenhuma atividade marcada')).toBeTruthy();
    await fireEvent.press(screen.getByText('Passados'));
    expect(await screen.findByText('Ontem')).toBeTruthy();
  });

  it('abre o evento e a criação quando a moderação pode', async () => {
    jest.mocked(listEvents).mockResolvedValue({ items: [item('Perto')], nextCursor: null });
    await render(<EventsScreen />);
    await fireEvent.press(await screen.findByText('Nova atividade'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/eventos/[slug]/novo', params: { slug: 'londrina' } });
    await fireEvent.press(screen.getByLabelText('Perto. 05 NOV 19:00'));
    expect(openDestination).toHaveBeenCalledWith({ kind: 'event', id: 'Perto' });
  });

  it('não revela a lista de uma comuna privada e tenta de novo após uma falha', async () => {
    jest.mocked(listEvents).mockRejectedValue(new ApiError(403, '/errors/comuna-private', 'Privada'));
    const { unmount } = await render(<EventsScreen />);
    expect(await screen.findByText('Você não pode ver os eventos desta comuna.')).toBeTruthy();
    expect(screen.queryByText('Perto')).toBeNull();
    unmount();

    jest.mocked(listEvents).mockRejectedValue(new ApiError(500, '/errors/server', 'Falhou'));
    await render(<EventsScreen />);
    const retry = await screen.findByText('Tentar de novo');
    jest.mocked(listEvents).mockResolvedValue({ items: [item('Perto')], nextCursor: null });
    await fireEvent.press(retry);
    expect(await screen.findByText('Perto')).toBeTruthy();
  });
});
