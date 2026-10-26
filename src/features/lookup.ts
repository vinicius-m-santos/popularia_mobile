/**
 * Resolução de relações entre mocks, compartilhada pelas features.
 * Some quando a API existir: o backend devolverá as entidades já relacionadas.
 */
import { comunas } from '@/mocks/comunas';
import { events } from '@/mocks/events';
import { users } from '@/mocks/users';
import type { FeedItem, Post, User } from '@/types/models';

export function findUser(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}

export function findUsers(ids: string[]): User[] {
  return ids.map(findUser).filter((u): u is User => u !== null);
}

export function findComuna(id: string | null) {
  return comunas.find((c) => c.id === id) ?? null;
}

/** Resolve as relações de um post. Posts com autor desconhecido são descartados. */
export function toFeedItem(post: Post): FeedItem | null {
  const author = findUser(post.authorId);
  if (!author) return null;
  return {
    ...post,
    author,
    comuna: findComuna(post.comunaId),
    event: events.find((e) => e.id === post.eventId) ?? null,
    topCommentAuthor: post.topComment ? findUser(post.topComment.authorId) : null,
  };
}

export function toFeedItems(list: Post[]): FeedItem[] {
  return list.map(toFeedItem).filter((item): item is FeedItem => item !== null);
}
