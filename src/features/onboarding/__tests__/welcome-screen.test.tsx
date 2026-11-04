import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import WelcomeScreen from '../welcome-screen';

const mockPush = jest.fn();
const mockStartSignup = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: jest.fn(),
}));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/features/account/account-context', () => ({ useAccount: () => ({ startSignup: mockStartSignup }) }));

describe('boas-vindas', () => {
  it('leva ao cadastro, ao login e aos documentos legais', async () => {
    await render(<WelcomeScreen />);

    await fireEvent.press(screen.getByLabelText('Criar minha conta'));
    expect(mockStartSignup).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/boas-vindas/conta', params: { modo: 'cadastro' } });

    await fireEvent.press(screen.getByLabelText('Já tem conta? Entrar'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/boas-vindas/conta', params: { modo: 'entrar' } });

    await fireEvent.press(screen.getByText('Termos de Uso'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/documento-legal/[id]', params: { id: 'termos' } });
  });
});
