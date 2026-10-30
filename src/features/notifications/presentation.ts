import type { NotificationKind } from '@/types/models';

export function notificationText(kind: NotificationKind, hasActor: boolean): string {
  const messages: Record<NotificationKind, string> = {
    comment_support: 'apoiou seu comentário',
    square_reply: 'respondeu à sua mensagem na Praça',
    follow: 'começou a seguir você',
    comment: 'comentou na sua publicação',
    reply: 'respondeu ao seu comentário',
    mention_post: 'mencionou você em uma publicação',
    mention_comment: 'mencionou você em um comentário',
    join_requested: 'solicitou entrar em',
    join_approved: 'Sua solicitação para entrar foi aceita em',
    join_rejected: 'Sua solicitação para entrar foi recusada em',
    ownership_proposed: 'propôs transferir para você a propriedade de',
    ownership_accepted: hasActor ? 'aceitou a transferência de propriedade de' : 'Você agora é proprietário de',
    ownership_declined: 'recusou a transferência de propriedade de',
    ownership_cancelled: 'cancelou a proposta de transferência de',
    event_rescheduled: 'alterou o horário de uma atividade em',
    event_place_changed: 'alterou o local de uma atividade em',
    event_link_changed: 'alterou o link de uma atividade em',
    event_updated: 'atualizou uma atividade em',
    event_cancelled: 'cancelou uma atividade em',
    event_reminder: 'Há um lembrete de atividade em',
  };
  return messages[kind];
}

export function showsActorInMessage(kind: NotificationKind): boolean {
  return kind !== 'join_approved' && kind !== 'join_rejected' && kind !== 'event_reminder';
}
