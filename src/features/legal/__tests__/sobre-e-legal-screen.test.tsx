import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { SobreELegalScreen } from '../sobre-e-legal-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.3.4' } } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/routes', () => ({ goBack: jest.fn() }));

const mockedPush = jest.mocked(router.push);

describe('sobre e legal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue();
  });

  it('mostra a versão do build no rodapé', async () => {
    await render(<SobreELegalScreen />);
    expect(screen.getByText(/2\.3\.4/)).toBeTruthy();
    expect(screen.getByText(/Primeiro beta/i)).toBeTruthy();
  });

  it('abre o documento ao tocar no card inteiro', async () => {
    await render(<SobreELegalScreen />);
    fireEvent.press(screen.getByLabelText('Regras da Comunidade, Convivência, denúncias e moderação'));
    expect(mockedPush).toHaveBeenCalledWith({ pathname: '/documento-legal/[id]', params: { id: 'regras' } });
  });

  it('abre o e-mail de suporte com o assunto combinado', async () => {
    await render(<SobreELegalScreen />);
    fireEvent.press(screen.getByLabelText('Não consegue entrar?, suporte@popularia.com.br'));
    expect(Linking.openURL).toHaveBeenCalledWith('mailto:suporte@popularia.com.br?subject=Ajuda%20para%20entrar');
  });

  it('abre a lista de licenças de código aberto', async () => {
    await render(<SobreELegalScreen />);
    fireEvent.press(screen.getByLabelText('Licenças de código aberto, Bibliotecas e fontes que usamos'));
    expect(mockedPush).toHaveBeenCalledWith('/licencas');
  });
});
