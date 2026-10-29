import { queryClient } from '@/lib/query/client';

function isAppUser(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string'
    && typeof value.handle === 'string'
    && typeof value.name === 'string'
    && typeof value.initials === 'string'
    && typeof value.tone === 'string'
    && !('coverAlt' in value)
    && !('memberCount' in value);
}

function isComuna(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string' && typeof value.coverAlt === 'string' && typeof value.memberCount === 'number';
}

function rewrite(value: unknown, visit: (record: Record<string, unknown>) => Record<string, unknown> | null, seen: WeakSet<object>): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    let changed = false;
    const next = value.map((item) => {
      const mapped = rewrite(item, visit, seen);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }
  const record = value as Record<string, unknown>;
  const replaced = visit(record);
  // A mesma pessoa pode aparecer em vários cartões. Um ciclo que não é pessoa é interrompido.
  if (replaced) return replaced;
  if (seen.has(record)) return record;
  seen.add(record);
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    const mapped = rewrite(child, visit, seen);
    next[key] = mapped;
    if (mapped !== child) changed = true;
  }
  return changed ? next : value;
}

function patchQueries(visit: (record: Record<string, unknown>) => Record<string, unknown> | null): void {
  for (const query of queryClient.getQueryCache().getAll()) {
    const next = rewrite(query.state.data, visit, new WeakSet());
    if (next !== query.state.data) queryClient.setQueryData(query.queryKey, next);
  }
}

/** Atualiza a foto nas queries já carregadas e avisa os avatares que observam esta pessoa. */
export function publishAvatar(userId: string, avatarUrl: string): void {
  queryClient.setQueryData(['user-avatar', userId], avatarUrl);
  patchQueries((record) => {
    if (!isAppUser(record) || record.id !== userId || record.avatarUrl === avatarUrl) return null;
    return { ...record, avatarUrl };
  });
}

/** Atualiza a capa nas comunas já presentes no cache, pelo slug e pelo UUID. */
export function publishCover(comuna: { id: string; serverId?: string }, coverUrl: string): void {
  queryClient.setQueryData(['comuna-cover', comuna.id], coverUrl);
  patchQueries((record) => {
    if (!isComuna(record) || record.coverUrl === coverUrl) return null;
    const same = record.id === comuna.id || (comuna.serverId !== undefined && record.serverId === comuna.serverId);
    if (!same) return null;
    return { ...record, coverUrl };
  });
}
