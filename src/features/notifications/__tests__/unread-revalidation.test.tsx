import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { AppText } from '@/components/app-text';
import { queryClient } from '@/lib/query/client';

import * as api from '../api';
import { NotificationsProvider } from '../notifications-context';
import { useUnreadCount } from '../use-unread-count';
import { resetMockRouteFocused, setMockRouteFocused } from '@/hooks/testing/route-focus';

jest.mock('expo-router', () => {
  const { useMockFocusEffect } = jest.requireActual<typeof import('@/hooks/testing/route-focus')>('@/hooks/testing/route-focus');
  return { useFocusEffect: useMockFocusEffect };
});
jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/account/account-context', () => ({
  useAccount: () => ({ status: 'signedIn', account: { id: 'bia' } }),
}));
jest.mock('../api', () => ({ getUnreadCount: jest.fn(), getNotifications: jest.fn(), readNotification: jest.fn(), markAllNotificationsRead: jest.fn() }));

const mocked = jest.mocked(api);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function Count() {
  return <AppText testID="unread-count">{useUnreadCount()}</AppText>;
}

let appListener: ((state: AppStateStatus) => void) | undefined;
let now = 1_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  resetMockRouteFocused();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mocked.getUnreadCount.mockResolvedValue(3);
  appListener = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appListener = callback;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  queryClient.clear();
  jest.restoreAllMocks();
});

describe('contador de avisos', () => {
  it('compartilha a leitura em voo e não repete o foco dentro da janela', async () => {
    const first = deferred<number>();
    mocked.getUnreadCount.mockReturnValueOnce(first.promise);
    await render(<NotificationsProvider><Count /></NotificationsProvider>);

    expect(api.getUnreadCount).toHaveBeenCalledTimes(1);

    // Um retorno ao primeiro plano enquanto a leitura inicial ainda está em voo
    // reaproveita a mesma promise; o foco também.
    await act(async () => {
      appListener?.('active');
      setMockRouteFocused(false);
      setMockRouteFocused(true);
    });
    expect(api.getUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(3);
      await first.promise;
    });
    await waitFor(() => expect(screen.getByTestId('unread-count').props.children).toBe(3));

    // Dentro da janela, o foco não repete a leitura que acabou de chegar.
    now += 5_000;
    await act(async () => {
      setMockRouteFocused(false);
      setMockRouteFocused(true);
    });
    expect(api.getUnreadCount).toHaveBeenCalledTimes(1);

    // O foreground, porém, força uma confirmação: o contador pode ter mudado
    // enquanto o app estava fora.
    await act(async () => { appListener?.('active'); });
    await waitFor(() => expect(api.getUnreadCount).toHaveBeenCalledTimes(2));
  });

  it('renova o contador no foco depois da janela e preserva o valor em falha', async () => {
    mocked.getUnreadCount.mockResolvedValueOnce(2);
    await render(<NotificationsProvider><Count /></NotificationsProvider>);
    await waitFor(() => expect(screen.getByTestId('unread-count').props.children).toBe(2));

    now += 10_001;
    const next = deferred<number>();
    mocked.getUnreadCount.mockReturnValueOnce(next.promise);
    await act(async () => {
      setMockRouteFocused(false);
      setMockRouteFocused(true);
    });
    expect(api.getUnreadCount).toHaveBeenCalledTimes(2);

    await act(async () => {
      next.resolve(5);
      await next.promise;
    });
    expect(screen.getByTestId('unread-count').props.children).toBe(5);

    now += 10_001;
    mocked.getUnreadCount.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { appListener?.('active'); });
    expect(api.getUnreadCount).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('unread-count').props.children).toBe(5);
  });
});
