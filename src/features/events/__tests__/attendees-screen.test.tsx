import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { settleQueryClient } from '../query-test-utils';

import { NotFoundError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';

import { listAttendees } from '../api';
import AttendeesScreen from '../attendees-screen';

const mockOpenProfile = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: '019abcde-0000-7000-8000-000000000010', status: 'going' }) }));
jest.mock('react-native-safe-area-context', () => { const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }; });
jest.mock('@/lib/routes', () => ({ goBack: jest.fn(), useNav: () => ({ openProfile: mockOpenProfile }) }));
jest.mock('../api', () => ({ listAttendees: jest.fn() }));
jest.mock('@/components/list/popularia-list', () => {
  const { View, Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PopulariaList: ({ data, renderItem, state, emptyTitle }: { data?: { id: string }[]; renderItem: (info: { item: never }) => ReactNode; state?: { hasMore?: boolean; loadMore?: () => void }; emptyTitle?: string }) => (
    <View>
      {data?.length ? data.map((item) => <View key={item.id}>{renderItem({ item: item as never })}</View>) : <Text>{emptyTitle}</Text>}
      {state?.hasMore ? <Pressable onPress={state.loadMore}><Text>Mais</Text></Pressable> : null}
    </View>
  ) };
});
jest.mock('@/features/profiles/components/person-row', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PersonRow: ({ user, subtitle, onOpen }: { user: { name: string }; subtitle: string; onOpen: () => void }) => (
    <Pressable onPress={onOpen} accessibilityRole="link"><Text>{user.name}</Text><Text>{subtitle}</Text></Pressable>
  ) };
});

const person = { id: 'u1', handle: 'bia', displayName: 'Bia Nunes', avatarUrl: null };

beforeEach(async () => {
  settleQueryClient();
  await queryClient.cancelQueries();
  queryClient.clear();
  jest.clearAllMocks();
});

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

describe('quem vai', () => {
  it('pagina e abre o perfil', async () => {
    jest.mocked(listAttendees).mockImplementation(async (_id, _status, cursor) => (
      cursor ? { items: [{ ...person, id: 'u2', handle: 'caio', displayName: 'Caio' }], nextCursor: null } : { items: [person], nextCursor: 'proxima' }
    ));
    await render(<AttendeesScreen />);
    await fireEvent.press(await screen.findByText('Bia Nunes'));
    expect(mockOpenProfile).toHaveBeenCalledWith('u1');
    expect(screen.getByText('@bia')).toBeTruthy();
    await fireEvent.press(screen.getByText('Mais'));
    expect(await screen.findByText('Caio')).toBeTruthy();
    expect(listAttendees).toHaveBeenLastCalledWith('019abcde-0000-7000-8000-000000000010', 'going', 'proxima', expect.anything());
  });

  it('não mostra a lista de um evento indisponível', async () => {
    jest.mocked(listAttendees).mockRejectedValue(new NotFoundError('Evento'));
    await render(<AttendeesScreen />);
    expect(await screen.findByText('Lista indisponível')).toBeTruthy();
    expect(screen.queryByText('Bia Nunes')).toBeNull();
  });
});
