import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { receivePopulariaUrl, takeIncomingDestination } from '@/features/links/incoming';
import { PUBLIC_LINK_ORIGIN } from '@/features/links/destinations';
import { redirectSystemPath } from '@/app/+native-intent';
import { AppState, type AppStateStatus } from 'react-native';

import { queryClient } from '@/lib/query/client';
import { ApiError } from '@/lib/errors';
import { openNotificationTarget } from '../navigation';
import { registerPush, syncIconBadge } from '../push';
import { PushRuntime } from '../push-runtime';
import type { AppNotification } from '@/types/models';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, API_BASE_URL: 'https://api-stg.popularia.com.br/api/v1' }));
let mockReady = true;
let mockPath = '/';
let mockLegal = true;
let mockOnboarded = true;
let mockWelcome = false;
let mockAccountId = 'bia';
let mockCount = 2;
let mockReceived: (n: Notifications.Notification) => void;
let mockRespond: (n: Notifications.NotificationResponse) => void;
let mockToken: () => void;
const mockRead = jest.fn<(id: string, unread: boolean) => Promise<AppNotification>>();
const mockRefresh = jest.fn<() => Promise<void>>();
const mockChanged = jest.fn();
const mockShow = jest.fn();
jest.mock('@/features/account/account-context', () => ({ useAccount: () => ({ status: mockReady ? 'signedIn' : 'restoring', account: { id: mockAccountId, legalAccepted: mockLegal }, onboarded: mockReady && mockOnboarded, showLoginWelcome: mockWelcome }) }));
jest.mock('../notifications-context', () => ({ useNotifications: () => ({ unreadCount: mockCount, refreshUnread: mockRefresh, read: mockRead, changed: mockChanged }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('expo-router', () => ({ usePathname: () => mockPath, router: { replace: jest.fn() } }));
jest.mock('../navigation', () => ({ openNotificationTarget: jest.fn() }));
jest.mock('../push', () => ({ flushPushRevocations: async () => {}, pushAvailable: true, registerPush: jest.fn(), syncIconBadge: jest.fn(), pushNotificationId: (data: Record<string, unknown>, id: string) => data.recipientId === id ? data.notificationId : null }));
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'default', setNotificationHandler: jest.fn(),
  getLastNotificationResponse: jest.fn(), clearLastNotificationResponse: jest.fn(),
  addNotificationReceivedListener: jest.fn(), addNotificationResponseReceivedListener: jest.fn(), addPushTokenListener: jest.fn(),
}));

const native = jest.mocked(Notifications);
const handler = native.setNotificationHandler.mock.calls[0][0]!;
const notification = { date: 0, request: { identifier: 'push-1', content: { data: { notificationId: 'notification-1', recipientId: 'bia' } } } } as unknown as Notifications.Notification;
const response = { notification, actionIdentifier: 'default' } as Notifications.NotificationResponse;
const target = { kind: 'post', id: 'post-1' } as const;

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  takeIncomingDestination(); mockPath = '/'; mockLegal = true; mockOnboarded = true; mockWelcome = false;
  mockReady = true; mockAccountId = 'bia'; mockCount = 2;
  mockRead.mockResolvedValue({ target } as AppNotification);
  mockRefresh.mockResolvedValue();
  jest.mocked(registerPush).mockResolvedValue('granted');
  jest.mocked(syncIconBadge).mockResolvedValue();
  native.addNotificationReceivedListener.mockImplementation((callback) => { mockReceived = callback; return { remove: jest.fn() }; });
  native.addNotificationResponseReceivedListener.mockImplementation((callback) => { mockRespond = callback; return { remove: jest.fn() }; });
  native.addPushTokenListener.mockImplementation((callback) => { mockToken = () => callback({ type: 'ios', data: 'native-token' }); return { remove: jest.fn() }; });
  native.getLastNotificationResponse.mockReturnValue(null);
});

describe('ciclo de vida de push', () => {
  it('foreground atualiza unread/lista/cache e suprime apresentação duplicada', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const view = await render(<PushRuntime />);
    mockChanged.mockClear(); mockRefresh.mockClear();
    await act(async () => { mockReceived(notification); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockChanged).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['post'] });
    expect(await handler.handleNotification(notification)).toEqual({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false });
    invalidate.mockRestore();
    await view.unmount();
  });

  it('toque revalida/le o aviso e usa o destino centralizado uma vez', async () => {
    await render(<PushRuntime />);
    await act(async () => { mockRespond(response); mockRespond(response); });
    expect(mockRead).toHaveBeenCalledWith('notification-1', true);
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(openNotificationTarget).toHaveBeenCalledWith(target);
    expect(native.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('killed espera a restauração da conta para processar a resposta nativa', async () => {
    mockReady = false;
    native.getLastNotificationResponse.mockReturnValue(response);
    const view = await render(<PushRuntime />);
    expect(mockRead).not.toHaveBeenCalled();
    mockReady = true;
    await view.rerender(<PushRuntime />);
    await waitFor(() => expect(openNotificationTarget).toHaveBeenCalledWith(target));
  });

  it('ignora push de outra conta e destinos revogados dão feedback', async () => {
    await render(<PushRuntime />);
    await act(async () => { mockRespond({ ...response, notification: { ...notification, request: { ...notification.request, content: { ...notification.request.content, data: { notificationId: 'n2', recipientId: 'outra' } } } } }); });
    expect(mockRead).not.toHaveBeenCalled();
    mockRead.mockRejectedValueOnce(new ApiError(404, '/errors/not-found', 'Revogado'));
    await act(async () => { mockRespond(response); });
    expect(openNotificationTarget).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith('Este conteúdo não está mais disponível ou você não tem mais acesso.');
  });

  it('renova registro no foreground/token e atualiza badge após leitura', async () => {
    let resume!: (state: AppStateStatus) => void;
    const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { resume = callback; return { remove: jest.fn() }; });
    const view = await render(<PushRuntime />);
    jest.mocked(registerPush).mockClear();
    await act(async () => { resume('active'); mockToken(); });
    expect(registerPush).toHaveBeenCalledTimes(2);
    mockCount = 0;
    await view.rerender(<PushRuntime />);
    expect(syncIconBadge).toHaveBeenLastCalledWith(0);
    await view.unmount(); subscription.mockRestore();
  });

  it('uma leitura que termina após sair da conta não navega', async () => {
    let resolve!: (n: AppNotification) => void;
    mockRead.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = await render(<PushRuntime />);
    await act(async () => { mockRespond(response); });
    mockReady = false;
    await view.rerender(<PushRuntime />);
    await act(async () => { resolve({ target } as AppNotification); });
    expect(openNotificationTarget).not.toHaveBeenCalled();
  });
});

const linkedPost = '019abcde-0000-7000-8000-000000000001';
describe('links externos no runtime único', () => {
  it('cold start preserva link durante restauração, termos e onboarding', async () => {
    mockReady = false;
    mockPath = redirectSystemPath({ path: `${PUBLIC_LINK_ORIGIN}/p/${linkedPost}`, initial: true });
    const view = await render(<PushRuntime />);
    expect(router.replace).not.toHaveBeenCalled();
    mockReady = true; mockLegal = false; mockPath = '/aceite-legal';
    await view.rerender(<PushRuntime />);
    expect(router.replace).not.toHaveBeenCalled();
    mockLegal = true; mockOnboarded = false; mockPath = '/boas-vindas/perfil';
    await view.rerender(<PushRuntime />);
    expect(router.replace).not.toHaveBeenCalled();
    mockOnboarded = true; mockWelcome = true; mockPath = '/boas-vindas/mensagem';
    await view.rerender(<PushRuntime />);
    expect(router.replace).not.toHaveBeenCalled();
    mockWelcome = false; mockPath = '/';
    await view.rerender(<PushRuntime />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/post/${linkedPost}`));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
  it('app aberto/background espera o Router confirmar a ponte antes de navegar', async () => {
    const view = await render(<PushRuntime />);
    await act(async () => { receivePopulariaUrl(`${PUBLIC_LINK_ORIGIN}/d/${linkedPost}`); });
    expect(router.replace).not.toHaveBeenCalled();
    mockPath = '/abrir-link';
    await view.rerender(<PushRuntime />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/biblioteca/documento/[id]', params: { id: linkedPost } }));
    expect(takeIncomingDestination()).toBeNull();
  });
  it('login sem link não permite que um link futuro ultrapasse a ponte', async () => {
    mockReady = false;
    const view = await render(<PushRuntime />);
    mockReady = true;
    await view.rerender(<PushRuntime />);
    await act(async () => { receivePopulariaUrl(`${PUBLIC_LINK_ORIGIN}/p/${linkedPost}`); });
    expect(router.replace).not.toHaveBeenCalled();
    mockPath = '/abrir-link';
    await view.rerender(<PushRuntime />);
    expect(router.replace).toHaveBeenCalledWith(`/post/${linkedPost}`);
  });
  it('URL inválida não navega e URL recente cancela leitura de push anterior', async () => {
    let resolve!: (n: AppNotification) => void;
    mockRead.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = await render(<PushRuntime />);
    await act(async () => { expect(receivePopulariaUrl('https://evil.test/p/x')).toBe(false); mockRespond(response); });
    await act(async () => { receivePopulariaUrl(`${PUBLIC_LINK_ORIGIN}/p/${linkedPost}`); });
    mockPath = '/abrir-link';
    await view.rerender(<PushRuntime />);
    await act(async () => { resolve({ target } as AppNotification); });
    expect(openNotificationTarget).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(`/post/${linkedPost}`);
  });
});
