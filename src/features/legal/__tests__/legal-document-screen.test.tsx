import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { LegalDocumentPage } from '../legal-document-screen';

const mockUseAccount = jest.fn<() => { account: { id: string } | null }>(() => ({ account: null }));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/routes', () => ({ goBack: jest.fn() }));
jest.mock('@/features/account/account-context', () => ({ useAccount: () => mockUseAccount() }));

const mockedPush = jest.mocked(router.push);

describe('documento legal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccount.mockReturnValue({ account: null });
    jest.spyOn(Linking, 'openURL').mockResolvedValue();
  });

  it('mostra título, abertura e seções numeradas automaticamente', async () => {
    await render(<LegalDocumentPage id="regras" />);
    expect(screen.getByText('Regras da Comunidade')).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('05')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Respeito' })).toBeTruthy();
  });

  it('lê os chips de proibição como texto e o caminho no app por extenso', async () => {
    await render(<LegalDocumentPage id="regras" />);
    expect(screen.getByLabelText('Racismo, Discriminação, Desumanização, Propaganda nazista, Ameaças, Assédio, Perseguição, Incentivo à violência')).toBeTruthy();
    expect(screen.getByLabelText('No app: ··· → Denunciar ou Bloquear')).toBeTruthy();
  });

  it('sem sessão, o card de suporte abre o e-mail', async () => {
    await render(<LegalDocumentPage id="regras" />);
    fireEvent.press(screen.getByLabelText('Ficou com dúvida? Fale com o suporte'));
    expect(Linking.openURL).toHaveBeenCalledWith(
      `mailto:suporte@popularia.com.br?subject=${encodeURIComponent('Suporte · Popularia')}`,
    );
  });

  it('com sessão, o card de suporte abre a tela de contato', async () => {
    mockUseAccount.mockReturnValue({ account: { id: 'pessoa-1' } });
    await render(<LegalDocumentPage id="regras" />);
    fireEvent.press(screen.getByLabelText('Ficou com dúvida? Fale com o suporte'));
    expect(mockedPush).toHaveBeenCalledWith('/conta/contato');
  });

  it('o card de link abre o documento indicado', async () => {
    await render(<LegalDocumentPage id="termos" />);
    fireEvent.press(screen.getByLabelText('Ler as Regras da Comunidade'));
    expect(mockedPush).toHaveBeenCalledWith({ pathname: '/documento-legal/[id]', params: { id: 'regras' } });
  });

  it('documento desconhecido não quebra a tela', async () => {
    await render(<LegalDocumentPage id="inexistente" />);
    expect(screen.getByText('Documento não encontrado.')).toBeTruthy();
  });
});
