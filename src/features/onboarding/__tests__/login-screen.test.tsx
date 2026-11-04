import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LoginScreen from '../login-screen';

const mockSignIn = jest.fn<(email: string, password: string) => Promise<void>>();
const mockStartSignup = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('react-native-svg', () => {
  const actual = jest.requireActual<typeof import('react-native-svg')>('react-native-svg');
  return { ...actual, SvgXml: () => null };
});
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: async () => false,
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { WHITE_OUTLINE: 0 },
}));
jest.mock('@/features/account/account-context', () => ({
  useAccount: () => ({
    signIn: (email: string, password: string) => mockSignIn(email, password),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    startSignup: mockStartSignup,
  }),
}));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/routes', () => ({ goBack: jest.fn() }));

describe('login', () => {
  it('mostra erros de campo vazio e não autentica', async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByLabelText('Entrar'));
    await waitFor(() => expect(screen.getByText('Preencha o e-mail')).toBeTruthy());
    expect(screen.getByText('Preencha a senha')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('envia e-mail e senha preenchidos', async () => {
    mockSignIn.mockResolvedValue(undefined);
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'pessoa@exemplo.org');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha segura');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('pessoa@exemplo.org', 'senha segura'));
  });
});
