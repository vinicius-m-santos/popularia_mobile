import type { ComunaPerson, ComunaRole } from '@/types/models';

export type MemberAction = 'appoint' | 'dismiss' | 'transfer' | 'remove';

type Viewer = {
  /** @ da pessoa logada (para não oferecer ações sobre ela mesma). */
  handle: string;
  role: ComunaRole | null | undefined;
  archived: boolean;
};

/**
 * Ações que a interface oferece sobre uma pessoa da comuna. Espelha as regras do servidor
 * (ComunaModerationPolicy) só para não mostrar botões inúteis; o servidor decide de novo:
 * - ninguém age sobre quem é proprietário, nem sobre si mesmo;
 * - a moderação remove membros comuns;
 * - o proprietário também nomeia e tira da moderação, remove quem modera e propõe transferência;
 * - em comuna arquivada, só remover e tirar da moderação continuam valendo.
 */
export function memberActions(person: ComunaPerson, viewer: Viewer): MemberAction[] {
  if (person.role === 'founder' || person.handle === viewer.handle) return [];
  if (viewer.role === 'moderator') return person.role === 'member' ? ['remove'] : [];
  if (viewer.role !== 'founder') return [];

  const actions: MemberAction[] = [];
  if (person.role === 'member' && !viewer.archived) actions.push('appoint');
  if (person.role === 'moderator') actions.push('dismiss');
  if (!viewer.archived) actions.push('transfer');
  actions.push('remove');
  return actions;
}
