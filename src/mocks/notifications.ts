import type { NotificationKind, NotificationTarget } from '@/types/models';

import { hoursAgo, minutesAgo } from './time';

export type NotificationMock = {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  actorUserId?: string;
  text: string;
  subject?: string;
  quote?: string;
  unread: boolean;
  target: NotificationTarget | null;
};

export const notifications: NotificationMock[] = [
  {
    id: 'n1', kind: 'reply', createdAt: minutesAgo(5), actorUserId: 'marcos',
    text: 'respondeu ao seu comentário', quote: 'Concordo, Camila. A banca pode ficar perto da estação.',
    unread: true, target: { kind: 'post', id: 'tarifa' },
  },
  {
    id: 'n2', kind: 'comment', createdAt: minutesAgo(22), actorUserId: 'luana',
    text: 'comentou na sua publicação', quote: 'Vamos conversar sobre isso na próxima reunião.',
    unread: true, target: { kind: 'post', id: 'me1' },
  },
  {
    id: 'n3', kind: 'follow', createdAt: hoursAgo(5), actorUserId: 'tiago',
    text: 'começou a seguir você', unread: false, target: { kind: 'profile', id: 'tiago' },
  },
];
