import { destinationHref, openDestination } from '@/features/links/destinations';
import type { NotificationTarget } from '@/types/models';

export function notificationHref(target: NotificationTarget) { return destinationHref(target, '/avisos'); }
export function openNotificationTarget(target: NotificationTarget): void { openDestination(target, '/avisos'); }
