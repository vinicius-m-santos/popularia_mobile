import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { apiRequest } from '@/lib/api/client';
import { pushNotificationId, pushPermission, registerPush, syncIconBadge, unregisterPush, flushPushRevocations } from '../push';

jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'bare', expoConfig: { extra: { eas: { projectId: 'project-id' } } } } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn(), getSessionGeneration: () => 1, getSessionId: () => 'session-one' }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(), setBadgeCountAsync: jest.fn(),
  IosAuthorizationStatus: { PROVISIONAL: 3 }, AndroidImportance: { DEFAULT: 3 },
}));

const native = jest.mocked(Notifications);
const http = jest.mocked(apiRequest);
beforeEach(() => {
  jest.resetAllMocks();
  native.getPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true } as Notifications.NotificationPermissionsStatus);
  native.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: 'ExpoPushToken[test-device-token]' });
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => key === 'popularia.push.installation' ? '00000000-0000-4000-8000-000000000001' : null);
  http.mockResolvedValue({});
});

describe('registro de push', () => {
  it('associa token à instalação usando a sessão HTTP e o projeto EAS existentes', async () => {
    expect(await registerPush()).toBe('granted');
    expect(native.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-id' });
    expect(http).toHaveBeenCalledWith('/me/push-devices/00000000-0000-4000-8000-000000000001', { method: 'PUT', auth: true, body: { token: 'ExpoPushToken[test-device-token]', platform: 'ios', revocationSecret: '00000000-0000-4000-8000-000000000001' } });
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('permite pedir permissão pela ação contextual e não a solicita ao restaurar sessão', async () => {
    native.getPermissionsAsync.mockResolvedValue({ granted: false, status: 'undetermined', canAskAgain: true } as Notifications.NotificationPermissionsStatus);
    expect(await registerPush()).toBe('undetermined');
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
    await registerPush(true);
    expect(native.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(native.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('desativa o dispositivo quando a permissão é removida no sistema', async () => {
    native.getPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false } as Notifications.NotificationPermissionsStatus);
    expect(await registerPush()).toBe('denied');
    expect(http).toHaveBeenCalledWith(expect.any(String), { method: 'DELETE', auth: true, timeoutMs: 5000 });
    expect(native.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('aceita autorização provisional do iOS', async () => {
    native.getPermissionsAsync.mockResolvedValue({ granted: false, status: 'undetermined', canAskAgain: true, ios: { status: 3 } } as Notifications.NotificationPermissionsStatus);
    expect(await pushPermission()).toBe('granted');
  });

  it('não registra resposta tardia de uma sessão desmontada', async () => {
    await registerPush(false, () => false);
    expect(http).not.toHaveBeenCalled();
  });

  it('remove token no logout e permite zerar badge', async () => {
    await unregisterPush();
    await syncIconBadge(0);
    expect(http).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'DELETE' }));
    expect(native.setBadgeCountAsync).toHaveBeenCalledWith(0);
  });

  it('cria canal Android antes de pedir permissão e obter token', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    await registerPush(true);
    expect(native.setNotificationChannelAsync).toHaveBeenCalledWith('social', expect.objectContaining({ importance: 3 }));
    expect(native.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(native.requestPermissionsAsync.mock.invocationCallOrder[0]);
    expect(http).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: expect.objectContaining({ platform: 'android' }) }));
    os.restore();
  });

  it('guarda revogação antes de sair offline e a conclui sem sessão quando a rede volta', async () => {
    const store = new Map<string, string>([
      ['popularia.push.installation', '00000000-0000-4000-8000-000000000001'],
      ['popularia.push.registration', JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', secret: 'revocation-secret' })],
    ]);
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => store.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store.set(key, value); });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => { store.delete(key); });
    http.mockRejectedValueOnce(new Error('offline'));
    await expect(unregisterPush()).rejects.toThrow('offline');
    expect(JSON.parse(store.get('popularia.push.revocations')!)).toEqual([{ id: '00000000-0000-4000-8000-000000000001', secret: 'revocation-secret' }]);
    await flushPushRevocations();
    expect(http).toHaveBeenLastCalledWith('/push-devices/00000000-0000-4000-8000-000000000001/revocation', { method: 'POST', body: { revocationSecret: 'revocation-secret' }, timeoutMs: 5000 });
    expect(JSON.parse(store.get('popularia.push.revocations')!)).toEqual([]);
  });

  it('propaga falhas de provider/registro sem logar o token', async () => {
    native.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('offline'));
    await expect(registerPush()).rejects.toThrow('offline');
    expect(http).not.toHaveBeenCalled();
  });

  it('payload só permite buscar UUID da conta atual; URLs e outra conta são ignorados', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(pushNotificationId({ notificationId: id, recipientId: 'bia' }, 'bia')).toBe(id);
    expect(pushNotificationId({ notificationId: id, recipientId: 'ana' }, 'bia')).toBeNull();
    expect(pushNotificationId({ notificationId: 'https://evil.test', recipientId: 'bia' }, 'bia')).toBeNull();
    expect(pushNotificationId(undefined, 'bia')).toBeNull();
  });
});
