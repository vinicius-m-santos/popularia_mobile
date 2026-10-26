import type { NotificationKind, NotificationTarget } from '@/types/models';

import { daysAgo, hoursAgo, minutesAgo } from './time';

export type NotificationMock = {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  /** Pessoa que fez a ação, ou a comuna em avisos de comuna. */
  actorUserId?: string;
  actorComunaId?: string;
  text: string;
  subject?: string;
  quote?: string;
  unread: boolean;
  target: NotificationTarget | null;
};

/** Avisos fictícios da pessoa logada (2g). */
export const notifications: NotificationMock[] = [
  {
    id: 'n1',
    kind: 'reply',
    createdAt: minutesAgo(5),
    actorUserId: 'marcos',
    text: 'respondeu ao seu comentário em',
    subject: 'Tarifa Zero BH',
    quote: 'Concordo, Camila. A banca pode ficar perto da estação.',
    unread: true,
    target: { kind: 'post', id: 'tarifa' },
  },
  {
    id: 'n2',
    kind: 'mention',
    createdAt: minutesAgo(22),
    actorUserId: 'luana',
    text: 'mencionou você em',
    subject: 'Tarifa Zero já',
    quote: '@camilarocha você consegue levar as pranchetas?',
    unread: true,
    target: { kind: 'post', id: 'tarifa' },
  },
  {
    id: 'n3',
    kind: 'comuna',
    createdAt: hoursAgo(1),
    actorComunaId: 'tarifa',
    text: 'convocou um ato:',
    subject: 'Tarifa Zero já · quinta, 17h',
    unread: true,
    target: { kind: 'comuna', id: 'tarifa' },
  },
  {
    id: 'n4',
    kind: 'moderation',
    createdAt: hoursAgo(2),
    actorComunaId: 'cursinho',
    text: 'tem 3 denúncias aguardando sua análise',
    unread: true,
    target: { kind: 'moderation', id: 'cursinho' },
  },
  {
    id: 'n5',
    kind: 'support',
    createdAt: hoursAgo(3),
    actorUserId: 'jessica',
    text: 'e mais 86 pessoas apoiaram sua publicação',
    quote: 'Fiz as contas: gasto R$ 312 por mês só com ônibus…',
    unread: false,
    target: { kind: 'post', id: 'me1' },
  },
  {
    id: 'n6',
    kind: 'follow',
    createdAt: hoursAgo(5),
    actorUserId: 'tiago',
    text: 'começou a seguir você',
    unread: false,
    target: { kind: 'profile', id: 'tiago' },
  },
  {
    id: 'n7',
    kind: 'comuna',
    createdAt: daysAgo(1),
    actorComunaId: 'cursinho',
    text: 'fixou sua publicação',
    quote: 'Sábado dei minha primeira aula online de redação…',
    unread: false,
    target: { kind: 'post', id: 'me2' },
  },
  {
    id: 'n8',
    kind: 'follow',
    createdAt: daysAgo(2),
    actorUserId: 'bia',
    text: 'começou a seguir você',
    unread: false,
    target: { kind: 'profile', id: 'bia' },
  },
];
