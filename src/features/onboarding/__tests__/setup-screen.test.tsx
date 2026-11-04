import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SetupScreen from '../setup-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/hooks/use-keyboard-visible', () => ({ useKeyboardVisible: () => false }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/locations/api', () => ({
  getCountries: async () => [{ code: 'BR', name: 'Brasil' }],
  getBrazilStates: async () => [{ id: '35', name: 'São Paulo', abbreviation: 'SP' }],
  getBrazilMunicipalities: async () => [{ id: '3550308', name: 'São Paulo' }],
}));
jest.mock('../api', () => ({
  suggestHandle: async () => 'mellowriver',
  checkHandleAvailable: async () => true,
}));
jest.mock('@/features/account/account-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useAccount: () => {
      const [profile, setProfile] = React.useState({ name: '', handle: 'mellowriver', city: '', state: '', country: 'Brasil', countryCode: 'BR', stateIbgeCode: '', municipalityIbgeCode: '', bio: '' });
      return {
        profile,
        updateProfile: (patch: Record<string, string>) => setProfile((current) => ({ ...current, ...patch })),
        account: null,
        completeSignupProfile: jest.fn(),
        completeSocialOnboarding: jest.fn(),
        replaceAvatarUrl: jest.fn(),
      };
    },
    useMe: () => ({ avatarUrl: null }),
  };
});

describe('cadastro etapa 2', () => {
  it('confirma o @ disponível e abre as opções de foto', async () => {
    await render(<SetupScreen />);

    await waitFor(() => expect(screen.getByText('Disponível')).toBeTruthy());
    expect(screen.getByText('popularia.com.br/@mellowriver')).toBeTruthy();
    expect(screen.getByText('Bio')).toBeTruthy();
    expect(screen.getByText('Estado')).toBeTruthy();
    expect(screen.getByText('Cidade')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Adicionar foto'));
    expect(screen.getByText('Tirar foto')).toBeTruthy();
    expect(screen.getByText('Escolher da galeria')).toBeTruthy();
  });
});
