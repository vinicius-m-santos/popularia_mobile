import type { ComunaRole } from '@/types/models';

export type CallTarget = { kind: 'perfil' } | { kind: 'comuna'; comuna: { name: string; viewerRole?: ComunaRole | null } };

/** A API só deixa fundador/moderação criar chamado em uma comuna. */
export function canModerateComuna(role?: ComunaRole | null): boolean {
  return role === 'founder' || role === 'moderator';
}

/** Nomes das comunas selecionadas em que a pessoa não pode criar chamado. */
export function callBlockedComunaNames(targets: CallTarget[]): string[] {
  return targets.flatMap((target) => target.kind === 'comuna' && !canModerateComuna(target.comuna.viewerRole) ? [target.comuna.name] : []);
}
