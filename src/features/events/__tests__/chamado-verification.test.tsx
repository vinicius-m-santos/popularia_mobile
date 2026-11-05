import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { ApiError, NetworkError } from '@/lib/errors';

import { putAttendance } from '../api';
import { ChamadoCard, useChamadoAttendance, type ChamadoCardData } from '../chamado-card';
import type { ComunaEvent } from '../types';

const NOTICE = 'Confirme seu e-mail para marcar presença neste chamado.';

let mockAccount: { emailVerified: boolean } | null = { emailVerified: true };
const mockReloadAccount = jest.fn(async () => {});
const mockToast = jest.fn();

jest.mock('@/constants/config', () => {
  const actual = jest.requireActual<typeof import('@/constants/config')>('@/constants/config');
  return { ...actual, DEMO_MODE: false };
});
jest.mock('@/features/account/account-context', () => ({
  useMe: () => ({ id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red', avatarUrl: null }),
  useAccount: () => ({ account: mockAccount, reloadAccount: mockReloadAccount }),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockToast }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../api', () => ({ putAttendance: jest.fn() }));

const mockPush = jest.mocked(router.push);
const mockPutAttendance = jest.mocked(putAttendance);

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

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
    goingUsers: [],
    viewerAttendance: null,
    past: false,
    cancelled: false,
    ...overrides,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => <InteractionsProvider>{children}</InteractionsProvider>;

function card(overrides: Partial<ChamadoCardData> = {}) {
  return render(<ChamadoCard data={data(overrides)} />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccount = { emailVerified: true };
  mockReloadAccount.mockResolvedValue(undefined);
  mockPutAttendance.mockResolvedValue({} as ComunaEvent);
});

describe('presença de chamado e e-mail não confirmado', () => {
  it('conta não verificada: Eu vou mostra a causa e o caminho, sem requisição nem mutação otimista', async () => {
    mockAccount = { emailVerified: false };
    await card();

    expect(screen.queryByText(NOTICE)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Eu vou: Ato pela Tarifa Zero'));

    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByLabelText('Verificar e-mail')).toBeTruthy();
    expect(mockPutAttendance).not.toHaveBeenCalled();
    expect(screen.getByText('EU VOU')).toBeTruthy();
    expect(screen.queryByText('VOCÊ VAI ✓')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Verificar e-mail'));
    expect(mockPush).toHaveBeenCalledWith('/verificar-email');
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('conta não verificada: Talvez também explica a restrição sem confirmar presença', async () => {
    mockAccount = { emailVerified: false };
    await card();

    await fireEvent.press(screen.getByLabelText('Talvez: Ato pela Tarifa Zero'));

    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(mockPutAttendance).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Cancelar talvez: Ato pela Tarifa Zero')).toBeNull();
    expect(screen.getByText('Talvez')).toBeTruthy();
  });

  it('hook não aplica estado otimista quando a restrição já é conhecida', async () => {
    mockAccount = { emailVerified: false };
    const { result } = await renderHook(() => useChamadoAttendance(data()), { wrapper });

    expect(result.current.verificationRequired).toBe(true);
    expect(result.current.verificationPrompt).toBe(false);

    await act(async () => {
      await result.current.setAttendance('going');
    });

    expect(result.current.going).toBe(false);
    expect(result.current.maybe).toBe(false);
    expect(result.current.verificationPrompt).toBe(true);
    expect(mockPutAttendance).not.toHaveBeenCalled();
  });

  it('estado atualizado: com a conta verificada, uma nova tentativa confirma e recolhe o aviso', async () => {
    mockAccount = { emailVerified: false };
    const { result, rerender } = await renderHook((_tick: number) => useChamadoAttendance(data()), {
      wrapper,
      initialProps: 0,
    });

    await act(async () => {
      await result.current.setAttendance('maybe');
    });
    expect(result.current.verificationPrompt).toBe(true);

    mockAccount = { emailVerified: true };
    await rerender(1);
    expect(result.current.verificationRequired).toBe(false);

    await act(async () => {
      await result.current.setAttendance('going');
    });

    expect(result.current.verificationPrompt).toBe(false);
    expect(result.current.going).toBe(true);
    expect(mockPutAttendance).toHaveBeenCalledWith('chamado-1', 'going');
  });
});

describe('presença de chamado com e-mail confirmado', () => {
  it('confirma, troca e cancela a presença normalmente', async () => {
    await card();

    await fireEvent.press(screen.getByLabelText('Eu vou: Ato pela Tarifa Zero'));
    await waitFor(() => expect(mockPutAttendance).toHaveBeenNthCalledWith(1, 'chamado-1', 'going'));
    await waitFor(() => expect(screen.getByText('VOCÊ VAI ✓')).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText('Cancelar presença: Ato pela Tarifa Zero')).toBeEnabled());

    await fireEvent.press(screen.getByLabelText('Talvez: Ato pela Tarifa Zero'));
    await waitFor(() => expect(mockPutAttendance).toHaveBeenNthCalledWith(2, 'chamado-1', 'maybe'));
    await waitFor(() => expect(screen.getByLabelText('Cancelar talvez: Ato pela Tarifa Zero')).toBeEnabled());

    await fireEvent.press(screen.getByLabelText('Cancelar talvez: Ato pela Tarifa Zero'));
    await waitFor(() => expect(mockPutAttendance).toHaveBeenNthCalledWith(3, 'chamado-1', 'not_going'));
    await waitFor(() => expect(screen.getByText('EU VOU')).toBeTruthy());

    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(mockReloadAccount).not.toHaveBeenCalled();
  });
});

describe('falhas ao atualizar presença', () => {
  it('recusa de e-mail não verificado desfaz o otimista, orienta e recarrega a conta', async () => {
    mockPutAttendance.mockRejectedValue(new ApiError(403, '/errors/email-not-verified', 'Confirme seu e-mail.'));
    await card();

    await fireEvent.press(screen.getByLabelText('Talvez: Ato pela Tarifa Zero'));

    await waitFor(() => expect(screen.getByText(NOTICE)).toBeTruthy());
    expect(screen.queryByLabelText('Cancelar talvez: Ato pela Tarifa Zero')).toBeNull();
    expect(mockReloadAccount).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it.each([
    ['servidor', new ApiError(500, '/errors/server', 'Falhou')],
    ['rede', new NetworkError()],
  ])('erro real de %s mantém a mensagem genérica e não vira falta de verificação', async (_label, error) => {
    mockPutAttendance.mockRejectedValue(error);
    await card();

    await fireEvent.press(screen.getByLabelText('Eu vou: Ato pela Tarifa Zero'));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Não foi possível atualizar sua presença. Tente de novo.'));
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(mockReloadAccount).not.toHaveBeenCalled();
    expect(screen.getByText('EU VOU')).toBeTruthy();
  });
});
