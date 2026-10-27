import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DeletionPanel } from '../deletion-panel';
import { useAccount } from '../account-context';
import { getAuthIdentities, type DeletionProof } from '../api';

jest.mock('../account-context', () => ({ useAccount: jest.fn() }));
jest.mock('../api', () => ({ getAuthIdentities: jest.fn() }));
const remove = jest.fn<(proof: DeletionProof) => Promise<void>>();
const mockedAccount = jest.mocked(useAccount);
const identities = jest.mocked(getAuthIdentities);

beforeEach(() => {
  jest.clearAllMocks();
  remove.mockResolvedValue(undefined);
  mockedAccount.mockReturnValue({ account: { hasPassword: true }, deleteAccount: remove } as unknown as ReturnType<typeof useAccount>);
  identities.mockResolvedValue({ identities: [] });
});

describe('exclusão de conta', () => {
  it('não exclui antes de digitar confirmação, senha e confirmar o alerta destrutivo', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<DeletionPanel />);
    await fireEvent.press(screen.getByText('Excluir conta'));
    await fireEvent.press(screen.getByText('Excluir com senha'));
    expect(alert).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    await fireEvent.changeText(screen.getByLabelText('Confirme sua senha atual'), 'senha-atual');
    await fireEvent.press(screen.getByText('Excluir com senha'));
    expect(remove).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2];
    await act(async () => { buttons?.find((button) => button.style === 'destructive')?.onPress?.(); });
    expect(remove).toHaveBeenCalledWith({ confirmation: 'EXCLUIR', password: 'senha-atual' });
    alert.mockRestore();
  });

  it('conta social sem senha oferece confirmação social e não pede senha local', async () => {
    mockedAccount.mockReturnValue({ account: { hasPassword: false }, deleteAccount: remove } as unknown as ReturnType<typeof useAccount>);
    identities.mockResolvedValue({ identities: [{ provider: 'google', linkedAt: '2026-10-27' }] });
    await render(<DeletionPanel />);
    await fireEvent.press(screen.getByText('Excluir conta'));
    expect(screen.queryByLabelText('Confirme sua senha atual')).toBeNull();
    expect(screen.getByText('Confirmar com Google e excluir')).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
  });
});
