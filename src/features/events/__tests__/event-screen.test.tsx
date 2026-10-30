import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ApiError, NotFoundError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';

import { settleQueryClient } from '../query-test-utils';

import { cancelEvent, getEvent, putAttendance } from '../api';
import EventScreen from '../event-screen';
import { resetAttendanceSession } from '../rsvp';
import type { ComunaEvent } from '../types';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({ id: '019abcde-0000-7000-8000-000000000010' }) }));
jest.mock('react-native-safe-area-context', () => { const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }; });
jest.mock('@/lib/routes', () => ({ goBack: jest.fn(), useNav: () => ({ openProfile: mockOpenProfile }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockToast }) }));
jest.mock('@/features/links/share', () => ({ shareDestination: jest.fn() }));
jest.mock('@/features/links/destinations', () => ({ openDestination: jest.fn() }));
jest.mock('../api', () => ({ getEvent: jest.fn(), putAttendance: jest.fn(), cancelEvent: jest.fn() }));

const mockToast = jest.fn();
const mockOpenProfile = jest.fn();
const base: ComunaEvent = {
  id: '019abcde-0000-7000-8000-000000000010',
  title: 'Assembleia mensal', description: 'Pauta da noite.', format: 'hybrid', status: 'scheduled', timeZone: 'America/Manaus',
  startsAt: '2026-11-05T19:00:00-04:00', endsAt: '2026-11-05T21:00:00-04:00', placeName: 'Sindicato dos Bancários', address: 'Rua X, 123', onlineUrl: 'https://meet.example.org/sala',
  comuna: { id: 'c', slug: 'londrina', name: 'Londrina', visibility: 'public', status: 'active' },
  organizer: { id: 'u1', name: 'Dona Souza', handle: 'dona', initials: 'DS', tone: 'red' },
  goingCount: 32, maybeCount: 8, viewerAttendance: null, canManage: true, canRespond: true, past: false,
  createdAt: '2026-11-01T15:00:00Z', updatedAt: '2026-11-01T15:00:00Z', cancelledAt: null,
};

beforeEach(async () => {
  settleQueryClient();
  await queryClient.cancelQueries();
  queryClient.clear();
  resetAttendanceSession();
  jest.clearAllMocks();
  jest.mocked(getEvent).mockResolvedValue(base);
  jest.mocked(putAttendance).mockImplementation(async (_id, status) => ({ ...base, viewerAttendance: status, goingCount: status === 'going' ? 33 : 32, maybeCount: status === 'maybe' ? 9 : 8 }));
});

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

describe('tela do evento', () => {
  it('mostra o carregamento enquanto a atividade não chega', async () => {
    jest.mocked(getEvent).mockReturnValue(new Promise(() => {}));
    await render(<EventScreen />);
    expect(screen.getByText('Abrindo a atividade')).toBeTruthy();
  });

  it('mostra a convocação, a contagem e compartilha o link canônico', async () => {
    await render(<EventScreen />);
    expect(await screen.findByText('Assembleia mensal')).toBeTruthy();
    expect(screen.getByText('32 vão · 8 talvez')).toBeTruthy();
    expect(screen.getByText('Sindicato dos Bancários')).toBeTruthy();
    expect(screen.getByText('19:00 – 21:00')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Compartilhar evento'));
    expect(jest.requireMock<{ shareDestination: jest.Mock }>('@/features/links/share').shareDestination).toHaveBeenCalledWith({ kind: 'event', id: base.id });
  });

  it('confirma Vou na hora, ignora o segundo toque e desfaz se o servidor falhar', async () => {
    let release: (value: ComunaEvent) => void = () => {};
    jest.mocked(putAttendance).mockReturnValue(new Promise((resolve) => { release = resolve; }));
    await render(<EventScreen />);
    await screen.findByText('Assembleia mensal');
    await fireEvent.press(screen.getByLabelText('Vou'));
    await fireEvent.press(screen.getByLabelText('Talvez'));
    expect(putAttendance).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('Vou, selecionado')).toBeTruthy();
    expect(screen.getByText('33 vão · 8 talvez')).toBeTruthy();
    await act(async () => { release({ ...base, viewerAttendance: 'going', goingCount: 40, maybeCount: 8 }); });
    expect(await screen.findByText('40 vão · 8 talvez')).toBeTruthy();

    jest.mocked(putAttendance).mockRejectedValue(new ApiError(409, '/errors/event-closed', 'Encerrado'));
    await fireEvent.press(screen.getByLabelText('Talvez'));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(screen.getByText('40 vão · 8 talvez')).toBeTruthy();
    expect(screen.getByLabelText('Vou, selecionado')).toBeTruthy();
  });

  it('evento cancelado, passado ou indisponível não aceita resposta nova', async () => {
    jest.mocked(getEvent).mockResolvedValue({ ...base, status: 'cancelled', canRespond: false, canManage: false });
    const { unmount } = await render(<EventScreen />);
    expect(await screen.findByText('Evento cancelado')).toBeTruthy();
    expect(screen.queryByLabelText('Vou')).toBeNull();
    unmount();
    await queryClient.cancelQueries();
    queryClient.clear();

    jest.mocked(getEvent).mockResolvedValue({ ...base, past: true, canRespond: false, canManage: false });
    const past = await render(<EventScreen />);
    expect(await screen.findByText('Esta atividade já aconteceu.')).toBeTruthy();
    past.unmount();
  });

  it('cancela sem apagar a atividade', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { buttons?.[1]?.onPress?.(); });
    jest.mocked(cancelEvent).mockResolvedValue({ ...base, status: 'cancelled', canRespond: false, canManage: false });
    await render(<EventScreen />);
    await fireEvent.press(await screen.findByText('Cancelar evento'));
    expect(cancelEvent).toHaveBeenCalledWith(base.id);
    expect(await screen.findByText('Evento cancelado')).toBeTruthy();
  });

  it('abre o perfil de quem organizou', async () => {
    await render(<EventScreen />);
    await fireEvent.press(await screen.findByLabelText('Organização, Dona Souza'));
    expect(mockOpenProfile).toHaveBeenCalledWith('u1');
  });

  it('não revela um evento privado e oferece nova tentativa quando a rede falha', async () => {
    jest.mocked(getEvent).mockRejectedValue(new NotFoundError('Evento'));
    const hidden = await render(<EventScreen />);
    expect(await screen.findByText('Evento indisponível')).toBeTruthy();
    expect(screen.queryByText('Assembleia mensal')).toBeNull();
    hidden.unmount();

    jest.mocked(getEvent).mockRejectedValue(new ApiError(500, '/errors/server', 'Falhou'));
    const failed = await render(<EventScreen />);
    const retry = await screen.findByText('Tentar de novo');
    jest.mocked(getEvent).mockResolvedValue(base);
    await fireEvent.press(retry);
    expect(await screen.findByText('Assembleia mensal')).toBeTruthy();
    failed.unmount();
  });
});
