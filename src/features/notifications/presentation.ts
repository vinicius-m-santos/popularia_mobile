import type { NotificationKind } from '@/types/models';

export function notificationText(kind: NotificationKind, hasActor: boolean): string {
  const messages: Record<NotificationKind, string> = {
    follow: 'começou a seguir você',
    comment: 'comentou na sua publicação',
    reply: 'respondeu ao seu comentário',
    join_requested: 'solicitou entrar em',
    join_approved: 'Sua solicitação para entrar foi aceita em',
    join_rejected: 'Sua solicitação para entrar foi recusada em',
    ownership_proposed: 'propôs transferir para você a propriedade de',
    ownership_accepted: hasActor ? 'aceitou a transferência de propriedade de' : 'Você agora é proprietário de',
    ownership_declined: 'recusou a transferência de propriedade de',
    ownership_cancelled: 'cancelou a proposta de transferência de',
  };
  return messages[kind];
}

export function showsActorInMessage(kind: NotificationKind): boolean {
  return kind !== 'join_approved' && kind !== 'join_rejected';
}
