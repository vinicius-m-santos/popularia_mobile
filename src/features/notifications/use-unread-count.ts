import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import { useNotifications } from './notifications-context';

/**
 * Mantém o badge do feed fresco enquanto a rota está em foco.
 *
 * O foco cobre voltar de Avisos, de uma publicação ou de outra aba; o
 * `AppState` cobre o retorno do background sem foco novo e força a leitura,
 * porque o contador pode ter mudado enquanto o app estava fora. Os dois
 * gatilhos chamam a mesma leitura com single-flight/janela no contexto, então
 * eventos encadeados não viram requests duplicadas. Fora do foco, o runtime de
 * push é quem mantém o contador — a barra não tem um listener ocioso.
 */
export function useUnreadCount(): number {
  const { unreadCount, refreshUnread } = useNotifications();
  useFocusEffect(useCallback(() => {
    void refreshUnread();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnread({ force: true });
    });
    return () => subscription?.remove();
  }, [refreshUnread]));
  return unreadCount;
}
