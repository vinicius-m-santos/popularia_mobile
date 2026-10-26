import { useCallback } from 'react';

import { useInteractions } from '@/features/interactions/interactions-context';
import { useAsyncData } from '@/hooks/use-async-data';

import { getNotifications } from './api';

/** Quantos avisos ainda não foram lidos, para o selo da aba Avisos. */
export function useUnreadCount(): number {
  const load = useCallback(() => getNotifications(), []);
  const list = useAsyncData(load);
  const { isOn } = useInteractions();
  return (list.data ?? []).filter((n) => n.unread && !isOn('readNotifications', n.id)).length;
}
