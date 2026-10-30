import type { QueryKey } from '@tanstack/react-query';

import { acknowledgeGamification } from '@/features/gamification/feedback';
import { setPostSaved } from '@/features/posts/api';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

/** Listas que guardam a publicação inteira. A comuna e a busca usam o mesmo sinal em memória. */
const POST_ROOTS = new Set(['feed', 'profile-posts', 'post', 'post-preview']);

export const SAVED_POSTS_QUERY_KEY = ['saved-posts'] as const;

type Snapshot = { queryKey: QueryKey; data: unknown };

const overrides = new Map<string, boolean>();
const known = new Map<string, FeedItem>();
const locks = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeSavedStore(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function savedStoreVersion() {
  return version;
}

/** O toque desta sessão vale mais do que um cartão que ainda não recarregou. */
export function readSaved(postId: string, serverSaved?: boolean) {
  return overrides.has(postId) ? overrides.get(postId)! : !!serverSaved;
}

export function knownPost(postId: string) {
  return known.get(postId);
}

/** Guarda o cartão para a Biblioteca e para o menu, sem redesenhar a tela. */
export function rememberPost(post: FeedItem) {
  known.set(post.id, post);
}

export function resetSavedSession() {
  overrides.clear();
  known.clear();
  locks.clear();
  emit();
}

function lock(postId: string) {
  if (locks.has(postId)) return false;
  locks.add(postId);
  emit();
  return true;
}

function unlock(postId: string) {
  if (!locks.delete(postId)) return;
  emit();
}

function isFeedItem(value: unknown): value is FeedItem {
  return !!value && typeof value === 'object' && 'id' in value && 'text' in value && 'author' in value;
}

function isPage(value: unknown): value is { items: FeedItem[]; nextCursor: string | null } {
  return !!value && typeof value === 'object' && 'items' in value && Array.isArray((value as { items: unknown }).items);
}

function isInfinite(value: unknown): value is { pages: unknown[]; pageParams: unknown[] } {
  return !!value && typeof value === 'object' && 'pages' in value && Array.isArray((value as { pages: unknown }).pages);
}

function containsPost(data: unknown, postId: string): boolean {
  if (isFeedItem(data)) return data.id === postId;
  if (!isInfinite(data)) return false;
  return data.pages.some((page) => isPage(page) && page.items.some((item) => item?.id === postId));
}

function withSaved(post: FeedItem, saved: boolean): FeedItem {
  return { ...post, viewer: { isAuthor: false, canComment: true, canDelete: false, ...post.viewer, saved } };
}

function replaceSaved(data: unknown, postId: string, saved: boolean): unknown {
  if (isFeedItem(data)) {
    if (data.id !== postId || (data.viewer?.saved ?? false) === saved) return data;
    return withSaved(data, saved);
  }
  if (!isInfinite(data)) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!isPage(page)) return page;
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (!item || item.id !== postId || (item.viewer?.saved ?? false) === saved) return item;
      pageChanged = true;
      return withSaved(item, saved);
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}

function prependSaved(data: unknown, post: FeedItem): unknown {
  if (!isInfinite(data)) return data;
  const item = withSaved(post, true);
  let changed = false;
  const pages = data.pages.map((page, index) => {
    if (!isPage(page)) return page;
    const without = page.items.filter((entry) => entry?.id !== post.id);
    const items = index === 0 ? [item, ...without] : without;
    if (items.length === page.items.length && index === 0 && page.items[0]?.id === post.id && page.items[0]?.viewer?.saved) return page;
    changed = true;
    return { ...page, items };
  });
  if (!changed) return data;
  return { ...data, pages: pages.length > 0 ? pages : [{ items: [item], nextCursor: null }] };
}

function removeSaved(data: unknown, postId: string): unknown {
  if (!isInfinite(data)) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!isPage(page) || !page.items.some((item) => item?.id === postId)) return page;
    changed = true;
    return { ...page, items: page.items.filter((item) => item?.id !== postId) };
  });
  return changed ? { ...data, pages } : data;
}

function snapshot(postId: string): Snapshot[] {
  return queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const root = String(query.queryKey[0]);
      if (root === SAVED_POSTS_QUERY_KEY[0]) return true;
      return POST_ROOTS.has(root) && containsPost(query.state.data, postId);
    },
  }).map((query) => ({ queryKey: query.queryKey, data: query.state.data }));
}

function restore(snapshots: Snapshot[]) {
  for (const item of snapshots) queryClient.setQueryData(item.queryKey, item.data);
}

function apply(post: FeedItem, saved: boolean) {
  overrides.set(post.id, saved);
  const next = withSaved(post, saved);
  known.set(post.id, next);
  emit();
  queryClient.setQueriesData({ predicate: (query) => POST_ROOTS.has(String(query.queryKey[0])) }, (current) => replaceSaved(current, post.id, saved));
  queryClient.setQueriesData({ queryKey: SAVED_POSTS_QUERY_KEY }, (current) => saved ? prependSaved(current, next) : removeSaved(current, post.id));
}

/**
 * Um toque por publicação por vez. O segundo toque enquanto o primeiro viaja é ignorado,
 * para uma resposta antiga não desfazer o estado que a pessoa está vendo.
 */
export async function toggleSavedPost(post: FeedItem, notify: (message: string) => void, accountId?: string): Promise<boolean> {
  if (!lock(post.id)) return false;
  const previous = readSaved(post.id, post.viewer?.saved);
  const next = !previous;
  const snapshots = snapshot(post.id);
  apply(post, next);
  try {
    await setPostSaved(post.id, next);
    if (next) acknowledgeGamification(accountId, notify);
    return true;
  } catch {
    restore(snapshots);
    overrides.set(post.id, previous);
    known.set(post.id, withSaved(post, previous));
    emit();
    notify('Não conseguimos atualizar seus salvos. Tente novamente.');
    return false;
  } finally {
    unlock(post.id);
  }
}
