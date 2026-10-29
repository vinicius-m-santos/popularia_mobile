import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createRef, type ComponentRef } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';

import { SquareComposer } from '../components/square-composer';
import { MessageRow } from '../components/message-row';
import SquaresScreen from '../squares-screen';
import SquareScreen from '../square-screen';
import { SquareEntry } from '../square-entry';
import { ApiError } from '@/lib/errors';
import { useSquare } from '../use-square';
import * as api from '../api';
import { joinComuna, requestToJoin } from '@/features/comunas/api';
import { deferred, message, square, sticker } from '../testing/fixtures';

jest.mock('../api');
jest.mock('../use-square', () => ({ useSquare: jest.fn() }));
jest.mock('@/features/comunas/api', () => ({ joinComuna: jest.fn(), requestToJoin: jest.fn() }));
jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me', handle: 'eu', name: 'Você' }), useAccount: () => ({ account: { id: 'user2', emailVerified: true } }) }));
const mockShow = jest.fn();
const mockSetOn = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/features/interactions/interactions-context', () => ({ useInteractions: () => ({ setOn: mockSetOn }) }));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({ id: 'square1' }), useSegments: () => ['(tabs)', 'pracas'], useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 34, left: 0, right: 0 }) };
});
const mocked = jest.mocked(api);
function chat(patch: Partial<ReturnType<typeof useSquare>> = {}): ReturnType<typeof useSquare> {
  return { square: square(), messages: [message()], loading: false, error: null, syncError: null, olderError: null, loadingOlder: false, sending: false, newCount: 0, hasRecentGap: false, separatorId: null, nextCursor: null, reload: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), loadOlder: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), jumpRecent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), send: jest.fn<ReturnType<typeof useSquare>['send']>().mockResolvedValue(true), react: jest.fn<ReturnType<typeof useSquare>['react']>().mockResolvedValue(undefined), onBottom: jest.fn(), ...patch };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSquare).mockReturnValue(chat());
  mocked.listSquares.mockResolvedValue({ items: [], nextCursor: null });
  mocked.getComunaSquare.mockResolvedValue(square());
  mocked.getStickerPacks.mockResolvedValue([{ id: 'pack1', name: 'Popularia', scope: 'popularia', stickers: [sticker] }]);
  jest.mocked(joinComuna).mockResolvedValue({} as Awaited<ReturnType<typeof joinComuna>>);
  jest.mocked(requestToJoin).mockResolvedValue(undefined);
});

describe('Praças no aplicativo', () => {
  it('mostra públicas e o CTA de Explorar para quem ainda não possui Praça', async () => {
    mocked.listSquares.mockImplementation(async (section) => ({ items: section === 'mine' ? [] : [square()], nextCursor: null }));
    await render(<SquaresScreen />);
    await waitFor(() => expect(screen.getByText('Encontre sua comunidade')).toBeTruthy());
    expect(screen.getByText('Acontecendo agora')).toBeTruthy();
    expect(screen.getByText('Tecnologia')).toBeTruthy();
    expect(screen.getByText('Trabalho')).toBeTruthy();
    expect(screen.queryByText('Comunidade')).toBeNull();
    await fireEvent.press(screen.getByText('→ Explorar comunas'));
    expect(router.navigate).toHaveBeenCalledWith('/explorar');
    await fireEvent.press(screen.getByLabelText('Entrar na Praça Trabalhadores de TI'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/praca/[id]', params: { id: 'square1' } });
  });
  it('a Comuna oferece sua Praça existente, sem ativação ou criação manual', async () => {
    await render(<SquareEntry slug="ti" />);
    await waitFor(() => expect(screen.getByText('Entrar na Praça')).toBeTruthy());
    expect(screen.queryByText('Criar Praça')).toBeNull();
    expect(screen.queryByText('Abrir Praça')).toBeNull();
    await fireEvent.press(screen.getByText('Entrar na Praça'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/praca/[id]', params: { id: 'square1' } });
  });
  it('Comuna arquivada oferece histórico sem reabertura da Praça', async () => {
    mocked.getComunaSquare.mockResolvedValue(square({ status: 'closed' }));
    await render(<SquareEntry slug="ti" />);
    await waitFor(() => expect(screen.getByText('Praça encerrada · somente leitura')).toBeTruthy());
    await fireEvent.press(screen.getByText('Consultar histórico'));
    expect(screen.queryByText('Reabrir Praça')).toBeNull();
    expect(router.push).toHaveBeenCalled();
  });
  it('falha ao obter Praça é erro recuperável, sem tratá-la como feature opcional', async () => {
    mocked.getComunaSquare.mockRejectedValueOnce(new ApiError(404, '/errors/not-found', 'Indisponível'));
    await render(<SquareEntry slug="ti" />);
    await waitFor(() => expect(screen.getByText('Não conseguimos carregar a Praça.')).toBeTruthy());
    expect(screen.queryByText('Criar Praça')).toBeNull();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(screen.getByText('Entrar na Praça')).toBeTruthy());
  });
  it('gestão mantém figurinhas/denúncias sem lifecycle independente, mesmo para owner', async () => {
    jest.mocked(useSquare).mockReturnValue(chat({ square: square({ viewer: { ...square().viewer, canManage: true } }) }));
    await render(<SquareScreen />);
    await fireEvent.press(screen.getByLabelText('Opções da Praça'));
    await waitFor(() => expect(screen.getByText('Figurinhas da comuna')).toBeTruthy());
    expect(screen.getByText('Fila de denúncias')).toBeTruthy();
    expect(screen.queryByText('Fechar Praça')).toBeNull();
    expect(screen.queryByText('Reabrir Praça')).toBeNull();
  });
  it('preserva o texto após erro e bloqueia duplo submit do composer', async () => {
    const result = deferred<boolean>();
    const onSend = jest.fn<(text: string) => Promise<boolean>>().mockReturnValueOnce(result.promise).mockResolvedValue(true);
    await render(<SquareComposer inputRef={createRef<ComponentRef<typeof TextInput>>()} reply={null} sending={false} onCancel={jest.fn()} onStickers={jest.fn()} onSend={onSend} />);
    await fireEvent.changeText(screen.getByLabelText('Conversar na praça'), 'Não perder meu texto');
    await act(async () => { await fireEvent.press(screen.getByLabelText('Enviar mensagem')); await fireEvent.press(screen.getByLabelText('Enviar mensagem')); });
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => result.resolve(false));
    expect(screen.getByDisplayValue('Não perder meu texto')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enviar mensagem'));
    await waitFor(() => expect(screen.queryByDisplayValue('Não perder meu texto')).toBeNull());
  });
  it('publica sem membership permite leitura e reutiliza participação real', async () => {
    const state = chat({ square: square({ viewer: { ...square().viewer, isMember: false, canWrite: false } }) });
    jest.mocked(useSquare).mockReturnValue(state);
    await render(<SquareScreen />);
    expect(screen.getByText('Vamos conversar')).toBeTruthy();
    expect(screen.queryByLabelText('Conversar na praça')).toBeNull();
    await fireEvent.press(screen.getByText('Participar'));
    await waitFor(() => expect(joinComuna).toHaveBeenCalledWith('ti'));
    expect(mockSetOn).toHaveBeenCalledWith('joinedComunas', ['ti'], true);
    expect(state.reload).toHaveBeenCalled();
  });
  it('privada bloqueia conteúdo/presença e usa pedido de entrada; pendente desabilita o botão', async () => {
    const locked = square({ comuna: { ...square().comuna!, visibility: 'private' }, presence: null, status: null, viewer: { canRead: false, canWrite: false, isMember: false, canManage: false, joinRequest: null } });
    jest.mocked(useSquare).mockReturnValue(chat({ square: locked, messages: [] }));
    const ui = await render(<SquareScreen />);
    expect(screen.getByText('Esta Praça pertence a uma comuna privada')).toBeTruthy();
    expect(screen.queryByText('Vamos conversar')).toBeNull();
    await fireEvent.press(screen.getByText('Solicitar entrada'));
    await waitFor(() => expect(requestToJoin).toHaveBeenCalledWith('ti'));
    jest.mocked(useSquare).mockReturnValue(chat({ square: { ...locked, viewer: { ...locked.viewer, joinRequest: 'pending' } }, messages: [] }));
    await ui.rerender(<SquareScreen />);
    expect(screen.getByRole('button', { name: 'Solicitação pendente' }).props.accessibilityState.disabled).toBe(true);
  });
  it('reply acessível ativa contexto e pode ser cancelado; reação fica compacta e + mostra só ações válidas', async () => {
    const state = chat();
    jest.mocked(useSquare).mockReturnValue(state);
    await render(<SquareScreen />);
    const row = screen.getByLabelText('Marina, Vamos conversar');
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'reply' } });
    expect(screen.getByText('Respondendo a Marina')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancelar resposta'));
    expect(screen.queryByText('Respondendo a Marina')).toBeNull();
    await fireEvent(row, 'longPress');
    await fireEvent.press(screen.getByLabelText('Reagir ✊'));
    expect(state.react).toHaveBeenCalledWith(message(), '✊');
    expect(screen.queryByLabelText('Reagir ✊')).toBeNull();
    await fireEvent(row, 'longPress');
    await fireEvent.press(screen.getByLabelText('Mais ações da mensagem'));
    expect(screen.getByText('Denunciar')).toBeTruthy();
    expect(screen.queryByText('Excluir mensagem')).toBeNull();
    expect(screen.queryByText('Remover mensagem')).toBeNull();
  });
  it.each(['author', 'moderator'] as const)('mostra as ações autorizadas para %s', async (role) => {
    const m = message('m002', { viewer: { ...message().viewer, isAuthor: role === 'author', canDelete: role === 'author', canReport: role !== 'author', canRemove: role === 'moderator' } });
    jest.mocked(useSquare).mockReturnValue(chat({ messages: [m] }));
    await render(<SquareScreen />);
    await fireEvent(screen.getByLabelText('Marina, Vamos conversar'), 'longPress');
    await fireEvent.press(screen.getByLabelText('Mais ações da mensagem'));
    expect(screen.getByText(role === 'author' ? 'Excluir mensagem' : 'Remover mensagem')).toBeTruthy();
    if (role === 'author') expect(screen.queryByText('Denunciar')).toBeNull();
    else expect(screen.getByText('Denunciar')).toBeTruthy();
  });
  it('envia figurinha real e mostra estado fechado sem composer', async () => {
    const state = chat();
    jest.mocked(useSquare).mockReturnValue(state);
    const ui = await render(<SquareScreen />);
    await fireEvent.press(screen.getByLabelText('Figurinhas'));
    await waitFor(() => expect(screen.getByLabelText('Enviar figurinha BORA!')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Enviar figurinha BORA!'));
    expect(state.send).toHaveBeenCalledWith({ stickerId: 'st1' }, sticker);
    jest.mocked(useSquare).mockReturnValue(chat({ square: square({ status: 'closed', viewer: { ...square().viewer, canWrite: false } }) }));
    await ui.rerender(<SquareScreen />);
    expect(screen.getByText('Praça encerrada · somente leitura')).toBeTruthy();
    expect(screen.queryByLabelText('Conversar na praça')).toBeNull();
  });
  it('botão de novas mensagens leva às recentes sem inventar mensagens na lista', async () => {
    const state = chat({ newCount: 7 });
    jest.mocked(useSquare).mockReturnValue(state);
    await render(<SquareScreen />);
    await fireEvent.press(screen.getByText('↓ 7 novas mensagens'));
    expect(state.jumpRecent).toHaveBeenCalled();
  });
  it('mensagem excluída preserva autor e horário, sem conteúdo nem ações', async () => {
    const deleted = message('m-deleted', {
      status: 'deleted', body: null, sticker: null, reactions: [],
      viewer: { isAuthor: false, canDelete: false, canRemove: false, canReport: false, canReact: false, canReply: false },
    });
    jest.mocked(useSquare).mockReturnValue(chat({ messages: [deleted] }));
    await render(<SquareScreen />);
    expect(screen.getByLabelText('Marina, Mensagem excluída')).toBeTruthy();
    expect(screen.getByText('Marina')).toBeTruthy();
    expect(screen.getByText('@marina')).toBeTruthy();
    expect(screen.getByText('Mensagem excluída')).toBeTruthy();
    expect(screen.queryByLabelText('Mais ações da mensagem')).toBeNull();
  });
  it('mantém resposta e opções acessíveis sem PanResponder artesanal', async () => {
    const reply = jest.fn();
    const openPicker = jest.fn();
    await render(<MessageRow message={message()} separator={false} onOpenPicker={openPicker} onReply={reply} onReact={jest.fn()} onOriginal={jest.fn()} />);
    const row = screen.getByLabelText('Marina, Vamos conversar');
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'reply' } });
    expect(reply).toHaveBeenCalledWith(message());
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'options' } });
    expect(openPicker).toHaveBeenCalledWith(message(), expect.objectContaining({ width: 1, height: 1 }));
  });
});
