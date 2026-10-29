import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiRequest, getSessionGeneration, getSessionId } from '@/lib/api/client';

const REGISTRATION_KEY = 'popularia.push.registration';
const REVOCATIONS_KEY = 'popularia.push.revocations';
type Revocation = { id: string; secret: string };
let storageOperation = Promise.resolve();
function storageTask<T>(task: () => Promise<T>): Promise<T> {
  const next = storageOperation.then(task, task);
  storageOperation = next.then(() => {}, () => {});
  return next;
}

const INSTALLATION_KEY = 'popularia.push.installation';
export type PushPermission = 'unavailable' | 'undetermined' | 'granted' | 'denied';
export const pushAvailable = Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';
let installation: Promise<string> | null = null;
let blockedSessionId: string | null = null;

function installationId(): Promise<string> {
  installation ??= (async () => {
    const stored = await SecureStore.getItemAsync(INSTALLATION_KEY);
    if (stored) return stored;
    const id = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALLATION_KEY, id);
    return id;
  })().catch((error: unknown) => { installation = null; throw error; });
  return installation;
}

export async function pushPermission(): Promise<PushPermission> {
  if (!pushAvailable) return 'unavailable';
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted || permission.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return permission.canAskAgain && permission.status === 'undetermined' ? 'undetermined' : 'denied';
}

/** No permission prompt during login/restoration. Avisos offers the contextual action. */
export async function registerPush(requestPermission = false, stillCurrent: () => boolean = () => true): Promise<PushPermission> {
  if (!pushAvailable) return 'unavailable';
  const generation = getSessionGeneration();
  const current = () => stillCurrent() && generation === getSessionGeneration() && blockedSessionId !== getSessionId();
  if (!current()) return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('social', { name: 'Interações e avisos', importance: AndroidImportance.DEFAULT });
  }
  if (requestPermission) await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  const permission = await pushPermission();
  if (!current()) return permission;
  if (permission !== 'granted') {
    await unregisterPush(current);
    return permission;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) throw new Error('Projeto Expo não configurado.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const id = await installationId();
  if (!current()) return permission;
  const secret = await storageTask(async () => {
    const stored = await SecureStore.getItemAsync(REGISTRATION_KEY);
    const previous = stored ? JSON.parse(stored) as { sessionId: string; secret: string } : null;
    const secret = previous?.sessionId === getSessionId() ? previous.secret : Crypto.randomUUID();
    await SecureStore.setItemAsync(REGISTRATION_KEY, JSON.stringify({ id, secret, sessionId: getSessionId() }));
    return secret;
  });
  if (!current()) return permission;
  await apiRequest(`/me/push-devices/${id}`, { method: 'PUT', auth: true, body: { token, platform: Platform.OS, revocationSecret: secret } });
  return permission;
}

export async function logoutPush(): Promise<void> {
  if (!pushAvailable) return;
  blockedSessionId = getSessionId();
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
  await syncIconBadge(0).catch(() => {});
  await unregisterPush();
}

export async function unregisterPush(stillCurrent: () => boolean = () => true): Promise<void> {
  if (!pushAvailable) return;
  await storageTask(async () => {
    if (!stillCurrent()) return;
    const registration = await SecureStore.getItemAsync(REGISTRATION_KEY);
    if (!registration) return;
    const { id, secret } = JSON.parse(registration) as Revocation;
    const stored = await SecureStore.getItemAsync(REVOCATIONS_KEY);
    const pending = stored ? JSON.parse(stored) as Revocation[] : [];
    if (!pending.some((item) => item.secret === secret)) pending.push({ id, secret });
    await SecureStore.setItemAsync(REVOCATIONS_KEY, JSON.stringify(pending));
    await SecureStore.deleteItemAsync(REGISTRATION_KEY);
  });
  const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (id && stillCurrent()) await apiRequest(`/me/push-devices/${id}`, { method: 'DELETE', auth: true, timeoutMs: 5000 });
  await flushPushRevocations();
}

/** Persisted before logout; retries without auth at next launch/resume, including signed-out state. */
export async function flushPushRevocations(): Promise<void> {
  if (!pushAvailable) return;
  const pending = await storageTask(async () => {
    const stored = await SecureStore.getItemAsync(REVOCATIONS_KEY);
    return stored ? JSON.parse(stored) as Revocation[] : [];
  });
  for (const item of pending) {
    await apiRequest(`/push-devices/${item.id}/revocation`, { method: 'POST', body: { revocationSecret: item.secret }, timeoutMs: 5000 });
    await storageTask(async () => {
      const stored = await SecureStore.getItemAsync(REVOCATIONS_KEY);
      const remaining = (stored ? JSON.parse(stored) as Revocation[] : []).filter((entry) => entry.secret !== item.secret);
      await SecureStore.setItemAsync(REVOCATIONS_KEY, JSON.stringify(remaining));
    });
  }
}

export async function syncIconBadge(count: number): Promise<void> {
  if (pushAvailable) await Notifications.setBadgeCountAsync(count);
}

/** The payload is an opaque lookup hint. The authenticated API resolves/authorizes the target. */
export function pushNotificationId(data: Record<string, unknown> | undefined, accountId: string): string | null {
  return data?.recipientId === accountId && typeof data.notificationId === 'string' && /^[0-9a-f-]{36}$/i.test(data.notificationId) ? data.notificationId : null;
}
