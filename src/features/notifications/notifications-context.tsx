import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { queryClient } from '@/lib/query/client';
import type { AppNotification } from '@/types/models';

import { getUnreadCount, markAllNotificationsRead, readNotification } from './api';

type NotificationsValue = {
  revision: number;
  changed: () => void;
  unreadCount: number;
  readIds: ReadonlySet<string>;
  refreshUnread: (options?: { force?: boolean }) => Promise<void>;
  read: (id: string, wasUnread: boolean) => Promise<AppNotification>;
  readAll: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * O contador não precisa de uma request por cada gatilho visual (foco da aba,
 * retorno do app, foco de Avisos). Esta janela mantém o badge fresco sem repetir
 * a leitura que acabou de chegar; ações que mudam o estado usam `force`.
 */
const UNREAD_REFRESH_INTERVAL_MS = 10_000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, account } = useAccount();
  const active = DEMO_MODE || status === 'signedIn';
  const identity = DEMO_MODE ? 'demo' : account?.id ?? 'signedOut';
  return <NotificationsSession key={identity} active={active} identity={identity}>{children}</NotificationsSession>;
}

/** Account changes drop every count/read override and ignore the old session's responses. */
function NotificationsSession({ children, active, identity }: { children: ReactNode; active: boolean; identity: string }) {
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => {
    setRevision((value) => value + 1);
    void queryClient.invalidateQueries({ queryKey: ['notifications', identity] });
  }, [identity]);
  const reads = useRef(new Map<string, Promise<AppNotification>>());
  const localReadIds = useRef(new Set<string>());
  const [unreadCount, setUnreadCount] = useState(0);
  const countRef = useRef(0);
  const updateUnread = useCallback((count: number) => {
    countRef.current = Math.max(0, count);
    setUnreadCount(countRef.current);
  }, []);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const request = useRef(0);
  const mounted = useRef(true);
  const unreadFlight = useRef<Promise<void> | null>(null);
  const unreadFetchedAt = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      unreadFlight.current = null;
      void queryClient.cancelQueries({ queryKey: ['notifications', identity] });
      queryClient.removeQueries({ queryKey: ['notifications', identity] });
    };
  }, [identity]);

  const refreshUnread = useCallback((options?: { force?: boolean }) => {
    if (!active || reads.current.size > 0) return Promise.resolve();
    const now = Date.now();
    if (!options?.force && now - unreadFetchedAt.current < UNREAD_REFRESH_INTERVAL_MS) return Promise.resolve();
    const pending = unreadFlight.current;
    if (pending) return pending;
    const generation = ++request.current;
    const flight: Promise<void> = queryClient.fetchQuery({ queryKey: ['notifications', identity, 'unread'], queryFn: ({ signal }) => getUnreadCount(signal), staleTime: 0, retry: false, gcTime: 60_000 })
      .then((count) => {
        unreadFetchedAt.current = Date.now();
        if (mounted.current && generation === request.current) updateUnread(count);
      })
      .catch(() => {
        // Temporary errors preserve the last known count. Next focus/refresh retries.
      })
      .finally(() => {
        if (unreadFlight.current === flight) unreadFlight.current = null;
      });
    unreadFlight.current = flight;
    return flight;
  }, [active, identity, updateUnread]);

  const read = useCallback((id: string, wasUnread: boolean) => {
    const pending = reads.current.get(id);
    if (pending) return pending;
    request.current++;
    // A leitura já está mudando o contador no servidor: uma resposta antiga do
    // contador não pode sobrescrever o valor otimista. A próxima leitura começa
    // depois da confirmação, com `force`.
    unreadFlight.current = null;
    void queryClient.cancelQueries({ queryKey: ['notifications', identity, 'unread'] });
    const previouslyRead = localReadIds.current.has(id);
    const optimistic = wasUnread && !localReadIds.current.has(id);
    localReadIds.current.add(id);
    setReadIds(new Set(localReadIds.current));
    const decrement = optimistic ? Math.min(1, countRef.current) : 0;
    if (optimistic) updateUnread(countRef.current - decrement);
    const operation = readNotification(id).then((notification) => {
      reads.current.delete(id);
      if (mounted.current) {
        request.current++;
        void refreshUnread({ force: true });
      }
      return notification;
    }, (error: unknown) => {
      reads.current.delete(id);
      if (mounted.current) {
        request.current++;
        if (!previouslyRead) {
          localReadIds.current.delete(id);
          setReadIds(new Set(localReadIds.current));
        }
        if (optimistic) updateUnread(countRef.current + decrement);
        void refreshUnread({ force: true });
      }
      throw error;
    }).finally(() => { reads.current.delete(id); });
    reads.current.set(id, operation);
    return operation;
  }, [refreshUnread, identity, updateUnread]);

  const readAll = useCallback(async () => {
    request.current++;
    unreadFlight.current = null;
    void queryClient.cancelQueries({ queryKey: ['notifications', identity, 'unread'] });
    const count = await markAllNotificationsRead();
    if (mounted.current) {
      request.current++;
      updateUnread(count);
    }
  }, [identity, updateUnread]);

  const value = useMemo(() => ({ revision, changed, unreadCount, readIds, refreshUnread, read, readAll }), [revision, changed, unreadCount, readIds, refreshUnread, read, readAll]);
  return <NotificationsContext value={value}>{children}</NotificationsContext>;
}

export function useNotifications(): NotificationsValue {
  const context = use(NotificationsContext);
  if (!context) throw new Error('useNotifications precisa estar dentro de NotificationsProvider.');
  return context;
}
