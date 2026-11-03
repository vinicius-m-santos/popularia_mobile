import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Linking } from 'react-native';

import { InteractionsProvider } from '@/features/interactions/interactions-context';

import { ChamadoCard, type ChamadoCardData } from '../chamado-card';

const mockToast = jest.fn();
const mockOpenURL = jest.spyOn(Linking, 'openURL');

jest.mock('@/features/account/account-context', () => ({
  useMe: () => ({ id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red', avatarUrl: null }),
}));
jest.mock('@/constants/config', () => {
  const actual = jest.requireActual<typeof import('@/constants/config')>('@/constants/config');
  return { ...actual, DEMO_MODE: true };
});
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockToast }) }));

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

const marina = { id: 'marina', name: 'Marina Alves', handle: 'marina', initials: 'MA', tone: 'cream' as const };
const rafael = { id: 'rafa', name: 'Rafael Prado', handle: 'rafa', initials: 'RP', tone: 'black' as const };

function data(overrides: Partial<ChamadoCardData> = {}): ChamadoCardData {
  return {
    id: 'chamado-1',
    title: 'Ato pela Tarifa Zero',
    description: 'Concentração na Praça Sete.',
    startsAt: inDays(3),
    timeZone: 'America/Sao_Paulo',
    placeName: 'Praça Sete de Setembro, Centro',
    address: 'Rua X, 123',
    cover: null,
    coverFit: 'cover',
    capacityMode: null,
    capacity: null,
    goingCount: 12,
    maybeCount: 4,
    goingUsers: [marina, rafael],
    viewerAttendance: null,
    past: false,
    cancelled: false,
    ...overrides,
  };
}

function card(element: ReactElement) {
  return render(<InteractionsProvider>{element}</InteractionsProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenURL.mockResolvedValue();
});

describe('cartão de chamado no feed', () => {
  it('mostra título, data, lugar, quem vai e o rótulo de entrada livre', async () => {
    await card(<ChamadoCard data={data()} />);
    expect(screen.getByText('Ato pela Tarifa Zero')).toBeTruthy();
    expect(screen.getByText('Concentração na Praça Sete.')).toBeTruthy();
    expect(screen.getByText('Praça Sete de Setembro, Centro')).toBeTruthy();
    expect(screen.getByText('Entrada livre · sem limite de vagas')).toBeTruthy();
    expect(screen.getByText(/Marina, Rafael e mais 10 vão/)).toBeTruthy();
    expect(screen.getByText(/4 talvez/)).toBeTruthy();
    expect(screen.queryByText('6 DE 8 VAGAS')).toBeNull();
  });

  it('confirma presença, atualiza a contagem e entra na lista de quem vai', async () => {
    await card(<ChamadoCard data={data()} />);
    await fireEvent.press(screen.getByLabelText('Eu vou: Ato pela Tarifa Zero'));
    expect(screen.getByText('VOCÊ VAI ✓')).toBeTruthy();
    expect(screen.getByText(/Você, Marina e mais 11 vão/)).toBeTruthy();
    expect(screen.getByLabelText('Cancelar presença: Ato pela Tarifa Zero')).toBeTruthy();
  });

  it('marca talvez como exclusivo do eu vou', async () => {
    await card(<ChamadoCard data={data()} />);
    await fireEvent.press(screen.getByLabelText('Talvez: Ato pela Tarifa Zero'));
    expect(screen.getByLabelText('Cancelar talvez: Ato pela Tarifa Zero')).toBeTruthy();
    expect(screen.queryByText('VOCÊ VAI ✓')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Eu vou: Ato pela Tarifa Zero'));
    expect(screen.getByText('VOCÊ VAI ✓')).toBeTruthy();
    expect(screen.queryByLabelText('Cancelar talvez: Ato pela Tarifa Zero')).toBeNull();
  });

  it('mostra vagas e desabilita o eu vou quando lotou', async () => {
    await card(<ChamadoCard data={data({ capacityMode: 'spots', capacity: 8, goingCount: 8 })} />);
    expect(screen.getByText('8 DE 8 VAGAS')).toBeTruthy();
    expect(screen.getByText('LOTOU')).toBeTruthy();
    expect(screen.getByLabelText('Eu vou: Ato pela Tarifa Zero')).toBeDisabled();
  });

  it('mostra quanto falta para a meta e celebra a meta batida', async () => {
    const { rerender } = await card(<ChamadoCard data={data({ capacityMode: 'goal', capacity: 10, goingCount: 7 })} />);
    expect(screen.getByText('META: 10 PESSOAS')).toBeTruthy();
    expect(screen.getByText('FALTAM 3 PRA CONFIRMAR')).toBeTruthy();
    await rerender(<InteractionsProvider><ChamadoCard data={data({ capacityMode: 'goal', capacity: 10, goingCount: 10 })} /></InteractionsProvider>);
    expect(screen.getByText('META BATIDA ✓')).toBeTruthy();
  });

  it('abre o Google Agenda com título, data, hora e local preenchidos', async () => {
    await card(<ChamadoCard data={data()} />);
    await fireEvent.press(screen.getByLabelText('Adicionar à agenda: Ato pela Tarifa Zero'));
    await waitFor(() => expect(mockOpenURL).toHaveBeenCalledTimes(1));
    const url = decodeURIComponent(String(mockOpenURL.mock.calls[0][0]));
    expect(url).toContain('https://calendar.google.com/calendar/render?');
    expect(url).toContain('text=Ato pela Tarifa Zero');
    expect(url).toContain('location=Praça Sete de Setembro, Centro — Rua X, 123');
    expect(url).toMatch(/dates=\d{8}T\d{6}Z\/\d{8}T\d{6}Z/);
    expect(mockToast).toHaveBeenCalledWith('Abrindo o Google Agenda com o chamado preenchido.');
  });
});
