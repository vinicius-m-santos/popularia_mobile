import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from '@/lib/errors';
import * as api from '../api';
import { useSquare } from '../use-square';
import { author, deferred, message, page, square, sticker } from '../testing/fixtures';

jest.mock('../api');
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
const mocked = jest.mocked(api);
let appListener: (state: AppStateStatus) => void;
const remove = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { appListener = callback; return { remove }; });
  mocked.getSquare.mockResolvedValue(square());
  mocked.getMessages.mockResolvedValue(page());
  mocked.heartbeat.mockResolvedValue({ count: 2, people: [] });
  mocked.markRead.mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); });

async function open() {
  const hook = await renderHook(() => useSquare('square1', author));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('conversa viva', () => {
  it('abre recentes, pagina anteriores sem repetir e separa unread inicial', async () => {
    mocked.getMessages.mockResolvedValueOnce(page([message('m003')], { nextCursor: 'm003' })).mockResolvedValueOnce(page([message('m002'), message('m001')], { nextCursor: null }));
    const { result } = await open();
    expect(result.current.separatorId).toBe('m003');
    await act(() => result.current.loadOlder());
    expect(mocked.getMessages).toHaveBeenLastCalledWith('square1', { cursor: 'm003' });
    expect(result.current.messages.map((m) => m.id)).toEqual(['m003', 'm002', 'm001']);
  });
  it('recebe novas sem marcar leitura ou modificar o trecho histórico e volta às recentes ao tocar', async () => {
    const { result } = await open();
    await act(() => result.current.onBottom(false));
    mocked.markRead.mockClear();
    mocked.getMessages.mockResolvedValueOnce(page([message('m003')], { changeCursor: 2 }));
    await act(() => result.current.reload());
    expect(result.current.messages.map((m) => m.id)).toEqual(['m002']);
    expect(result.current.newCount).toBe(1);
    expect(mocked.markRead).not.toHaveBeenCalled();
    mocked.getMessages.mockResolvedValueOnce(page([message('m003'), message('m002')], { changeCursor: 2 }));
    await act(() => result.current.jumpRecent());
    expect(result.current.newCount).toBe(0);
    expect(result.current.messages[0].id).toBe('m003');
  });
  it('conta novas corretamente quando alterações chegam em ordem diferente da criação', async () => {
    const { result } = await open();
    await act(() => result.current.onBottom(false));
    mocked.getMessages.mockResolvedValueOnce(page([message('m004')], { changeCursor: 2, hasMoreChanges: true }));
    await act(() => result.current.reload());
    mocked.getMessages.mockResolvedValueOnce(page([message('m003')], { changeCursor: 3 }));
    await act(() => result.current.reload());
    expect(result.current.newCount).toBe(2);
    mocked.getMessages.mockResolvedValueOnce(page([message('m004', { revision: 4 })], { changeCursor: 4 }));
    await act(() => result.current.reload());
    expect(result.current.newCount).toBe(2);
  });
  it('bloqueia duplo envio e reconcilia resposta com o mesmo clientId recebido por polling', async () => {
    const response = deferred<api.SquareMessage>();
    mocked.sendMessage.mockReturnValue(response.promise);
    const { result } = await open();
    let sending!: Promise<boolean>;
    await act(() => { sending = result.current.send({ body: 'Olá' }); void result.current.send({ body: 'Olá' }); });
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    const clientId = mocked.sendMessage.mock.calls[0][1].clientId;
    expect(result.current.messages[0].pending).toBe(true);
    const real = message('m003', { clientId, body: 'Olá', viewer: { ...message().viewer, isAuthor: true } });
    mocked.getMessages.mockResolvedValueOnce(page([real], { changeCursor: 2 }));
    await act(() => result.current.reload());
    await act(async () => { response.resolve(real); await sending; });
    expect(result.current.messages.filter((m) => m.clientId === clientId)).toHaveLength(1);
    expect(result.current.messages.some((m) => m.pending)).toBe(false);
  });
  it('retry reutiliza clientId após falha ambígua e permite enviar figurinha com reply', async () => {
    mocked.sendMessage.mockRejectedValueOnce(new Error('offline'));
    const { result } = await open();
    let success = true;
    await act(async () => { success = await result.current.send({ body: 'Olá' }); });
    expect(success).toBe(false);
    expect(result.current.messages.some((m) => m.pending)).toBe(false);
    const firstId = mocked.sendMessage.mock.calls[0][1].clientId;
    mocked.sendMessage.mockResolvedValueOnce(message('m003', { clientId: firstId }));
    await act(() => result.current.send({ body: 'Olá' }));
    expect(mocked.sendMessage.mock.calls[1][1].clientId).toBe(firstId);
    mocked.sendMessage.mockResolvedValueOnce(message('m004', { body: null, sticker }));
    await act(() => result.current.send({ stickerId: sticker.id, replyToId: 'm002' }, sticker));
    expect(mocked.sendMessage).toHaveBeenLastCalledWith('square1', expect.objectContaining({ stickerId: 'st1', replyToId: 'm002' }));
  });
  it('toggle de reação trata falha e não restaura texto removido durante o request', async () => {
    const response = deferred<api.SquareMessage>();
    mocked.setReaction.mockReturnValue(response.promise);
    const { result } = await open();
    let reacting!: Promise<void>;
    await act(() => { reacting = result.current.react(result.current.messages[0], '✊'); });
    expect(result.current.messages[0].reactions[0].mine).toBe(true);
    mocked.getMessages.mockResolvedValueOnce(page([message('m002', { status: 'removed', body: null, author: null, revision: 2 })]));
    await act(() => result.current.reload());
    await act(async () => { response.reject(new Error('offline')); await reacting; });
    expect(result.current.messages[0].body).toBeNull();
    expect(result.current.messages[0].status).toBe('removed');
  });
  it('revogação privada limpa mensagens e metadados; estado bloqueado só consulta Praça', async () => {
    const { result } = await open();
    mocked.getMessages.mockRejectedValueOnce(new ApiError(403, '/errors/square-private', 'Privada'));
    await act(() => result.current.reload());
    expect(result.current.messages).toEqual([]);
    expect(result.current.square).toBeNull();
    const locked = square({ presence: null, viewer: { canRead: false, canWrite: false, canManage: false, isMember: false, joinRequest: 'pending' } });
    mocked.getSquare.mockResolvedValue(locked);
    mocked.getMessages.mockClear();
    await act(() => result.current.reload());
    expect(result.current.square?.viewer.joinRequest).toBe('pending');
    expect(mocked.getMessages).not.toHaveBeenCalled();
  });
  it('pausa em background e ignora respostas após sair; cancela listener', async () => {
    const { result, unmount } = await open();
    const count = mocked.getMessages.mock.calls.length;
    AppState.currentState = 'background';
    await act(() => appListener('background'));
    await act(() => result.current.reload());
    expect(mocked.getMessages).toHaveBeenCalledTimes(count);
    AppState.currentState = 'active';
    await act(() => appListener('active'));
    await waitFor(() => expect(mocked.getMessages.mock.calls.length).toBeGreaterThan(count));
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
  it('uma resposta de polling antiga não restaura acesso privado após atualização explícita', async () => {
    const { result } = await open();
    const stale = deferred<api.MessagePage>();
    mocked.getMessages.mockReturnValueOnce(stale.promise);
    let polling!: Promise<void>;
    await act(() => { polling = result.current.reload(); });
    mocked.getSquare.mockResolvedValueOnce(square({ viewer: { ...square().viewer, canRead: false, canWrite: false } }));
    await act(() => result.current.jumpRecent());
    await act(async () => { stale.resolve(page()); await polling; });
    expect(result.current.square?.viewer.canRead).toBe(false);
    expect(result.current.messages).toEqual([]);
  });
  it('ajusta o cursor ao reduzir a janela recente para não pular histórico', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => message(`m${String(i).padStart(3, '0')}`)).reverse();
    mocked.getMessages.mockResolvedValueOnce(page(rows, { nextCursor: 'm000' }));
    const { result } = await open();
    mocked.getMessages.mockResolvedValueOnce(page([message('m200')]));
    await act(() => result.current.reload());
    expect(result.current.messages).toHaveLength(200);
    expect(result.current.nextCursor).toBe('m001');
  });
  it('não envia quando a Praça está fechada ou sem membership', async () => {
    mocked.getSquare.mockResolvedValue(square({ status: 'closed', viewer: { ...square().viewer, canWrite: false } }));
    mocked.getMessages.mockResolvedValue(page([], { square: square({ status: 'closed', viewer: { ...square().viewer, canWrite: false } }) }));
    const { result } = await open();
    await act(() => result.current.send({ body: 'Não pode' }));
    expect(mocked.sendMessage).not.toHaveBeenCalled();
  });
});
