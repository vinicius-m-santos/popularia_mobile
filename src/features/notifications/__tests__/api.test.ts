import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import type { NotificationTarget } from '@/types/models';

import { getNotifications, getUnreadCount, markAllNotificationsRead, readNotification, type NotificationDto } from '../api';
import { notificationHref } from '../navigation';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const dto: NotificationDto = {
  id: 'n1', type: 'reply', actor: { id: 'a', handle: 'ana', displayName: 'Ana' },
  subject: null, quote: 'Resposta', readAt: null, createdAt: '2026-10-26T12:00:00Z', target: { kind: 'post', id: 'p1' },
};

beforeEach(() => { jest.resetAllMocks(); });

describe('API de avisos', () => {
  it('envia cursor e autenticação e converte o estado lido/ator', async () => {
    jest.mocked(apiRequest).mockResolvedValueOnce({ items: [dto], nextCursor: 'next' });
    const page = await getNotifications('cursor com espaços');
    expect(apiRequest).toHaveBeenCalledWith('/me/notifications?cursor=cursor%20com%20espa%C3%A7os', { auth: true });
    expect(page.items[0]).toMatchObject({ kind: 'reply', unread: true, actor: { handle: 'ana' }, text: 'respondeu ao seu comentário' });
    expect(page.nextCursor).toBe('next');
    jest.mocked(apiRequest).mockResolvedValueOnce({ ...dto, readAt: '2026-10-26T13:00:00Z' });
    expect((await readNotification('n1')).unread).toBe(false);
    expect(apiRequest).toHaveBeenLastCalledWith('/me/notifications/n1/read', { method: 'PUT', auth: true });
  });

  it('contador e leitura de todas não dependem de carregar o histórico', async () => {
    jest.mocked(apiRequest).mockResolvedValueOnce({ unreadCount: 150 }).mockResolvedValueOnce({ unreadCount: 0 });
    expect(await getUnreadCount()).toBe(150);
    expect(await markAllNotificationsRead()).toBe(0);
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/me/notifications/unread-count', { auth: true });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/me/notifications/read-all', { method: 'PUT', auth: true });
  });

  it.each([
    [{ kind: 'profile', id: 'ana' }, '/avisos/pessoa/ana'],
    [{ kind: 'post', id: 'p1' }, '/avisos/post/p1'],
    [{ kind: 'comuna', id: 'ti' }, '/avisos/comuna/ti'],
    [{ kind: 'join_requests', id: 'ti' }, { pathname: '/gerir-comuna/[id]', params: { id: 'ti', aba: 'pedidos' } }],
  ] as [NotificationTarget, unknown][])('mapeia o destino %j para a rota existente', (target, expected) => {
    expect(notificationHref(target)).toEqual(expected);
  });
});
