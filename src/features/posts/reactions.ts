import { queryClient, setQueryDataIfChanged } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

import { createPostSubscription } from './post-subscriptions';

/**
 * Apoios e ecos persistidos na conta.
 *
 * O toque desta sessão vale mais do que uma lista que ainda não recarregou, então o valor
 * otimista fica num mapa pequeno e as telas leem daqui antes de confiar no cache. O servidor
 * confirma (ou desfaz) logo depois; o cache das listas também é corrigido para a próxima
 * navegação encontrar a contagem certa.
 *
 * A store e o cache são passos separados: `writeReaction` muda o que o cartão mostra e avisa
 * só aquele `postId`; `patchReactionCaches` é o trabalho de sincronizar as queries, e só
 * escreve nas que realmente contêm a publicação e cujo valor mudou.
 */

export type ReactionKind = 'support' | 'echo';
export type Reaction = { count: number; mine: boolean };
/** Reações desta sessão para uma publicação. O objeto só muda quando um valor muda. */
export type PostReactions = Partial<Record<ReactionKind, Reaction>>;

/** As mesmas raízes de lista usadas por `poll.ts` e `save.ts`, mais a lista de salvos. */
const POST_ROOTS = new Set(['feed', 'profile-posts', 'post', 'post-preview', 'saved-posts']);

const overrides = new Map<string, PostReactions>();
const locks = new Set<string>();
const subscriptions = createPostSubscription();

function emitReaction(postId: string) {
  subscriptions.notify(postId);
}

/** Assina só o cartão desta publicação; uma alteração em outro ID não o acorda. */
export function subscribePostReactions(postId: string, listener: () => void) {
  return subscriptions.subscribe(postId, listener);
}

/**
 * Snapshot referencialmente estável das reações desta sessão.
 * `undefined` significa "sem alteração local: use os valores do servidor".
 */
export function readReactionSnapshot(postId: string): PostReactions | undefined {
  return overrides.get(postId);
}

/** O que a tela mostra: a marca desta sessão, se houver; senão, o que o servidor mandou. */
export function readReaction(postId: string, kind: ReactionKind, server: Reaction): Reaction {
  return overrides.get(postId)?.[kind] ?? server;
}

function sameReaction(left: Reaction | undefined, right: Reaction): boolean {
  return !!left && left.count === right.count && left.mine === right.mine;
}

/**
 * Aplica o valor otimista/confirmado na store. Devolve `true` quando o snapshot mudou —
 * a confirmação do servidor que repete o valor otimista não notifica de novo.
 */
export function writeReaction(postId: string, kind: ReactionKind, value: Reaction): boolean {
  const current = overrides.get(postId);
  if (sameReaction(current?.[kind], value)) return false;
  overrides.set(postId, { ...current, [kind]: { count: value.count, mine: value.mine } });
  emitReaction(postId);
  return true;
}

/**
 * Desfaz só o que este toque escreveu, e só se ninguém mais já mudou a mesma reação.
 * Diferente de restaurar o snapshot inteiro da query, isto não desfaz um eco ou um
 * salvamento que aconteceu em paralelo no mesmo cartão.
 */
export function revertReaction(postId: string, kind: ReactionKind, optimistic: Reaction, previous: Reaction): boolean {
  if (!sameReaction(overrides.get(postId)?.[kind], optimistic)) return false;
  return writeReaction(postId, kind, previous);
}

export function resetReactionSession() {
  overrides.clear();
  locks.clear();
  subscriptions.notifyAll();
}

/**
 * Um toque por gesto: sem a trava, dois toques rápidos disparariam duas requisições e a
 * resposta que chegasse por último poderia desfazer a intenção mais recente. A trava não
 * tem estado visível, então não notifica o cartão.
 */
export function lockReaction(postId: string, kind: ReactionKind) {
  const key = `${postId}:${kind}`;
  if (locks.has(key)) return false;
  locks.add(key);
  return true;
}

export function unlockReaction(postId: string, kind: ReactionKind) {
  locks.delete(`${postId}:${kind}`);
}

export function isReactionLocked(postId: string, kind: ReactionKind) {
  return locks.has(`${postId}:${kind}`);
}

/**
 * Sincroniza as queries que contêm a publicação. Uma única varredura, restrita a essas
 * queries, e nenhuma escrita quando o cartão já mostra o valor pedido.
 *
 * `onlyIf` é usado no rollback: se um refetch já trouxe um valor mais novo, o erro desta
 * requisição antiga não o sobrescreve.
 */
export function patchReactionCaches(
  postId: string,
  kind: ReactionKind,
  value: Reaction,
  options?: { onlyIf?: Reaction },
): number {
  let changed = 0;
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => POST_ROOTS.has(String(query.queryKey[0])) && containsPost(query.state.data, postId),
  });
  for (const query of queries) {
    const current = query.state.data;
    const next = replace(current, postId, kind, value, options?.onlyIf);
    if (setQueryDataIfChanged(query.queryKey, current, next)) changed += 1;
  }
  return changed;
}

function containsPost(data: unknown, postId: string): boolean {
  if (isFeedItem(data)) return data.id === postId;
  if (isInfinite(data)) return data.pages.some((page) => isPage(page) && page.items.some((item) => item?.id === postId));
  if (isPage(data)) return data.items.some((item) => item?.id === postId);
  return false;
}

function reactionOf(item: FeedItem, kind: ReactionKind): Reaction {
  return kind === 'support'
    ? { count: item.supportCount, mine: !!item.viewer?.supported }
    : { count: item.echoCount, mine: !!item.viewer?.echoed };
}

function replace(data: unknown, postId: string, kind: ReactionKind, value: Reaction, onlyIf?: Reaction): unknown {
  if (isFeedItem(data)) {
    if (data.id !== postId) return data;
    return replaceItem(data, kind, value, onlyIf);
  }
  if (isInfinite(data)) {
    let changed = false;
    const pages = data.pages.map((page) => {
      if (!isPage(page)) return page;
      let pageChanged = false;
      const items = page.items.map((item) => {
        if (!item || item.id !== postId) return item;
        const next = replaceItem(item, kind, value, onlyIf);
        if (next !== item) pageChanged = true;
        return next;
      });
      if (!pageChanged) return page;
      changed = true;
      return { ...page, items };
    });
    return changed ? { ...data, pages } : data;
  }
  if (isPage(data)) {
    let changed = false;
    const items = data.items.map((item) => {
      if (!item || item.id !== postId) return item;
      const next = replaceItem(item, kind, value, onlyIf);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? { ...data, items } : data;
  }
  return data;
}

/** Devolve o mesmo item quando não há nada a mudar, para o cache preservar a referência. */
function replaceItem(item: FeedItem, kind: ReactionKind, value: Reaction, onlyIf?: Reaction): FeedItem {
  const current = reactionOf(item, kind);
  if (onlyIf && !sameReaction(current, onlyIf)) return item;
  if (sameReaction(current, value)) return item;
  return withReaction(item, kind, value);
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
