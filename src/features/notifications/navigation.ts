import { router, type Href } from 'expo-router';

import { hrefComuna, hrefPost, hrefProfile } from '@/lib/routes';
import type { NotificationTarget } from '@/types/models';

export function notificationHref(target: NotificationTarget): Href {
  switch (target.kind) {
    case 'square': return { pathname: '/praca/[id]', params: { id: target.id } };
    case 'profile': return hrefProfile('/avisos', target.id);
    case 'post': return hrefPost('/avisos', target.id);
    case 'comuna': return hrefComuna('/avisos', target.id);
    case 'join_requests': return { pathname: '/gerir-comuna/[id]', params: { id: target.id, aba: 'pedidos' } };
  }
}

export function openNotificationTarget(target: NotificationTarget): void {
  router.push(notificationHref(target));
}
