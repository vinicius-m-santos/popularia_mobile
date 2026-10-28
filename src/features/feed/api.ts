/**
 * Acesso a dados do feed.
 *
 * As telas dependem só destas funções, nunca dos mocks diretamente. Com a API configurada,
 * as abas "Para você" e "Minhas comunas" vêm de GET /feed (paginado por cursor). "Perto de mim"
 * e os chamados da semana ainda não existem na API.
 */
import { DEMO_MODE } from '@/constants/config';
import { findComuna, toFeedItems } from '@/features/lookup';
import { toFeedItem } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import type { PageDto, PostDto } from '@/lib/api/dto';
import { mockDelay } from '@/lib/mock-delay';
import { singlePage, type Page } from '@/lib/pagination';
import { events } from '@/mocks/events';
import { forYouPostIds, posts } from '@/mocks/posts';
import { currentUser } from '@/mocks/users';
import type { CommunityEvent, FeedItem, FeedTab } from '@/types/models';

/** Abas que a API sabe responder ("Perto de mim" ainda não existe no servidor). */
export function isFeedTabAvailable(tab: FeedTab): boolean {
  return DEMO_MODE || tab !== 'perto';
}

type FeedQuery = {
  tab: FeedTab;
  /** Comunas de que a pessoa participa (só nos mocks; na API, o servidor sabe). */
  joinedComunaIds: string[];
  cursor: string | null;
};

export async function getFeed({ tab, joinedComunaIds, cursor }: FeedQuery): Promise<Page<FeedItem>> {
  if (!DEMO_MODE) {
    if (!isFeedTabAvailable(tab)) return singlePage([]);
    const query = `?tab=${tab}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const page = await apiRequest<PageDto<PostDto>>(`/feed${query}`, { auth: true });
    return { items: page.items.map(toFeedItem), nextCursor: page.nextCursor };
  }

  const byDate = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  let list = byDate;
  if (tab === 'para-voce') {
    list = byDate.filter((p) => forYouPostIds.includes(p.id));
  } else if (tab === 'minhas') {
    list = byDate.filter((p) => p.comunaId !== null && joinedComunaIds.includes(p.comunaId));
  } else {
    // "Perto de mim" usa a cidade declarada no perfil, nunca a localização do aparelho.
    list = byDate.filter((p) => findComuna(p.comunaId)?.place === currentUser.city);
  }
  return mockDelay(singlePage(toFeedItems(list)));
}

/** Chamados (atos, mutirões, assembleias) dos próximos dias, em ordem de data. Sempre fictícios. */
export async function getWeekEvents(): Promise<CommunityEvent[]> {
  return mockDelay([...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
}

