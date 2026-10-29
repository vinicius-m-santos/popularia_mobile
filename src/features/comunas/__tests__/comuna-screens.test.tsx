/**
 * Telas de criar e gerir comuna com a API configurada: usam as funções reais da API (aqui
 * simuladas), mostram as recusas do servidor e nunca caem para dados fictícios.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { ComunaQuotaDto } from '@/lib/api/dto';
import { ApiError, NetworkError } from '@/lib/errors';
import type { ComunaDetails } from '@/types/models';

import * as api from '../api';
import CreateComunaScreen from '../create-comuna-screen';
import ManageComunaScreen from '../manage-comuna-screen';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, API_BASE_URL: 'http://api.test/api/v1', API_TIMEOUT_MS: 1000 }));

jest.mock('../api', () => {
  const actual = jest.requireActual<typeof import('../api')>('../api');
  return {
    ...actual,
    getComunaQuota: jest.fn(),
    checkComunaName: jest.fn(),
    createComuna: jest.fn(),
    getComuna: jest.fn(),
    getComunaMembers: jest.fn(),
    deleteComuna: jest.fn(),
    archiveComuna: jest.fn(),
    updateComuna: jest.fn(),
  };
});

jest.mock('@/features/onboarding/api', () => ({ getTopicGroups: () => Promise.resolve([{ title: 'Cultura e ideias', topics: [{ id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' }, { id: 'trab', label: 'Trabalho e direitos trabalhistas', shortLabel: 'Trabalho' }] }]) }));

const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: 'hortas' }),
  usePreventRemove: () => jest.fn(),
}));

jest.mock('@/features/account/account-context', () => ({
  useAccount: () => ({ account: { handle: 'dona' }, reloadAccount: jest.fn(() => Promise.resolve()) }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const mocked = jest.mocked(api);
const mockRouter = jest.mocked(router);

const quota = (patch: Partial<ComunaQuotaDto> = {}): ComunaQuotaDto => ({
  activeOwned: 0,
  limit: 3,
  intervalDays: 0,
  nextCreationAt: null,
  canCreate: true,
  blockedBy: null,
  ...patch,
});

const permissions = {
  canPost: true,
  canLeave: false,
  canEditDetails: true,
  canManageModerators: true,
  canRemoveMembers: true,
  canReviewJoinRequests: false,
  canModerateContent: true,
  canArchive: true,
  canDelete: true,
  canTransferOwnership: true,
};

function comuna(patch: Partial<ComunaDetails> = {}): ComunaDetails {
  return {
    id: 'hortas',
    serverId: 'u1',
    visibility: 'public',
    status: 'active',
    name: 'Hortas',
    handle: 'hortas',
    initials: 'HO',
    tone: 'red',
    place: '',
    foundedYear: '2026',
    description: 'Mutirões.',
    memberCount: 1,
    coverAlt: '',
    topics: [],
    stats: [],
    rules: [],
    moderationNote: '',
    pinned: null,
    moderatorIds: [],
    founderRole: '',
    featuredMemberIds: [],
    viewerIsMember: true,
    viewerRole: 'founder',
    viewerPermissions: permissions,
    moderators: [],
    featuredMembers: [],
    members: [],
    ...patch,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.checkComunaName.mockResolvedValue({ name: 'x', slug: 'x', available: true, message: null });
  mocked.getComunaMembers.mockResolvedValue({ items: [], nextCursor: null });
});

describe('criar comuna', () => {
  it('cancelar sem preencher retorna ao contexto anterior sem criar nem abrir outra rota', async () => {
    mocked.getComunaQuota.mockResolvedValue(quota());
    await render(<CreateComunaScreen />);
    await fireEvent.press(await screen.findByLabelText('Voltar'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(mocked.createComuna).not.toHaveBeenCalled();
  });

  it('ignora novo envio após sucesso e navega apenas uma vez', async () => {
    mocked.getComunaQuota.mockResolvedValue(quota());
    mocked.createComuna.mockResolvedValue(comuna());
    await render(<CreateComunaScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Nome'), 'Hortas');
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Mutirões.');
    await fireEvent.press(screen.getByLabelText('Assunto: Escolher assunto'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tecnologia e ciência' }));
    const submit = screen.getByLabelText('Criar comuna');
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    expect(mocked.createComuna).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
  });

  it('explica o limite antes do formulário, sem enviar nada', async () => {
    mocked.getComunaQuota.mockResolvedValue(quota({ activeOwned: 3, canCreate: false, blockedBy: '/errors/comuna-limit-reached' }));
    await render(<CreateComunaScreen />);

    expect(await screen.findByText('Você já tem 3 comunas ativas')).toBeTruthy();
    expect(screen.queryByLabelText('Criar comuna')).toBeNull();
    expect(mocked.createComuna).not.toHaveBeenCalled();
  });

  it('cria pela API e abre a comuna criada', async () => {
    mocked.getComunaQuota.mockResolvedValue(quota());
    mocked.createComuna.mockResolvedValue(comuna({ id: 'hortas-do-bairro', handle: 'hortas-do-bairro' }));
    await render(<CreateComunaScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Nome'), '  Hortas do Bairro ');
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Mutirões.');
    await fireEvent.press(screen.getByRole('radio', { name: /Privada/ }));
    await fireEvent.changeText(screen.getByLabelText('Título da regra 1'), 'Respeito');
    await fireEvent.press(screen.getByLabelText('Assunto: Escolher assunto'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tecnologia e ciência' }));
    await fireEvent.press(screen.getByLabelText('Criar comuna'));

    expect(mocked.createComuna).toHaveBeenCalledWith({
      name: 'Hortas do Bairro',
      description: 'Mutirões.',
      visibility: 'private',
      topic: 'tec',
      rules: [{ title: 'Respeito', body: '' }],
      place: '',
    });
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: '/comuna/[id]', params: { id: 'hortas-do-bairro' } }));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('mostra o erro de campo do servidor (nome em uso) e a falha de rede', async () => {
    mocked.getComunaQuota.mockResolvedValue(quota());
    mocked.createComuna
      .mockRejectedValueOnce(new ApiError(422, '/errors/422', 'Já existe uma comuna com esse nome.', { name: 'Já existe uma comuna com esse nome.' }))
      .mockRejectedValueOnce(new NetworkError());
    await render(<CreateComunaScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Nome'), 'Tarifa Zero');
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Transporte.');

    await fireEvent.press(screen.getByLabelText('Assunto: Escolher assunto'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tecnologia e ciência' }));
    await fireEvent.press(screen.getByLabelText('Criar comuna'));
    expect(screen.getByText('Já existe uma comuna com esse nome.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Criar comuna'));
    expect(mockShow).toHaveBeenCalledWith(expect.stringContaining('Sem conexão'));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('erro ao verificar a conta: mostra o erro com "Tentar de novo"', async () => {
    mocked.getComunaQuota.mockRejectedValue(new NetworkError());
    await render(<CreateComunaScreen />);
    expect(await screen.findByText('Tentar de novo')).toBeTruthy();
  });
});

describe('gerir comuna: dados e exclusão', () => {
  it('proprietário altera o assunto oficial e recarrega a comuna depois de salvar', async () => {
    const before = comuna({ topics: ['tec'] });
    const after = comuna({ topics: ['trab'] });
    mocked.getComuna.mockResolvedValueOnce(before).mockResolvedValue(after);
    mocked.updateComuna.mockResolvedValue(after);
    await render(<ManageComunaScreen />);
    await fireEvent.press(await screen.findByText('Comuna'));
    await fireEvent.press(await screen.findByLabelText('Assunto: Tecnologia'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Trabalho e direitos trabalhistas' }));
    await fireEvent.press(screen.getByText('Salvar'));
    expect(mocked.updateComuna).toHaveBeenCalledWith('hortas', { description: 'Mutirões.', rules: [], topic: 'trab' });
    await waitFor(() => expect(mocked.getComuna).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Assunto: Trabalho')).toBeTruthy();
  });

  it('sem permissão de editar dados estruturais não mostra o seletor', async () => {
    mocked.getComuna.mockResolvedValue(comuna({ viewerRole: 'member', viewerPermissions: { ...permissions, canEditDetails: false } }));
    await render(<ManageComunaScreen />);
    expect(await screen.findByText('Você não gere esta comuna')).toBeTruthy();
    expect(screen.queryByLabelText(/Assunto:/)).toBeNull();
  });

  async function openSettings(details: ComunaDetails) {
    mocked.getComuna.mockResolvedValue(details);
    await render(<ManageComunaScreen />);
    await fireEvent.press(await screen.findByText('Comuna'));
  }

  it('com outros membros, não exclui: explica e oferece arquivar', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await openSettings(comuna({ memberCount: 4 }));

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(alert).toHaveBeenCalledWith('Não é possível excluir', expect.stringContaining('outros membros'), expect.arrayContaining([expect.objectContaining({ text: 'Arquivar' })]));
    expect(mocked.deleteComuna).not.toHaveBeenCalled();
  });

  it('único membro: pede confirmação explícita antes de excluir', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mocked.deleteComuna.mockResolvedValue(undefined);
    await openSettings(comuna({ memberCount: 1 }));

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Excluir definitivamente?');
    expect(message).toContain('para sempre');
    expect(message).toContain('nome ficará livre');
    expect(message).toContain('auditoria');
    expect(mocked.deleteComuna).not.toHaveBeenCalled();

    await act(async () => {
      buttons?.find((b) => b.text === 'Excluir')?.onPress?.();
    });
    expect(mocked.deleteComuna).toHaveBeenCalledWith('hortas');
  });

  it('se o servidor recusar (alguém entrou nesse meio tempo), oferece arquivar', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mocked.deleteComuna.mockRejectedValue(new ApiError(409, '/errors/comuna-has-members', 'x'));
    await openSettings(comuna({ memberCount: 1 }));

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    await act(async () => {
      alert.mock.calls[0][2]?.find((b) => b.text === 'Excluir')?.onPress?.();
    });

    expect(alert).toHaveBeenLastCalledWith('Não é possível excluir', expect.stringContaining('arquivá-la'), expect.anything());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('moderação não vê a aba de configurações da comuna', async () => {
    mocked.getComuna.mockResolvedValue(comuna({ viewerRole: 'moderator', viewerPermissions: { ...permissions, canEditDetails: false, canArchive: false, canDelete: false } }));
    await render(<ManageComunaScreen />);
    expect(await screen.findByText('Membros')).toBeTruthy();
    expect(screen.queryByText('Comuna')).toBeNull();
  });
});
