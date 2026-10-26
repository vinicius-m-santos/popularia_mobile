/**
 * Guarda o refresh token no armazenamento seguro do sistema: Keychain no iOS e
 * Keystore no Android (expo-secure-store). Nunca em AsyncStorage ou localStorage.
 *
 * No navegador (expo start --web) não há armazenamento seguro: o refresh token
 * fica só na memória e a sessão termina ao recarregar a página.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'popularia.refresh_token';
const OPTIONS: SecureStore.SecureStoreOptions = {
  // Só neste aparelho e com ele desbloqueado; não vai para backups de outro aparelho.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let webMemory: string | null = null;

export async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webMemory;
  return SecureStore.getItemAsync(KEY, OPTIONS);
}

export async function saveRefreshToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webMemory = token;
    return;
  }
  await SecureStore.setItemAsync(KEY, token, OPTIONS);
}

export async function deleteRefreshToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webMemory = null;
    return;
  }
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}
