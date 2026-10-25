/**
 * Acesso a dados do feed.
 *
 * As telas dependem só destas funções, nunca dos mocks diretamente. Quando a API
 * Symfony/API Platform existir, a implementação troca para `fetch(API_BASE_URL + '/posts')`
 * com um mapeador JSON-LD → `FeedItem`, sem alterar as telas.
 */
import { USE_MOCKS } from '@/constants/config';
import { mockDelay } from '@/lib/mock-delay';
import { comunas } from '@/mocks/comunas';
import { events } from '@/mocks/events';
import { posts } from '@/mocks/posts';
import { users } from '@/mocks/users';
import type { FeedItem, Post, User } from '@/types/models';

function findUser(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}

/** Resolve as relações de um post. Posts com autor desconhecido são descartados. */
function toFeedItem(post: Post): FeedItem | null {
  const author = findUser(post.authorId);
  if (!author) return null;
  return {
    ...post,
    author,
    comuna: comunas.find((c) => c.id === post.comunaId) ?? null,
    event: events.find((e) => e.id === post.eventId) ?? null,
    topCommentAuthor: post.topComment ? findUser(post.topComment.authorId) : null,
  };
}

export async function getFeed(): Promise<FeedItem[]> {
  if (!USE_MOCKS) {
    throw new Error('A integração com a API ainda não foi implementada.');
  }
  const items = posts.map(toFeedItem).filter((item): item is FeedItem => item !== null);
  return mockDelay(items);
}
