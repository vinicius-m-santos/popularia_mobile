import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAccount } from '@/features/account/account-context';
import { acceptLegal } from '@/features/account/api';
import LegalAcceptanceScreen from '../legal-acceptance-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/account/account-context', () => ({ useAccount: jest.fn() }));
jest.mock('@/features/account/api', () => ({ acceptLegal: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const reloadAccount = jest.fn<() => Promise<void>>();
const signOut = jest.fn<() => Promise<void>>();

beforeEach(() => {
  jest.clearAllMocks();
  reloadAccount.mockResolvedValue(undefined);
  signOut.mockResolvedValue(undefined);
  jest.mocked(acceptLegal).mockResolvedValue({} as never);
  jest.mocked(useAccount).mockReturnValue({ reloadAccount, signOut } as unknown as ReturnType<typeof useAccount>);
});

describe('aceite legal obrigatório', () => {
  it('abre Sobre e legal como rota e não oferece bypass nem exclusão', async () => {
    await render(<LegalAcceptanceScreen />);
    await fireEvent.press(screen.getByText('Sobre e legal'));
    expect(router.push).toHaveBeenCalledWith('/sobre-e-legal');
    expect(screen.queryByText('Continuar apenas para gerenciar a conta')).toBeNull();
    expect(screen.queryByText('Excluir conta')).toBeNull();
    expect(screen.getByText('Sair da conta')).toBeTruthy();
  });

  it('só confirma após marcar o aceite e então invalida a conta global', async () => {
    await render(<LegalAcceptanceScreen />);
    const submit = screen.getByRole('button', { name: 'Aceitar e continuar' });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar e continuar' }));
    await waitFor(() => expect(acceptLegal).toHaveBeenCalledTimes(1));
    expect(reloadAccount).toHaveBeenCalledTimes(1);
  });
});
