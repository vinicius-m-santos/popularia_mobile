import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import VerifyEmailScreen from '../verify-email-screen';
import { resendVerificationCode } from '@/features/account/api';

const mockConfirmEmail = jest.fn<(code: string) => Promise<void>>();
const mockToast = jest.fn();
const mockSearchParams: { sent?: string } = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockSearchParams,
}));
jest.mock('@/features/account/account-context', () => ({
  useAccount: () => ({ account: { email: 'ana@exemplo.org', emailVerified: false }, confirmEmail: mockConfirmEmail }),
}));
jest.mock('@/features/account/api', () => ({ resendVerificationCode: jest.fn() }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockToast }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

beforeEach(() => {
  jest.clearAllMocks();
  delete mockSearchParams.sent;
  jest.mocked(resendVerificationCode).mockResolvedValue(undefined);
  mockConfirmEmail.mockResolvedValue(undefined);
});

describe('confirmação de e-mail', () => {
  it('envia automaticamente uma vez e mantém o reenvio em cooldown', async () => {
    jest.useFakeTimers();
    const view = await render(<VerifyEmailScreen />);
    await act(async () => {});
    expect(resendVerificationCode).toHaveBeenCalledTimes(1);
    await view.rerender(<VerifyEmailScreen />);
    expect(resendVerificationCode).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Reenviar em \d+s/)).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(screen.getByText('Reenviar código')).toBeTruthy();
    jest.useRealTimers();
  });

  it('não duplica o código que o cadastro acabou de enviar', async () => {
    mockSearchParams.sent = '1';
    await render(<VerifyEmailScreen />);
    await act(async () => {});
    expect(resendVerificationCode).not.toHaveBeenCalled();
    expect(screen.getByText(/Reenviar em \d+s/)).toBeTruthy();
  });

  it('confirma pelo contexto compartilhado antes de voltar', async () => {
    await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText('Código'), '123456');
    await fireEvent.press(screen.getByText('Confirmar e-mail'));
    await waitFor(() => expect(mockConfirmEmail).toHaveBeenCalledWith('123456'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
