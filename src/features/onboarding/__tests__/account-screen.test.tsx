import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AccountScreen from '../account-screen';

const mockSetCredentials = jest.fn();
const mockSetLegal = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn(), setParams: jest.fn() },
}));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/hooks/use-keyboard-visible', () => ({ useKeyboardVisible: () => false }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('react-native-svg', () => ({ SvgXml: () => null }));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: async () => false,
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { WHITE_OUTLINE: 0 },
}));
jest.mock('@/features/account/account-context', () => ({
  useAccount: () => ({
    setSignupCredentials: mockSetCredentials,
    setLegalAcceptedDraft: mockSetLegal,
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
  }),
}));

describe('cadastro etapa 1', () => {
  it('mantém o formulário com erros de campo e só avança com credenciais válidas', async () => {
    await render(<AccountScreen />);
    const progress = screen.getByLabelText('Etapa 1 de 2');
    expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 2, now: 1 });

    await fireEvent.press(screen.getByLabelText('Continuar'));
    expect(mockSetCredentials).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText(/Tenho 18 anos ou mais/));
    expect(mockSetLegal).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByLabelText('Continuar'));
    await waitFor(() => expect(screen.getByText('Preencha o e-mail')).toBeTruthy());
    expect(screen.getByText('Preencha a senha')).toBeTruthy();
    expect(mockSetCredentials).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'pessoa@exemplo.org');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'uma senha longa');
    await fireEvent.press(screen.getByLabelText('Continuar'));

    await waitFor(() => expect(mockSetCredentials).toHaveBeenCalledWith('pessoa@exemplo.org', 'uma senha longa'));
    expect(mockPush).toHaveBeenCalledWith('/boas-vindas/perfil');
  });
});
