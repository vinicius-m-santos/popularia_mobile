import { acknowledgeGamification } from '@/features/gamification/feedback';
import { setPostSaved } from '@/features/posts/api';
import { queryClient, setQueryDataIfChanged } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

import { createPostSubscription } from './post-subscriptions';

/** Listas que guardam a publicação inteira. A comuna e a busca usam o mesmo sinal em memória. */
const POST_ROOTS = new Set(['feed', 'profile-posts', 'post', 'post-preview']);

export const SAVED_POSTS_QUERY_KEY = ['saved-posts'] as const;

const overrides = new Map<string, boolean>();
const known = new Map<string, FeedItem>();
const locks = new Set<string>();
const subscriptions = createPostSubscription();

function emitSaved(postId: string) {
  subscriptions.notify(postId);
}

/** Assina só o cartão desta publicação; uma alteração em outro ID não o acorda. */
export function subscribeSavedPost(postId: string, listener: () => void) {
  return subscriptions.subscribe(postId, listener);
}

/**
 * Snapshot referencialmente estável do salvamento desta sessão.
 * `undefined` significa "sem alteração local: use o valor do servidor".
 */
export function readSavedSnapshot(postId: string): boolean | undefined {
  return overrides.get(postId);
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
  subscriptions.notifyAll();
}

/**
 * Um toque por publicação por vez. O segundo toque enquanto o primeiro viaja é ignorado,
 * para uma resposta antiga não desfazer o estado que a pessoa está vendo. A trava não tem
 * estado visível, então não notifica o cartão.
 */
function lock(postId: string) {
  if (locks.has(postId)) return false;
  locks.add(postId);
  return true;
}

function unlock(postId: string) {
  locks.delete(postId);
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

/**
 * Atualiza o item nas listas e no detalhe. `onlyIf` limita o rollback: se o cartão já
 * mostra um valor diferente do otimista (um refetch mais novo), ele não é sobrescrito.
 */
function replaceSaved(data: unknown, postId: string, saved: boolean, onlyIf?: boolean): unknown {
  if (isFeedItem(data)) {
    if (data.id !== postId) return data;
    const current = data.viewer?.saved ?? false;
    if (current === saved) return data;
    if (onlyIf !== undefined && current !== onlyIf) return data;
    return withSaved(data, saved);
  }
  if (!isInfinite(data)) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!isPage(page)) return page;
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (!item || item.id !== postId) return item;
      const current = item.viewer?.saved ?? false;
      if (current === saved) return item;
      if (onlyIf !== undefined && current !== onlyIf) return item;
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
  let changed = data.pages.length === 0;
  const pages = data.pages.map((page, index) => {
    if (!isPage(page)) return page;
    const without = page.items.filter((entry) => entry?.id !== post.id);
    if (index > 0) {
      // O item novo só entra na primeira página; as demais mantêm a referência.
      if (without.length === page.items.length) return page;
      changed = true;
      return { ...page, items: without };
    }
    if (page.items[0]?.id === post.id && page.items[0]?.viewer?.saved && without.length === page.items.length - 1) return page;
    changed = true;
    return { ...page, items: [item, ...without] };
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

/** Reinsere na lista de salvos sem mexer no que outras publicações fizeram no meio. */
function restoreSaved(data: unknown, post: FeedItem, previous: boolean): unknown {
  if (!isInfinite(data)) return data;
  if (!previous) return removeSaved(data, post.id);
  const present = data.pages.some((page) => isPage(page) && page.items.some((item) => item?.id === post.id));
  return present ? data : prependSaved(data, post);
}

/** Queries de publicação que contêm este ID, mais a lista de salvos (que contém todas). */
function savedQueriesFor(postId: string) {
  return queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const root = String(query.queryKey[0]);
      if (root === SAVED_POSTS_QUERY_KEY[0]) return true;
      return POST_ROOTS.has(root) && containsPost(query.state.data, postId);
    },
  });
}

/**
 * Trabalho de cache separado do feedback imediato: uma varredura, só nas queries afetadas,
 * e nenhuma escrita quando a referência não muda.
 */
function syncSavedCaches(post: FeedItem, saved: boolean) {
  for (const query of savedQueriesFor(post.id)) {
    const current = query.state.data;
    const next = query.queryKey[0] === SAVED_POSTS_QUERY_KEY[0]
      ? (saved ? prependSaved(current, post) : removeSaved(current, post.id))
      : replaceSaved(current, post.id, saved);
    setQueryDataIfChanged(query.queryKey, current, next);
  }
}

function apply(post: FeedItem, saved: boolean) {
  const next = withSaved(post, saved);
  overrides.set(post.id, saved);
  known.set(post.id, next);
  // Feedback imediato: a store notifica só o cartão deste post.
  emitSaved(post.id);
  // Sincronização das listas: passo separado, restrito ao que contém este post.
  syncSavedCaches(next, saved);
}

/**
 * Rollback do toque, não da query inteira: desfaz só este post nas listas. Assim um
 * salvamento bem-sucedido de outra publicação no mesmo feed não é perdido quando esta
 * requisição falha. Se a store já aponta para outro valor, ninguém mais a sobrescreve.
 */
function rollbackSaved(post: FeedItem, optimistic: boolean, previous: boolean) {
  if (readSavedSnapshot(post.id) !== optimistic) return;
  overrides.set(post.id, previous);
  known.set(post.id, withSaved(post, previous));
  emitSaved(post.id);
  for (const query of savedQueriesFor(post.id)) {
    const current = query.state.data;
    const next = query.queryKey[0] === SAVED_POSTS_QUERY_KEY[0]
      ? restoreSaved(current, post, previous)
      : replaceSaved(current, post.id, previous, optimistic);
    setQueryDataIfChanged(query.queryKey, current, next);
  }
}

export async function toggleSavedPost(post: FeedItem, notify: (message: string) => void, accountId?: string): Promise<boolean> {
  if (!lock(post.id)) return false;
  const previous = readSaved(post.id, post.viewer?.saved);
  const next = !previous;
  apply(post, next);
  try {
    await setPostSaved(post.id, next);
    if (next) acknowledgeGamification(accountId, notify);
    return true;
  } catch {
    rollbackSaved(post, next, previous);
    notify('Não conseguimos atualizar seus salvos. Tente novamente.');
    return false;
  } finally {
    unlock(post.id);
  }
}
