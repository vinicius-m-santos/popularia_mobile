import type { QueryKey } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

/**
 * Apoios e ecos persistidos na conta.
 *
 * O toque desta sessão vale mais do que uma lista que ainda não recarregou, então o valor
 * otimista fica num mapa pequeno e as telas leem daqui antes de confiar no cache. O servidor
 * confirma (ou desfaz) logo depois; o cache das listas também é corrigido para a próxima
 * navegação encontrar a contagem certa.
 */

export type ReactionKind = 'support' | 'echo';
export type Reaction = { count: number; mine: boolean };

/** As mesmas raízes de lista usadas por `poll.ts` e `save.ts`, mais a lista de salvos. */
const POST_ROOTS = new Set(['feed', 'profile-posts', 'post', 'post-preview', 'saved-posts']);

type Snapshot = { queryKey: QueryKey; data: unknown };

const overrides = new Map<string, Partial<Record<ReactionKind, Reaction>>>();
const locks = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeReactions(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function reactionsVersion() {
  return version;
}

/** O que a tela mostra: a marca desta sessão, se houver; senão, o que o servidor mandou. */
export function readReaction(postId: string, kind: ReactionKind, server: Reaction): Reaction {
  return overrides.get(postId)?.[kind] ?? server;
}

export function writeReaction(postId: string, kind: ReactionKind, value: Reaction) {
  overrides.set(postId, { ...overrides.get(postId), [kind]: value });
  emit();
}

export function resetReactionSession() {
  overrides.clear();
  locks.clear();
  emit();
}

/** Um toque por gesto: sem a trava, dois toques rápidos contariam duas vezes. */
export function lockReaction(postId: string, kind: ReactionKind) {
  const key = `${postId}:${kind}`;
  if (locks.has(key)) return false;
  locks.add(key);
  emit();
  return true;
}

export function unlockReaction(postId: string, kind: ReactionKind) {
  locks.delete(`${postId}:${kind}`);
  emit();
}

export function isReactionLocked(postId: string, kind: ReactionKind) {
  return locks.has(`${postId}:${kind}`);
}

export function snapshotReactionCaches(postId: string): Snapshot[] {
  return queryClient.getQueryCache().findAll({ predicate: (query) => POST_ROOTS.has(String(query.queryKey[0])) && containsPost(query.state.data, postId) })
    .map((query) => ({ queryKey: query.queryKey, data: query.state.data }));
}

export function restoreReactionCaches(snapshots: Snapshot[]) {
  for (const snapshot of snapshots) queryClient.setQueryData(snapshot.queryKey, snapshot.data);
}

export function patchReactionCaches(postId: string, kind: ReactionKind, value: Reaction) {
  queryClient.setQueriesData({ predicate: (query) => POST_ROOTS.has(String(query.queryKey[0])) }, (current) => replace(current, postId, kind, value));
}

function containsPost(data: unknown, postId: string): boolean {
  if (isFeedItem(data)) return data.id === postId;
  if (isInfinite(data)) return data.pages.some((page) => isPage(page) && page.items.some((item) => item?.id === postId));
  if (isPage(data)) return data.items.some((item) => item?.id === postId);
  return false;
}

function replace(data: unknown, postId: string, kind: ReactionKind, value: Reaction): unknown {
  if (isFeedItem(data)) return data.id === postId ? withReaction(data, kind, value) : data;
  if (isInfinite(data)) return { ...data, pages: data.pages.map((page) => isPage(page) ? { ...page, items: page.items.map((item) => item?.id === postId ? withReaction(item, kind, value) : item) } : page) };
  if (isPage(data)) return { ...data, items: data.items.map((item) => item?.id === postId ? withReaction(item, kind, value) : item) };
  return data;
}

function withReaction(item: FeedItem, kind: ReactionKind, value: Reaction): FeedItem {
  const base = item.viewer ?? { isAuthor: false, canComment: false, canDelete: false };
  const viewer = { ...base, ...(kind === 'support' ? { supported: value.mine } : { echoed: value.mine }) };
  return kind === 'support'
    ? { ...item, supportCount: value.count, viewer }
    : { ...item, echoCount: value.count, viewer };
}

function isFeedItem(value: unknown): value is FeedItem {
  return !!value && typeof value === 'object' && 'id' in value && 'text' in value && 'author' in value;
}

function isPage(value: unknown): value is { items: (FeedItem | null)[]; nextCursor: string | null } {
  return !!value && typeof value === 'object' && 'items' in value && Array.isArray((value as { items: unknown }).items);
}

function isInfinite(value: unknown): value is { pages: unknown[]; pageParams: unknown[] } {
  return !!value && typeof value === 'object' && 'pages' in value && Array.isArray((value as { pages: unknown }).pages);
}
