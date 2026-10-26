/** Acesso aos avisos da pessoa logada. */
import { USE_MOCKS } from '@/constants/config';
import { findComuna, findUser } from '@/features/lookup';
import { mockDelay } from '@/lib/mock-delay';
import { notifications } from '@/mocks/notifications';
import type { AppNotification } from '@/types/models';

/** Avisos do mais recente para o mais antigo. Avisos com origem desconhecida são descartados. */
export async function getNotifications(): Promise<AppNotification[]> {
  if (!USE_MOCKS) throw new Error('A integração com a API ainda não foi implementada.');
  const list = notifications.flatMap((n): AppNotification[] => {
    const user = n.actorUserId ? findUser(n.actorUserId) : null;
    const comuna = n.actorComunaId ? findComuna(n.actorComunaId) : null;
    const actor = user ? { kind: 'user' as const, user } : comuna ? { kind: 'comuna' as const, comuna } : null;
    if (!actor) return [];
    return [
      {
        id: n.id,
        kind: n.kind,
        createdAt: n.createdAt,
        actor,
        text: n.text,
        subject: n.subject,
        quote: n.quote,
        unread: n.unread,
        target: n.target,
      },
    ];
  });
  return mockDelay(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}
