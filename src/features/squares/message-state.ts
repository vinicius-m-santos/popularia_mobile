import type { Reaction, SquareMessage } from './api';

/** Retém referências de linhas inalteradas e reconcilia clientId com o eco do polling. */
export function mergeMessages(current: SquareMessage[], incoming: SquareMessage[], limit = 200): SquareMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  const confirmed = new Set(incoming.filter((m) => !m.pending && m.clientId).map((m) => m.clientId));
  for (const m of current) if (m.pending && confirmed.has(m.clientId)) byId.delete(m.id);
  for (const m of incoming) {
    const old = byId.get(m.id);
    // Older history requests can finish after an optimistic action / newer polling response.
    if (old && old.revision > m.revision) continue;
    if (!old || JSON.stringify(old) !== JSON.stringify(m)) byId.set(m.id, m);
  }
  return [...byId.values()].sort((a, b) => Number(!!b.pending) - Number(!!a.pending) || b.id.localeCompare(a.id)).slice(0, limit);
}

export function optimisticReaction(reactions: Reaction[], emoji: string): Reaction[] {
  const old = reactions.find((r) => r.emoji === emoji);
  const next = { emoji, mine: !old?.mine, count: (old?.count ?? 0) + (old?.mine ? -1 : 1) };
  return [...reactions.filter((r) => r.emoji !== emoji), ...(next.count > 0 ? [next] : [])];
}
