import { useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useNotifications } from './notifications-context';

export function useUnreadCount(): number {
  const { unreadCount, refreshUnread } = useNotifications();
  const segments = useSegments() as string[];
  const tab = segments[1];
  useEffect(() => { void refreshUnread(); }, [tab, refreshUnread]);
  return unreadCount;
}
