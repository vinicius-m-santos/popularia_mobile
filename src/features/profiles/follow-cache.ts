import type { QueryKey } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';

/** Relação de quem está olhando com outra pessoa. `following` e `requested` não são verdadeiros juntos. */
export type FollowFlags = { following: boolean; requested: boolean };

type Snapshot = { queryKey: QueryKey; data: unknown };

const requested = new Map<string, boolean>();
const locks = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeFollowStore(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function followStoreVersion() {
  return version;
}

export function readRequested(userId: string) {
  return requested.get(userId) ?? false;
}

export function setRequestedFlag(userId: string, value: boolean) {
  if ((requested.get(userId) ?? false) === value) return;
  if (value) requested.set(userId, true);
  else requested.delete(userId);
  emit();
}

export function isFollowLocked(userId: string) {
  return locks.has(userId);
}

/** Uma alteração por pessoa por vez. O segundo toque enquanto a primeira segue em voo é ignorado. */
export function lockFollow(userId: string) {
  if (locks.has(userId)) return false;
  locks.add(userId);
  emit();
  return true;
}

export function unlockFollow(userId: string) {
  if (!locks.delete(userId)) return;
  emit();
}

export function resetFollowSession() {
  requested.clear();
  locks.clear();
  emit();
}

export function snapshotFollowCaches(): Snapshot[] {
  return queryClient.getQueryCache().getAll()
    .filter((query) => {
      const root = String(query.queryKey[0]);
      return root === 'profile' || root === 'relations' || (root === 'feed' && query.queryKey[1] === 'seguindo');
    })
    .map((query) => ({ queryKey: query.queryKey, data: query.state.data }));
}

export function restoreFollowCaches(snapshots: Snapshot[]) {
  for (const snapshot of snapshots) queryClient.setQueryData(snapshot.queryKey, snapshot.data);
}

type ProfileLike = { user?: { id?: string }; followerCount?: number; followingCount?: number };

function adjust(value: number | undefined, delta: number) {
  return typeof value === 'number' ? Math.max(0, value + delta) : value;
}

function isInfinite(value: unknown): value is { pages: unknown[]; pageParams?: unknown[] } {
  return !!value && typeof value === 'object' && 'pages' in value && Array.isArray(value.pages);
}

/** Atualiza perfil, listas montadas e o feed Seguindo. Não invalida o restante do aplicativo. */
export function patchFollowCaches(input: { targetId: string; viewerId: string; previous: FollowFlags; next: FollowFlags }) {
  const delta = Number(input.next.following) - Number(input.previous.following);
  if (delta !== 0) {
    queryClient.setQueriesData({ queryKey: ['profile'] }, (current) => {
      if (!current || typeof current !== 'object') return current;
      const profile = current as ProfileLike;
      const id = profile.user?.id;
      if (id !== input.targetId && id !== input.viewerId) return current;
      return {
        ...profile,
        followerCount: id === input.targetId ? adjust(profile.followerCount, delta) : profile.followerCount,
        followingCount: id === input.viewerId ? adjust(profile.followingCount, delta) : profile.followingCount,
      };
    });
  }
  queryClient.setQueriesData({ queryKey: ['relations'] }, (current) => patchRelations(current, input.targetId, input.next));
  if (input.previous.following && !input.next.following) {
    queryClient.setQueriesData({ queryKey: ['feed', 'seguindo'] }, (current) => removeAuthor(current, input.targetId));
  } else if (!input.previous.following && input.next.following) {
    void queryClient.invalidateQueries({ queryKey: ['feed', 'seguindo'] });
  }
}

export function revalidateFollowSurfaces() {
  void queryClient.invalidateQueries({ queryKey: ['profile'] });
  void queryClient.invalidateQueries({ queryKey: ['relations'] });
  void queryClient.invalidateQueries({ queryKey: ['feed', 'seguindo'] });
}

function patchRelations(data: unknown, userId: string, flags: FollowFlags) {
  if (!isInfinite(data)) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page || typeof page !== 'object' || !('items' in page) || !Array.isArray(page.items)) return page;
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (!item || typeof item !== 'object' || !('id' in item) || item.id !== userId) return item;
      pageChanged = true;
      changed = true;
      return { ...item, viewerFollowing: flags.following, viewerRequested: flags.requested };
    });
    return pageChanged ? { ...page, items } : page;
  });
  return changed ? { ...data, pages } : data;
}

function removeAuthor(data: unknown, authorId: string) {
  if (!isInfinite(data)) return data;
  return {
    ...data,
    pages: data.pages.map((page) => {
      if (!page || typeof page !== 'object' || !('items' in page) || !Array.isArray(page.items)) return page;
      return { ...page, items: page.items.filter((item) => !item || typeof item !== 'object' || !('authorId' in item) || item.authorId !== authorId) };
    }),
  };
}
