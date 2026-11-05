import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

import { useChamadoAttendance, type ChamadoCardData } from '../chamado-card';

const mockSetOn = jest.fn();
const mockIsOn = jest.fn((_kind: string, _id: string) => false);

jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({
    isOn: (kind: string, id: string) => mockIsOn(kind, id),
    setOn: mockSetOn,
  }),
}));
jest.mock('@/features/account/account-context', () => ({
  useMe: () => ({ id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red', avatarUrl: null }),
  useAccount: () => ({ account: { emailVerified: true }, reloadAccount: jest.fn() }),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/constants/config', () => {
  const actual = jest.requireActual<typeof import('@/constants/config')>('@/constants/config');
  return { ...actual, DEMO_MODE: true };
});

function data(overrides: Partial<ChamadoCardData> = {}): ChamadoCardData {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 3);
  return {
    id: 'chamado-1',
    title: 'Ato pela Tarifa Zero',
    description: 'Concentração na Praça Sete.',
    startsAt: startsAt.toISOString(),
    timeZone: 'America/Sao_Paulo',
    placeName: 'Praça Sete de Setembro, Centro',
    address: 'Rua X, 123',
    cover: null,
    coverFit: 'cover',
    capacityMode: null,
    capacity: null,
    goingCount: 12,
    maybeCount: 0,
    goingUsers: [],
    viewerAttendance: null,
    past: false,
    cancelled: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOn.mockReturnValue(false);
});

describe('presença do chamado', () => {
  it('não despacha ao montar quando "vou" já está correto no estado local', async () => {
    mockIsOn.mockImplementation((kind) => kind === 'goingEvents');

    await renderHook(() => useChamadoAttendance(data({ viewerAttendance: 'going' })));

    expect(mockSetOn).not.toHaveBeenCalled();
  });

  it('não despacha ao montar quando "talvez" já está correto no estado local', async () => {
    mockIsOn.mockImplementation((kind) => kind === 'maybeEvents');

    await renderHook(() => useChamadoAttendance(data({ viewerAttendance: 'maybe' })));

    expect(mockSetOn).not.toHaveBeenCalled();
  });

  it('alinha o estado local quando o servidor diz que a pessoa vai', async () => {
    await renderHook(() => useChamadoAttendance(data({ viewerAttendance: 'going' })));

    expect(mockSetOn).toHaveBeenCalledTimes(1);
    expect(mockSetOn).toHaveBeenCalledWith('goingEvents', ['chamado-1'], true);
  });

  it('não reafirma a presença do servidor quando o estado local muda', async () => {
    const { rerender } = await renderHook(
      ({ chamado }: { chamado: ChamadoCardData }) => useChamadoAttendance(chamado),
      { initialProps: { chamado: data({ viewerAttendance: 'going' }) } },
    );
    expect(mockSetOn).toHaveBeenCalledTimes(1);

    // A pessoa confirma, o estado local passa a "vou" e depois cancela. O dado
    // do servidor continua "going"; o efeito não pode desfazer o toque.
    mockSetOn.mockClear();
    mockIsOn.mockImplementation((kind) => kind === 'goingEvents');
    await rerender({ chamado: data({ viewerAttendance: 'going' }) });
    expect(mockSetOn).not.toHaveBeenCalled();

    mockSetOn.mockClear();
    mockIsOn.mockReturnValue(false);
    await rerender({ chamado: data({ viewerAttendance: 'going' }) });
    expect(mockSetOn).not.toHaveBeenCalled();
  });
});
