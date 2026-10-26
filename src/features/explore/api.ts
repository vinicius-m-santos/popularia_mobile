/** Dados da tela Explorar: destaques e o índice usado pela busca. */
import { USE_MOCKS } from '@/constants/config';
import { getComunas } from '@/features/comunas/api';
import { toFeedItems } from '@/features/lookup';
import { getFeaturedPeople, getSearchablePeople } from '@/features/profiles/api';
import { mockDelay } from '@/lib/mock-delay';
import { posts } from '@/mocks/posts';
import { topicGroups, trends } from '@/mocks/topics';
import type { Comuna, FeedItem, Profile, Topic, Trend } from '@/types/models';

export type ExploreData = {
  trends: Trend[];
  comunas: Comuna[];
  featuredPeople: Profile[];
  /** Índice da busca. Com a API, a busca passa a ser feita no servidor. */
  people: Profile[];
  posts: FeedItem[];
  topics: Topic[];
};

export async function getExploreData(ownUserId: string): Promise<ExploreData> {
  if (!USE_MOCKS) throw new Error('A integração com a API ainda não foi implementada.');
  const [comunas, featuredPeople, people, items] = await Promise.all([
    getComunas(),
    getFeaturedPeople(),
    getSearchablePeople(ownUserId),
    mockDelay(toFeedItems(posts)),
  ]);
  return {
    trends,
    comunas,
    featuredPeople,
    people,
    posts: items,
    topics: topicGroups.flatMap((g) => g.topics),
  };
}
