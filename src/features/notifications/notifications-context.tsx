import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import type { AppNotification } from '@/types/models';

import { getUnreadCount, markAllNotificationsRead, readNotification } from './api';

type NotificationsValue = {
  unreadCount: number;
  readIds: ReadonlySet<string>;
  refreshUnread: () => Promise<void>;
  read: (id: string, wasUnread: boolean) => Promise<AppNotification>;
  readAll: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, account } = useAccount();
  const active = DEMO_MODE || status === 'signedIn';
  const identity = DEMO_MODE ? 'demo' : account?.id ?? 'signedOut';
  return <NotificationsSession key={identity} active={active}>{children}</NotificationsSession>;
}

/** Account changes drop every count/read override and ignore the old session's responses. */
function NotificationsSession({ children, active }: { children: ReactNode; active: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const request = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const refreshUnread = useCallback(async () => {
    if (!active) return;
    const generation = ++request.current;
    try {
      const count = await getUnreadCount();
      if (mounted.current && generation === request.current) setUnreadCount(count);
    } catch {
      // Temporary errors preserve the last known count. Next focus/refresh retries.
    }
  }, [active]);

  const read = useCallback(async (id: string, wasUnread: boolean) => {
    request.current++;
    const notification = await readNotification(id);
    if (mounted.current) {
      request.current++;
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
      setReadIds((previous) => new Set([...previous, id]));
      void refreshUnread();
    }
    return notification;
  }, [refreshUnread]);

  const readAll = useCallback(async () => {
    request.current++;
    const count = await markAllNotificationsRead();
    if (mounted.current) {
      request.current++;
      setUnreadCount(count);
    }
  }, []);

  const value = useMemo(() => ({ unreadCount, readIds, refreshUnread, read, readAll }), [unreadCount, readIds, refreshUnread, read, readAll]);
  return <NotificationsContext value={value}>{children}</NotificationsContext>;
}

export function useNotifications(): NotificationsValue {
  const context = use(NotificationsContext);
  if (!context) throw new Error('useNotifications precisa estar dentro de NotificationsProvider.');
  return context;
}
