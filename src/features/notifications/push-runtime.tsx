import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { ApiError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';

import { openNotificationTarget } from './navigation';
import { destinationHref } from '@/features/links/destinations';
import { subscribeIncoming, takeIncomingDestination, peekIncomingDestination, incomingRevision, beginIncomingPush, receivePushDestination } from '@/features/links/incoming';
import { useNotifications } from './notifications-context';
import { flushPushRevocations, pushAvailable, pushNotificationId, registerPush, syncIconBadge } from './push';

// Foreground uses the existing Avisos UI and badge, without a duplicate OS banner/sound.
if (pushAvailable) Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

export function PushRuntime() {
  const { status, account, onboarded, showLoginWelcome } = useAccount();
  const { unreadCount, refreshUnread, read, changed } = useNotifications();
  const { show } = useToast();
  const pathname = usePathname();
  const accountId = account?.id;
  const ready = !DEMO_MODE && status === 'signedIn' && onboarded && !!account?.legalAccepted && !showLoginWelcome && !pathname.startsWith('/boas-vindas') && pathname !== '/aceite-legal';
  const handled = useRef(new Set<string>());

  const [incomingVersion, setIncomingVersion] = useState(0);
  const waitedForSession = useRef(!ready);
  useEffect(() => subscribeIncoming(() => setIncomingVersion((value) => value + 1)), []);
  useEffect(() => {
    if (!ready) { waitedForSession.current = true; return; }
    // Native-intent rewrites to a neutral bridge. Wait until Router committed it;
    // after authentication Router may instead have replaced it with the feed.
    const intent = peekIncomingDestination();
    if (!intent) { waitedForSession.current = false; return; }
    if (intent.source === 'link' && pathname !== '/abrir-link' && !waitedForSession.current) return;
    takeIncomingDestination();
    waitedForSession.current = false;
    if (intent.source === 'push') {
      if (intent.accountId === accountId) openNotificationTarget(intent.target);
    }
    else {
      if (pushAvailable) Notifications.clearLastNotificationResponse();
      router.replace(destinationHref(intent.target));
    }
  }, [ready, pathname, incomingVersion, accountId]);

  useEffect(() => {
    if (!pushAvailable || DEMO_MODE) return;
    const flush = () => { void flushPushRevocations().catch(() => {}); };
    flush();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') flush(); });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    void syncIconBadge(status === 'signedIn' ? unreadCount : 0).catch(() => {});
  }, [status, unreadCount]);

  useEffect(() => {
    if (!pushAvailable || !ready || !accountId) return;
    let current = true;
    const isCurrent = () => current;
    const refresh = () => {
      void refreshUnread();
      changed();
      void registerPush(false, isCurrent).catch(() => { /* retry on next foreground/token change */ });
    };
    refresh();
    const resume = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    const token = Notifications.addPushTokenListener(() => { void registerPush(false, isCurrent).catch(() => {}); });
    const receive = Notifications.addNotificationReceivedListener((notification) => {
      if (!pushNotificationId(notification.request.content.data, accountId)) return;
      changed();
      void refreshUnread();
      // Existing detail queries revalidate access and content; paginated Avisos receives `changed`.
      void queryClient.invalidateQueries({ queryKey: ['post'] });
    });
    const respond = async (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const key = response.notification.request.identifier;
      if (handled.current.has(key)) return;
      const id = pushNotificationId(response.notification.request.content.data, accountId);
      if (!id) {
        Notifications.clearLastNotificationResponse();
        return;
      }
      handled.current.add(key);
      const revision = beginIncomingPush();
      try {
        const notification = await read(id, true);
        if (!current) { handled.current.delete(key); return; }
        if (revision !== incomingRevision()) return;
        if (notification.target) receivePushDestination(notification.target, accountId);
        changed();
      } catch (error) {
        if (!current) { handled.current.delete(key); return; }
        if (revision !== incomingRevision()) return;
        if (error instanceof ApiError && [403, 404, 410].includes(error.status)) {
          show('Este conteúdo não está mais disponível ou você não tem mais acesso.');
        } else {
          show('Não conseguimos abrir este aviso. Tente novamente em Avisos.');
        }
      } finally {
        if (current) Notifications.clearLastNotificationResponse();
      }
    };
    const response = Notifications.addNotificationResponseReceivedListener((value) => { void respond(value); });
    // Native retains the launch response until auth/onboarding/legal gates have completed.
    const initial = Notifications.getLastNotificationResponse();
    if (initial) void respond(initial);
    return () => { current = false; resume.remove(); token.remove(); receive.remove(); response.remove(); };
  }, [ready, accountId, changed, read, refreshUnread, show]);
  return null;
}
