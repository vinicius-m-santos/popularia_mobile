import { ApiError, describeError } from '@/lib/errors';

/**
 * Textos para as recusas conhecidas da criação e da gestão de comunas, pelo `type` estável
 * da API. O que não estiver aqui usa o título que a própria API mandou (`describeError`).
 */
const MESSAGES: Record<string, string> = {
  '/errors/email-not-verified': 'Confirme seu e-mail para criar e gerir comunas.',
  '/errors/comuna-limit-reached': 'Cada pessoa pode ter até 3 comunas ativas. Arquive ou transfira uma para liberar a vaga.',
  '/errors/comuna-archived': 'Esta comuna está arquivada: o histórico fica para leitura, mas nada novo pode ser feito nela.',
  '/errors/comuna-has-members': 'Esta comuna tem outros membros e não pode ser excluída. Você pode arquivá-la.',
  '/errors/comuna-has-content': 'Esta comuna tem publicações ou comentários de outras pessoas e não pode ser excluída. Você pode arquivá-la.',
  '/errors/not-comuna-owner': 'Só quem é proprietário da comuna pode fazer isso.',
  '/errors/not-comuna-moderator': 'Só a moderação desta comuna pode fazer isso.',
  '/errors/cannot-remove-owner': 'Ninguém pode remover quem é proprietário da comuna.',
  '/errors/target-not-member': 'Esta pessoa não participa da comuna.',
  '/errors/members-only': 'Só quem participa vê a lista de membros.',
  '/errors/join-request-closed': 'Este pedido já foi decidido ou retirado.',
  '/errors/transfer-stale': 'Esta proposta de transferência não vale mais.',
};

/** Mensagem para mostrar depois de uma falha (inclui erros de rede e de validação). */
export function comunaErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // A criação explica o intervalo com a data no próprio texto da API.
    if (error.type === '/errors/comuna-creation-interval') return error.title;
    if (MESSAGES[error.type]) return MESSAGES[error.type];
  }
  return describeError(error);
}

/** Recusas da exclusão que oferecem arquivar no lugar. */
export function deletionNeedsArchive(error: unknown): boolean {
  return error instanceof ApiError && (error.type === '/errors/comuna-has-members' || error.type === '/errors/comuna-has-content');
}
