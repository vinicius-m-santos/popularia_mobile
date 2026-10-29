import { DEMO_MODE } from '@/constants/config';
import { findUser } from '@/features/lookup';
import { toUser } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import type { AuthorDto, PageDto } from '@/lib/api/dto';
import { mockDelay } from '@/lib/mock-delay';
import { singlePage, type Page } from '@/lib/pagination';
import { notifications } from '@/mocks/notifications';
import type { AppNotification, NotificationKind, NotificationTarget } from '@/types/models';

import { notificationText } from './presentation';

export type NotificationDto = {
  id: string;
  type: NotificationKind;
  actor: AuthorDto | null;
  subject: string | null;
  quote: string | null;
  createdAt: string;
  readAt: string | null;
  target: NotificationTarget;
};

export function toNotification(dto: NotificationDto): AppNotification {
  return {
    id: dto.id, kind: dto.type, actor: dto.actor ? toUser(dto.actor) : null,
    text: notificationText(dto.type, !!dto.actor), subject: dto.subject ?? undefined,
    quote: dto.quote ?? undefined, createdAt: dto.createdAt, unread: dto.readAt === null,
    target: dto.target,
  };
}

const demoRead = new Set<string>();

function demoNotifications(): AppNotification[] {
  return notifications.map((n) => ({
    ...n, actor: n.actorUserId ? findUser(n.actorUserId) : null,
    unread: n.unread && !demoRead.has(n.id),
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getNotifications(cursor: string | null = null): Promise<Page<AppNotification>> {
  if (DEMO_MODE) return mockDelay(singlePage(demoNotifications()));
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await apiRequest<PageDto<NotificationDto>>(`/me/notifications${query}`, { auth: true });
  return { items: page.items.map(toNotification), nextCursor: page.nextCursor };
}

export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  if (DEMO_MODE) return mockDelay(demoNotifications().filter((n) => n.unread).length);
  return (await apiRequest<{ unreadCount: number }>('/me/notifications/unread-count', { auth: true, ...(signal ? { signal } : {}) })).unreadCount;
}

/** Revalidates current access on the server immediately before navigation. */
export async function readNotification(id: string): Promise<AppNotification> {
  if (DEMO_MODE) {
    demoRead.add(id);
    const notification = demoNotifications().find((n) => n.id === id);
    if (!notification) throw new Error('Esta notificação não está mais disponível.');
    return mockDelay(notification);
  }
  return toNotification(await apiRequest<NotificationDto>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT', auth: true }));
}

export async function markAllNotificationsRead(): Promise<number> {
  if (DEMO_MODE) {
    notifications.forEach((n) => demoRead.add(n.id));
    return mockDelay(0);
  }
  return (await apiRequest<{ unreadCount: number }>('/me/notifications/read-all', { method: 'PUT', auth: true })).unreadCount;
}
