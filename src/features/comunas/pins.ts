import { useSyncExternalStore } from 'react';

import { moveComunaPin, pinComunaPost, unpinComunaPost } from '@/features/comunas/api';
import { rememberPost } from '@/features/posts/save';
import { ApiError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

/** Só a lista de fixados daquela comuna e a publicação aberta. O feed não entra. */
export function pinnedPostsKey(slug: string) {
  return ['comuna-pins', slug] as const;
}

type PinOverride = { slug: string; pinned: boolean };
type Snapshot = { queryKey: readonly unknown[]; data: unknown };

const overrides = new Map<string, PinOverride>();
const locks = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribePinStore(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function pinStoreVersion() {
  return version;
}

export function readPinned(postId: string, serverPinned?: boolean) {
  return overrides.has(postId) ? overrides.get(postId)!.pinned : !!serverPinned;
}

export function isPinLocked(postId: string) {
  const suffix = `:${postId}`;
  for (const key of locks) {
    if (key.endsWith(suffix)) return true;
  }
  return false;
}

export function useComunaPinPending(slug: string) {
  useSyncExternalStore(subscribePinStore, pinStoreVersion, pinStoreVersion);
  for (const key of locks) {
    if (key.startsWith(`${slug}:`)) return true;
  }
  return false;
}

export function resetPinSession() {
  overrides.clear();
  locks.clear();
  emit();
}

function lockKey(slug: string, postId: string) {
  return `${slug}:${postId}`;
}

function withPinned(post: FeedItem, pinned: boolean): FeedItem {
  return { ...post, viewer: { isAuthor: false, canComment: true, canDelete: false, ...post.viewer, pinned } };
}

function patchPost(postId: string, pinned: boolean) {
  for (const key of [['post', postId], ['post-preview', postId]] as const) {
    queryClient.setQueryData<FeedItem>(key, (current) => current && current.id === postId ? withPinned(current, pinned) : current);
  }
}

function rememberList(items: FeedItem[]) {
  for (const item of items) rememberPost(withPinned(item, true));
}

function applyList(slug: string, items: FeedItem[], previous: FeedItem[]) {
  queryClient.setQueryData(pinnedPostsKey(slug), items);
  const ids = new Set(items.map((item) => item.id));
  for (const item of previous) {
    if (!ids.has(item.id)) {
      overrides.set(item.id, { slug, pinned: false });
      patchPost(item.id, false);
    }
  }
  items.forEach((item) => {
    overrides.set(item.id, { slug, pinned: true });
    patchPost(item.id, true);
  });
  rememberList(items);
  emit();
}

function snapshot(slug: string, postId: string): Snapshot[] {
  return [pinnedPostsKey(slug), ['post', postId], ['post-preview', postId]].map((queryKey) => ({
    queryKey,
    data: queryClient.getQueryData(queryKey),
  }));
}

function restore(snapshots: Snapshot[]) {
  for (const item of snapshots) queryClient.setQueryData(item.queryKey, item.data);
}

function currentList(slug: string): FeedItem[] {
  return queryClient.getQueryData<FeedItem[]>(pinnedPostsKey(slug)) ?? [];
}

function failureMessage(error: unknown) {
  if (error instanceof ApiError && error.type === '/errors/comuna-pin-limit') return error.title;
  return 'Não conseguimos atualizar as publicações fixadas. Tente novamente.';
}

async function runPinChange(slug: string, post: FeedItem, optimistic: FeedItem[], request: () => Promise<FeedItem[] | void>, notify: (message: string) => void) {
  const key = lockKey(slug, post.id);
  if (locks.has(key)) return false;
  locks.add(key);
  emit();
  const previous = currentList(slug);
  const snapshots = snapshot(slug, post.id);
  applyList(slug, optimistic, previous);
  try {
    const confirmed = await request();
    if (confirmed) applyList(slug, confirmed, optimistic);
    return true;
  } catch (error) {
    restore(snapshots);
    applyList(slug, previous, optimistic);
    notify(failureMessage(error));
    return false;
  } finally {
    locks.delete(key);
    emit();
  }
}

/** Pin novo entra primeiro. No limite local, não mostra um quarto item antes da recusa do servidor. */
export function pinPost(post: FeedItem, notify: (message: string) => void) {
  const slug = post.comunaId;
  if (!slug) return Promise.resolve(false);
  const previous = currentList(slug);
  const without = previous.filter((item) => item.id !== post.id);
  const atLimit = without.length >= 3;
  const optimistic = atLimit ? previous : [withPinned(post, true), ...without.map((item) => withPinned(item, true))];
  return runPinChange(slug, post, optimistic, () => pinComunaPost(slug, post.id), notify);
}

export function unpinPost(post: FeedItem, notify: (message: string) => void) {
  const slug = post.comunaId;
  if (!slug) return Promise.resolve(false);
  const optimistic = currentList(slug).filter((item) => item.id !== post.id);
  return runPinChange(slug, post, optimistic, async () => { await unpinComunaPost(slug, post.id); }, notify);
}

export function movePinnedPost(slug: string, postId: string, position: number, notify: (message: string) => void) {
  const previous = currentList(slug);
  const post = previous.find((item) => item.id === postId);
  if (!post) return Promise.resolve(false);
  const rest = previous.filter((item) => item.id !== postId);
  const target = Math.max(1, Math.min(position, previous.length));
  rest.splice(target - 1, 0, post);
  return runPinChange(slug, post, rest, () => moveComunaPin(slug, postId, position), notify);
}
