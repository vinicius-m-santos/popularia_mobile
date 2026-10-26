import type { Comuna, TopicId } from '@/types/models';

/**
 * Ordena comunas pelos interesses da pessoa: mais assuntos em comum primeiro,
 * depois as maiores. Sem interesses, fica só o tamanho.
 */
export function rankByInterests(list: Comuna[], interests: TopicId[]): Comuna[] {
  const score = (c: Comuna) => c.topics.filter((t) => interests.includes(t)).length;
  return [...list].sort((a, b) => score(b) - score(a) || b.memberCount - a.memberCount);
}
