import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { WelcomeBanner } from '../components/welcome-banner';

const mockDismiss = jest.fn();
let mockAccount = {
  showWelcome: true,
  dismissWelcome: mockDismiss,
  profile: { name: 'Vinicius Santos' },
  interests: ['edu', 'tec'],
};
let mockJoined: string[] = ['hortas'];

jest.mock('@/features/account/account-context', () => ({ useAccount: () => mockAccount }));
jest.mock('@/features/interactions/interactions-context', () => ({ useInteractions: () => ({ joinedComunaIds: mockJoined }) }));

describe('card de boas-vindas do feed', () => {
  it('mostra o primeiro nome, a frase e as etiquetas com singular e plural', async () => {
    mockAccount = { ...mockAccount, profile: { name: 'Vinicius Santos' }, interests: ['edu', 'tec'] };
    mockJoined = ['hortas'];
    await render(<WelcomeBanner />);

    expect(screen.getByLabelText('SEU FEED ESTÁ PRONTO, VINICIUS.')).toBeTruthy();
    expect(screen.getByText('Montamos com base no que te move.')).toBeTruthy();
    expect(screen.getByText('2 ASSUNTOS')).toBeTruthy();
    expect(screen.getByText('1 COMUNA')).toBeTruthy();
    expect(screen.getByLabelText('Fechar boas-vindas')).toBeTruthy();
  });

  it('sem nome usa só a primeira linha e esconde etiquetas com contagem zero', async () => {
    mockAccount = { ...mockAccount, profile: { name: '' }, interests: [] };
    mockJoined = [];
    await render(<WelcomeBanner />);

    expect(screen.getByLabelText('SEU FEED ESTÁ PRONTO.')).toBeTruthy();
    expect(screen.queryByText(/ASSUNTO/)).toBeNull();
    expect(screen.queryByText(/COMUNA/)).toBeNull();
  });

  it('não renderiza quando as boas-vindas já foram fechadas', async () => {
    mockAccount = { ...mockAccount, showWelcome: false };
    await render(<WelcomeBanner />);
    expect(screen.queryByLabelText(/SEU FEED ESTÁ PRONTO/)).toBeNull();
  });
});
