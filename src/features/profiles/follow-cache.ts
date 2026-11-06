import type { QueryKey } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

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
      return root === 'profile'
        || root === 'relations'
        || (root === 'feed' && query.queryKey[1] === 'seguindo')
        || root === queryKeys.discovery.all[0]
        || root === queryKeys.discovery.searchAll[0];
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
    queryClient.setQueriesData({ queryKey: queryKeys.profile.all }, (current) => {
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
  queryClient.setQueriesData({ queryKey: queryKeys.profile.relationsAll }, (current) => patchRelations(current, input.targetId, input.next));
  queryClient.setQueriesData({ queryKey: queryKeys.discovery.all }, (current) => patchDiscoveryFollow(current, input.targetId, input.next));
  queryClient.setQueriesData({ queryKey: queryKeys.discovery.searchAll }, (current) => patchDiscoveryFollow(current, input.targetId, input.next));
  if (input.previous.following && !input.next.following) {
    queryClient.setQueriesData({ queryKey: queryKeys.feed.following }, (current) => removeAuthor(current, input.targetId));
  } else if (!input.previous.following && input.next.following) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.feed.following });
  }
}

export function revalidateFollowSurfaces() {
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile.relationsAll });
  void queryClient.invalidateQueries({ queryKey: queryKeys.feed.following });
  void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.searchAll });
}

type FollowableUser = { id?: string; viewerFollowing?: boolean; viewerRequested?: boolean };

function patchFollowableUser(value: unknown, userId: string, flags: FollowFlags): unknown {
  if (!value || typeof value !== 'object') return value;
  const user = value as FollowableUser;
  if (user.id !== userId) return value;
  if (user.viewerFollowing === flags.following && user.viewerRequested === flags.requested) return value;
  return { ...user, viewerFollowing: flags.following, viewerRequested: flags.requested };
}

function patchDiscoveryEntries(items: unknown[], userId: string, flags: FollowFlags): { items: unknown[]; changed: boolean } {
  let changed = false;
  const next = items.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const item = entry as { kind?: string; value?: unknown };
    if (item.kind !== 'people') return entry;
    const value = patchFollowableUser(item.value, userId, flags);
    if (value === item.value) return entry;
    changed = true;
    return { ...item, value };
  });
  return { items: changed ? next : items, changed };
}

/**
 * Descoberta guarda pessoas em `people` e a busca em itens `{ kind: 'people',
 * value }`, dentro de páginas infinitas. Atualizar as duas formas mantém o
 * botão correto quando a pessoa volta à tela antes do refetch de revalidação.
 */
function patchDiscoveryFollow(data: unknown, userId: string, flags: FollowFlags): unknown {
  if (!data || typeof data !== 'object') return data;
  const record = data as { people?: unknown[]; items?: unknown[]; pages?: unknown[] };
  let changed = false;
  let people = record.people;
  if (Array.isArray(people)) {
    let arrayChanged = false;
    people = people.map((person) => {
      const next = patchFollowableUser(person, userId, flags);
      if (next !== person) arrayChanged = true;
      return next;
    });
    if (arrayChanged) changed = true;
  }
  let items = record.items;
  if (Array.isArray(items)) {
    const result = patchDiscoveryEntries(items, userId, flags);
    items = result.items;
    if (result.changed) changed = true;
  }
  let pages = record.pages;
  if (Array.isArray(pages)) {
    let pagesChanged = false;
    pages = pages.map((page) => {
      if (!page || typeof page !== 'object') return page;
      const current = page as { items?: unknown[] };
      if (!Array.isArray(current.items)) return page;
      const result = patchDiscoveryEntries(current.items, userId, flags);
      if (!result.changed) return page;
      pagesChanged = true;
      return { ...current, items: result.items };
    });
    if (pagesChanged) changed = true;
  }
  if (!changed) return data;
  return {
    ...record,
    ...(people !== record.people ? { people } : {}),
    ...(items !== record.items ? { items } : {}),
    ...(pages !== record.pages ? { pages } : {}),
  };
}

function patchRelations(data: unknown, userId: string, flags: FollowFlags) {  if (!isInfinite(data)) return data;
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
