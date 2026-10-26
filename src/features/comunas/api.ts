/**
 * Acesso a dados das comunas. Mesma regra do feed: as telas não leem os mocks.
 *
 * Com a API configurada, lista, detalhe, publicações, entrar e sair são reais. No modo
 * demonstração (sem EXPO_PUBLIC_API_URL), tudo continua vindo dos mocks.
 * No app, `Comuna.id` é o slug (endereço da rota); o UUID da API fica em `serverId`.
 */
import { DEMO_MODE } from '@/constants/config';
import { findComuna, findUsers, toFeedItems } from '@/features/lookup';
import { toFeedItem } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import { MAX_PAGE_LIMIT, type ComunaDto, type MembershipDto, type PageDto, type PostDto } from '@/lib/api/dto';
import { ApiError, NotFoundError } from '@/lib/errors';
import { formatPeople, initialsOf } from '@/lib/format';
import { mockDelay } from '@/lib/mock-delay';
import { singlePage, type Page } from '@/lib/pagination';
import { comunas } from '@/mocks/comunas';
import { posts } from '@/mocks/posts';
import { currentUser } from '@/mocks/users';
import type { Comuna, ComunaDetails, ComunaMember, FeedItem, Tone, TopicId } from '@/types/models';

/**
 * Para listar as comunas de que a pessoa participa (destino de publicação), a API ainda não
 * tem um endpoint próprio: percorremos as páginas de /comunas até este limite.
 */
const MY_COMUNAS_MAX_PAGES = 5;

const TONES: Tone[] = ['red', 'black', 'cream'];

function slugPath(slug: string): string {
  return `/comunas/${encodeURIComponent(slug)}`;
}

export function toComuna(dto: ComunaDto): Comuna {
  return {
    id: dto.slug,
    serverId: dto.id,
    visibility: dto.visibility,
    viewerIsMember: dto.viewer.isMember,
    name: dto.name,
    handle: dto.slug,
    initials: initialsOf(dto.name),
    tone: TONES.includes(dto.tone as Tone) ? (dto.tone as Tone) : 'red',
    place: dto.place,
    foundedYear: String(dto.foundedYear),
    description: dto.description,
    memberCount: dto.memberCount,
    coverAlt: `capa de ${dto.name}`,
    // Os assuntos são os mesmos IDs de GET /topics.
    topics: dto.topics as TopicId[],
    stats: [{ value: formatPeople(dto.memberCount), label: 'Membros' }],
    rules: dto.rules.map((r) => ({ title: r.title, description: r.body })),
    moderationNote: dto.moderationNote,
    pinned: null,
    // A API ainda não lista moderação nem membros.
    moderatorIds: [],
    founderRole: '',
    featuredMemberIds: [],
  };
}

function toComunaDetails(dto: ComunaDto): ComunaDetails {
  return {
    ...toComuna(dto),
    viewerIsMember: dto.viewer.isMember,
    viewerRole: dto.viewer.role,
    moderators: [],
    featuredMembers: [],
    members: [],
  };
}

function rethrowNotFound(what: string) {
  return (error: unknown): never => {
    if (error instanceof ApiError && error.status === 404) throw new NotFoundError(what);
    throw error;
  };
}

/** `id` é o slug da comuna. */
export async function getComuna(id: string): Promise<ComunaDetails> {
  if (!DEMO_MODE) {
    return apiRequest<ComunaDto>(slugPath(id), { auth: true }).then(toComunaDetails, rethrowNotFound('Comuna'));
  }

  const comuna = findComuna(id);
  if (!comuna) throw new NotFoundError('Comuna');

  const moderators = findUsers(comuna.moderatorIds);
  const featuredMembers = findUsers(comuna.featuredMemberIds);
  const members: ComunaMember[] = [
    ...moderators.map((u, i) => ({ ...u, role: i === 0 ? comuna.founderRole : 'Moderação' })),
    ...featuredMembers
      .filter((u) => !comuna.moderatorIds.includes(u.id))
      .map((u) => ({ ...u, role: 'Membro' })),
  ];

  const viewerIsMember = currentUser.joinedComunaIds.includes(comuna.id);
  return mockDelay({ ...comuna, viewerIsMember, moderators, featuredMembers, members });
}

/**
 * Publicações da comuna, da mais nova para a mais antiga. Comuna privada sem participação:
 * a API responde 403 /errors/comuna-private (a tela explica em vez de mostrar erro genérico).
 */
export async function getComunaPosts(id: string, cursor: string | null): Promise<Page<FeedItem>> {
  if (!DEMO_MODE) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const page = await apiRequest<PageDto<PostDto>>(`${slugPath(id)}/posts${query}`, { auth: true }).catch(
      rethrowNotFound('Comuna'),
    );
    return { items: page.items.map(toFeedItem), nextCursor: page.nextCursor };
  }

  const list = posts
    .filter((p) => p.comunaId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mockDelay(singlePage(toFeedItems(list)));
}

function getComunaPage(cursor: string | null): Promise<PageDto<ComunaDto>> {
  const query = `?limit=${MAX_PAGE_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return apiRequest<PageDto<ComunaDto>>(`/comunas${query}`, { auth: true });
}

/**
 * Comunas para listas (Explorar, recomendações, perfil). Na API, a primeira página (até 50):
 * as comunas são criadas pela equipe no MVP, então isso cobre a lista inteira por ora.
 */
export async function getComunas(): Promise<Comuna[]> {
  if (!DEMO_MODE) return (await getComunaPage(null)).items.map(toComuna);
  return mockDelay([...comunas]);
}

/** Comunas de que a pessoa participa, segundo o servidor (destino de publicação). */
export async function getMyComunas(): Promise<Comuna[]> {
  if (DEMO_MODE) return mockDelay(comunas.filter((c) => currentUser.joinedComunaIds.includes(c.id)));

  const mine: Comuna[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < MY_COMUNAS_MAX_PAGES; i++) {
    const page: PageDto<ComunaDto> = await getComunaPage(cursor);
    mine.push(...page.items.filter((c) => c.viewer.isMember).map(toComuna));
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return mine;
}

/**
 * Entra na comuna (PUT, idempotente). Comuna privada: 403 /errors/comuna-requires-approval.
 * Só na API; no modo demonstração a participação é local (ver `use-membership.ts`).
 */
export function joinComuna(id: string): Promise<MembershipDto> {
  return apiRequest<MembershipDto>(`${slugPath(id)}/membership`, { method: 'PUT', auth: true });
}

/** Sai da comuna (DELETE, idempotente). Quem fundou não sai por aqui: 409 /errors/founder-cannot-leave. */
export async function leaveComuna(id: string): Promise<void> {
  await apiRequest(`${slugPath(id)}/membership`, { method: 'DELETE', auth: true });
}
