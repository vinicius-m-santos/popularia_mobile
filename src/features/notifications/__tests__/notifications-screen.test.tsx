import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { queryClient } from '@/lib/query/client';
import { ApiError, NetworkError } from '@/lib/errors';
import type { AppNotification } from '@/types/models';

import * as api from '../api';
import { NotificationsProvider, useNotifications } from '../notifications-context';
import NotificationsScreen from '../notifications-screen';
import { useUnreadCount } from '../use-unread-count';
import { AppText } from '@/components/app-text';

jest.mock('../push-permission-prompt', () => ({ PushPermissionPrompt: () => null }));
jest.mock('../api', () => ({ getNotifications: jest.fn(), getUnreadCount: jest.fn(), readNotification: jest.fn(), markAllNotificationsRead: jest.fn() }));
jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/profiles/components/follow-button', () => ({ FollowButton: () => null }));
let mockAccount = { status: 'signedIn', account: { id: 'bia' } };
jest.mock('@/features/account/account-context', () => ({ useAccount: () => mockAccount }));
const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { router: { push: jest.fn() }, useSegments: () => ['(tabs)', 'avisos'], useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

function notification(patch: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1', kind: 'follow', createdAt: new Date().toISOString(),
    actor: { id: 'ana', handle: 'ana', name: 'Ana', initials: 'AN', tone: 'red' },
    text: 'começou a seguir você', unread: true, target: { kind: 'profile', id: 'ana' }, ...patch,
  };
}

function Count() {
  return <AppText testID="unread-count">{useUnreadCount()}</AppText>;
}

function App() {
  return <NotificationsProvider><Count /><NotificationsScreen /></NotificationsProvider>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const mocked = jest.mocked(api);
beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
  mockAccount = { status: 'signedIn', account: { id: 'bia' } };
  mocked.getNotifications.mockResolvedValue({ items: [notification()], nextCursor: null });
  mocked.getUnreadCount.mockResolvedValue(1);
  mocked.readNotification.mockResolvedValue(notification({ unread: false }));
  mocked.markAllNotificationsRead.mockResolvedValue(0);
});

afterEach(() => { queryClient.clear(); });

describe('central de avisos', () => {
  it('mostra loading, vazio e permite atualizar a lista vazia', async () => {
    const first = deferred<Awaited<ReturnType<typeof api.getNotifications>>>();
    mocked.getNotifications.mockReturnValueOnce(first.promise);
    const view = await render(<App />);
    expect(screen.getByLabelText('Carregando avisos')).toBeTruthy();
    await act(async () => { first.resolve({ items: [], nextCursor: null }); });
    expect(screen.getByText('Nenhuma notificação por enquanto.')).toBeTruthy();
    const refreshControl = screen.container.queryAll((element) => element.type === 'RCTRefreshControl')[0];
    await fireEvent(refreshControl, 'refresh');
    await waitFor(() => expect(screen.getByText('@ana')).toBeTruthy());
    await view.unmount();
  });

  it('revalida aviso recebido durante a carga inicial assim que a lista fica pronta', async () => {
    const first = deferred<Awaited<ReturnType<typeof api.getNotifications>>>();
    mocked.getNotifications.mockReturnValueOnce(first.promise);
    function PushSignal() {
      const { changed } = useNotifications();
      return <AppText onPress={changed}>Simular push</AppText>;
    }
    await render(<NotificationsProvider><Count /><NotificationsScreen /><PushSignal /></NotificationsProvider>);
    await fireEvent.press(screen.getByText('Simular push'));
    expect(api.getNotifications).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve({ items: [], nextCursor: null }); });
    await screen.findByText('@ana');
    expect(api.getNotifications).toHaveBeenCalledTimes(2);
  });

  it('oferece retry após erro na primeira página', async () => {
    mocked.getNotifications.mockRejectedValueOnce(new NetworkError());
    await render(<App />);
    expect(screen.getByText('Não conseguimos carregar seus avisos.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(screen.getByText('@ana')).toBeTruthy();
  });

  it('revalida e marca como lida antes de navegar, atualizando o contador mesmo sem rede no contador', async () => {
    await render(<App />);
    mocked.getUnreadCount.mockRejectedValue(new NetworkError());
    await fireEvent.press(screen.getByRole('link'));
    expect(api.readNotification).toHaveBeenCalledWith('n1');
    expect(router.push).toHaveBeenCalledWith('/avisos/pessoa/ana');
    expect(screen.getByTestId('unread-count').props.children).toBe(0);
    expect(screen.getByRole('link').props.accessibilityLabel).not.toContain('Não lido');
  });

  it('marca visual e contador imediatamente e restaura ambos se a leitura falhar', async () => {
    let reject!: (error: unknown) => void;
    mocked.readNotification.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    await render(<App />);
    await fireEvent.press(screen.getByRole('link'));
    expect(screen.getByTestId('unread-count').props.children).toBe(0);
    expect(screen.getByRole('link').props.accessibilityLabel).not.toContain('Não lido');
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => { reject(new NetworkError()); });
    expect(screen.getByTestId('unread-count').props.children).toBe(1);
    expect(screen.getByRole('link').props.accessibilityLabel).toContain('Não lido');
    expect(mockShow).toHaveBeenCalledWith('Não conseguimos abrir este aviso. Tente novamente.');
  });

  it('não inventa unread ao falhar a leitura quando o contador já era zero', async () => {
    mocked.getUnreadCount.mockResolvedValue(0);
    mocked.readNotification.mockRejectedValueOnce(new NetworkError());
    await render(<App />);
    mocked.getUnreadCount.mockRejectedValue(new NetworkError());
    await fireEvent.press(screen.getByRole('link'));
    expect(screen.getByTestId('unread-count').props.children).toBe(0);
  });

  it('impede navegação e submissão duplicadas por toques rápidos', async () => {
    const request = deferred<AppNotification>();
    mocked.readNotification.mockReturnValueOnce(request.promise);
    await render(<App />);
    const row = screen.getByRole('link');
    await fireEvent.press(row);
    await fireEvent.press(row);
    expect(api.readNotification).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => { request.resolve(notification({ unread: false })); });
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('um destino que perdeu acesso mostra feedback sem navegar', async () => {
    mocked.readNotification.mockRejectedValueOnce(new ApiError(404, '/errors/not-found', 'Indisponível'));
    await render(<App />);
    await fireEvent.press(screen.getByRole('link'));
    expect(router.push).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith('Este conteúdo não está mais disponível ou você não tem mais acesso.');
    expect(api.getNotifications).toHaveBeenCalledTimes(2);
  });

  it('marca todas de forma persistida; falha não apaga o estado de não lida', async () => {
    mocked.markAllNotificationsRead.mockRejectedValueOnce(new NetworkError());
    await render(<App />);
    await fireEvent.press(screen.getByText('Ler todas'));
    expect(screen.getByRole('link').props.accessibilityLabel).toContain('Não lido');
    expect(screen.getByTestId('unread-count').props.children).toBe(1);
    await fireEvent.press(screen.getByText('Ler todas'));
    expect(screen.getByTestId('unread-count').props.children).toBe(0);
    expect(screen.getByRole('link').props.accessibilityLabel).not.toContain('Não lido');
  });

  it('pagina pelo cursor, preserva os itens ao falhar e permite retry', async () => {
    mocked.getNotifications.mockResolvedValueOnce({ items: [notification()], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce({ items: [notification({ id: 'n2', text: 'respondeu ao seu comentário', kind: 'reply', target: { kind: 'post', id: 'post-1' } })], nextCursor: null });
    await render(<App />);
    // A primeira página cabe na viewport: FlashList pede a próxima automaticamente.
    await screen.findByText('Não conseguimos carregar mais avisos.');
    expect(api.getNotifications).toHaveBeenCalledTimes(2);
    expect(screen.getByText('@ana')).toBeTruthy();
    expect(screen.getByText('Não conseguimos carregar mais avisos.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(screen.getAllByText('@ana')).toHaveLength(2);
    expect(api.getNotifications).toHaveBeenLastCalledWith('cursor-1');
  });

  it('trocar de conta descarta o histórico e ignora respostas atrasadas da conta anterior', async () => {
    const late = deferred<number>();
    mocked.getUnreadCount.mockReturnValueOnce(late.promise);
    const view = await render(<App />);
    mockAccount = { status: 'signedIn', account: { id: 'outra' } };
    mocked.getNotifications.mockResolvedValue({ items: [], nextCursor: null });
    mocked.getUnreadCount.mockResolvedValue(0);
    await view.rerender(<App />);
    await act(async () => { late.resolve(42); });
    expect(screen.queryByText('@ana')).toBeNull();
    expect(screen.getByTestId('unread-count').props.children).toBe(0);
  });

  it('uma abertura que termina depois da troca de conta não navega na nova sessão', async () => {
    const opening = deferred<AppNotification>();
    mocked.readNotification.mockReturnValueOnce(opening.promise);
    const view = await render(<App />);
    await fireEvent.press(screen.getByRole('link'));
    mockAccount = { status: 'signedIn', account: { id: 'outra' } };
    mocked.getNotifications.mockResolvedValue({ items: [], nextCursor: null });
    mocked.getUnreadCount.mockResolvedValue(0);
    await view.rerender(<App />);
    await act(async () => { opening.resolve(notification({ unread: false })); });
    expect(router.push).not.toHaveBeenCalled();
  });
});
