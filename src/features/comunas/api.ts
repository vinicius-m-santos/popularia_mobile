/**
 * Acesso a dados das comunas. Mesma regra do feed: as telas não leem os mocks.
 *
 * Com a API configurada, lista, detalhe, publicações, entrar e sair são reais, assim como
 * criar e gerir comunas. No modo demonstração (sem EXPO_PUBLIC_API_URL), leitura e
 * participação continuam vindo dos mocks; criar e gerir existem só com a API (as telas avisam).
 * No app, `Comuna.id` é o slug (endereço da rota); o UUID da API fica em `serverId`.
 *
 * Papel, permissões e proprietário vêm sempre do servidor: o app nunca compara IDs locais
 * (como o "me" dos mocks) para decidir o que a pessoa pode fazer.
 */
import { DEMO_MODE } from '@/constants/config';
import { findComuna, findUsers, toFeedItems } from '@/features/lookup';
import { absoluteMediaUrl } from '@/features/media/media-url';
import { toFeedItem, toUser } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import {
  MAX_PAGE_LIMIT,
  type ComunaDto,
  type ComunaMemberDto,
  type ComunaNameAvailabilityDto,
  type ComunaQuotaDto,
  type JoinRequestDto,
  type MembershipDto,
  type OwnershipTransferDto,
  type PageDto,
  type PostDto,
} from '@/lib/api/dto';
import { ApiError, NotFoundError } from '@/lib/errors';
import { formatPeople, initialsOf } from '@/lib/format';
import { mockDelay } from '@/lib/mock-delay';
import { singlePage, type Page } from '@/lib/pagination';
import { comunas } from '@/mocks/comunas';
import { posts } from '@/mocks/posts';
import { currentUser } from '@/mocks/users';
import type { Comuna, ComunaDetails, ComunaMember, ComunaPerson, FeedItem, Tone, TopicId, User } from '@/types/models';

/** Comunas de que a pessoa participa (GET /me/comunas): páginas lidas no máximo. */
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
    status: dto.status,
    viewerIsMember: dto.viewer.isMember,
    viewerRole: dto.viewer.role,
    name: dto.name,
    handle: dto.slug,
    initials: initialsOf(dto.name),
    tone: TONES.includes(dto.tone as Tone) ? (dto.tone as Tone) : 'red',
    place: dto.place,
    foundedYear: String(dto.foundedYear),
    description: dto.description,
    memberCount: dto.memberCount,
    coverAlt: `capa de ${dto.name}`,
    coverUrl: absoluteMediaUrl(dto.coverUrl),
    markUrl: absoluteMediaUrl(dto.markUrl),
    // Os assuntos são os mesmos IDs de GET /topics.
    topics: dto.topics as TopicId[],
    primaryTopic: dto.primaryTopic ? { ...dto.primaryTopic, id: dto.primaryTopic.id as TopicId } : null,
    stats: [{ value: formatPeople(dto.memberCount), label: 'Membros' }],
    rules: dto.rules.map((r) => ({ title: r.title, description: r.body })),
    moderationNote: dto.moderationNote,
    pinned: null,
    // Na API, moderação e membros vêm no detalhe (e na lista própria de membros), não aqui.
    moderatorIds: [],
    founderRole: '',
    featuredMemberIds: [],
  };
}

export function toComunaPerson(dto: ComunaMemberDto): ComunaPerson {
  return { ...toUser({ id: dto.id, handle: dto.handle, displayName: dto.displayName, avatarUrl: dto.avatarUrl }), role: dto.role, joinedAt: dto.joinedAt };
}

/** Rótulo do papel para a interface. */
export function roleLabel(role: ComunaPerson['role']): string {
  return role === 'founder' ? 'Proprietário' : role === 'moderator' ? 'Moderação' : 'Membro';
}

export function toComunaDetails(dto: ComunaDto): ComunaDetails {
  const moderation = (dto.moderation ?? []).map(toComunaPerson);
  const transfer = dto.viewer.ownershipTransfer;
  return {
    ...toComuna(dto),
    viewerIsMember: dto.viewer.isMember,
    viewerRole: dto.viewer.role,
    viewerPermissions: dto.viewer.permissions,
    viewerJoinRequest: dto.viewer.joinRequest,
    ownershipTransfer: transfer
      ? { direction: transfer.direction, from: toUser(transfer.from), to: toUser(transfer.to), createdAt: transfer.createdAt }
      : null,
    owner: dto.owner ? toUser(dto.owner) : null,
    archivedAt: dto.archivedAt,
    moderators: moderation,
    featuredMembers: [],
    // A lista completa é só para quem participa: vem de getComunaMembers().
    members: moderation.map((m) => ({ ...m, role: roleLabel(m.role) })),
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

/** Publicações fixadas da comuna, no máximo 3, na ordem da moderação. Mesma publicação do feed. */
export async function getPinnedPosts(id: string): Promise<FeedItem[]> {
  const page = await apiRequest<PageDto<PostDto>>(`${slugPath(id)}/pinned-posts`, { auth: true });
  return page.items.map(toFeedItem);
}

/** Fixa. A resposta é a lista atual. Já fixada: a posição não muda. */
export async function pinComunaPost(id: string, postId: string): Promise<FeedItem[]> {
  const page = await apiRequest<PageDto<PostDto>>(`${slugPath(id)}/pinned-posts/${encodeURIComponent(postId)}`, { method: 'PUT', auth: true });
  return page.items.map(toFeedItem);
}

/** Desafixa. Idempotente, sem corpo. */
export async function unpinComunaPost(id: string, postId: string): Promise<void> {
  await apiRequest(`${slugPath(id)}/pinned-posts/${encodeURIComponent(postId)}`, { method: 'DELETE', auth: true });
}

/** Move um pin já existente. 1 é o primeiro. */
export async function moveComunaPin(id: string, postId: string, position: number): Promise<FeedItem[]> {
  const page = await apiRequest<PageDto<PostDto>>(`${slugPath(id)}/pinned-posts/${encodeURIComponent(postId)}/position`, {
    method: 'PUT',
    body: { position },
    auth: true,
  });
  return page.items.map(toFeedItem);
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

/** Comunas para listas (Explorar, recomendações). Na API, a primeira página (até 50). */
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
    const query = `?limit=${MAX_PAGE_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const page: PageDto<ComunaDto> = await apiRequest<PageDto<ComunaDto>>(`/me/comunas${query}`, { auth: true });
    mine.push(...page.items.map(toComuna));
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return mine;
}

/**
 * Entra na comuna (PUT, idempotente). Comuna privada: 403 /errors/comuna-requires-approval
 * (use requestToJoin). Arquivada: 409 /errors/comuna-archived.
 * Só na API; no modo demonstração a participação é local (ver `use-membership.ts`).
 */
export function joinComuna(id: string): Promise<MembershipDto> {
  return apiRequest<MembershipDto>(`${slugPath(id)}/membership`, { method: 'PUT', auth: true });
}

/** Sai da comuna (DELETE, idempotente). Quem fundou não sai por aqui: 409 /errors/founder-cannot-leave. */
export async function leaveComuna(id: string): Promise<void> {
  await apiRequest(`${slugPath(id)}/membership`, { method: 'DELETE', auth: true });
}

// ---------------------------------------------------------------------------------------------
// Criação e gestão (só na API). Cada função é uma chamada; quem pode o quê é decidido no servidor.
// ---------------------------------------------------------------------------------------------

export type ComunaRuleInput = { title: string; body: string };

export type NewComuna = {
  name: string;
  description: string;
  visibility: 'public' | 'private';
  rules: ComunaRuleInput[];
  place?: string;
  topic?: TopicId;
};

/** POST /comunas. Manda só os dados da comuna: proprietário, endereço e estado são do servidor. */
export async function createComuna(input: NewComuna): Promise<ComunaDetails> {
  const body = {
    name: input.name,
    description: input.description,
    visibility: input.visibility,
    rules: input.rules,
    ...(input.topic ? { topics: [input.topic] } : {}),
    ...(input.place ? { place: input.place } : {}),
  };
  return toComunaDetails(await apiRequest<ComunaDto>('/comunas', { method: 'POST', body, auth: true }));
}

export function getComunaQuota(): Promise<ComunaQuotaDto> {
  return apiRequest<ComunaQuotaDto>('/me/comuna-quota', { auth: true });
}

/** Prévia de disponibilidade; a criação confere de novo no servidor. */
export function checkComunaName(name: string): Promise<ComunaNameAvailabilityDto> {
  return apiRequest<ComunaNameAvailabilityDto>(`/comuna-names/availability?name=${encodeURIComponent(name)}`, { auth: true });
}

/** PATCH /comunas/{slug}: descrição, assunto principal e regras (o nome não muda). Só o proprietário. */
export async function updateComuna(id: string, patch: { description?: string; rules?: ComunaRuleInput[]; topic?: TopicId }): Promise<ComunaDetails> {
  const dto = await apiRequest<ComunaDto>(slugPath(id), {
    method: 'PATCH',
    body: patch,
    auth: true,
    contentType: 'application/merge-patch+json',
  });
  return toComunaDetails(dto);
}

/** Arquiva (definitivo pelo app). Só o proprietário. */
export async function archiveComuna(id: string): Promise<ComunaDetails> {
  return toComunaDetails(await apiRequest<ComunaDto>(`${slugPath(id)}/archive`, { method: 'POST', auth: true }));
}

/**
 * Exclusão definitiva. Com outros membros: 409 /errors/comuna-has-members; com conteúdo de
 * outras pessoas: 409 /errors/comuna-has-content. Nos dois casos, a alternativa é arquivar.
 */
export async function deleteComuna(id: string): Promise<void> {
  await apiRequest(slugPath(id), { method: 'DELETE', auth: true });
}

/** Membros (só para quem participa: 403 /errors/members-only). */
export async function getComunaMembers(id: string, cursor: string | null): Promise<Page<ComunaPerson>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await apiRequest<PageDto<ComunaMemberDto>>(`${slugPath(id)}/members${query}`, { auth: true });
  return { items: page.items.map(toComunaPerson), nextCursor: page.nextCursor };
}

export async function removeMember(id: string, handle: string): Promise<void> {
  await apiRequest(`${slugPath(id)}/members/${encodeURIComponent(handle)}`, { method: 'DELETE', auth: true });
}

/** Nomeia (true) ou tira (false) da moderação. Só o proprietário. */
export async function setModerator(id: string, handle: string, moderator: boolean): Promise<void> {
  await apiRequest(`${slugPath(id)}/moderators/${encodeURIComponent(handle)}`, { method: moderator ? 'PUT' : 'DELETE', auth: true });
}

export type JoinRequest = { id: string; user: User; createdAt: string };

function toJoinRequest(dto: JoinRequestDto): JoinRequest {
  return { id: dto.id, user: toUser(dto.user), createdAt: dto.createdAt };
}

/** Pedidos de entrada em aberto (proprietário ou moderação). */
export async function getJoinRequests(id: string, cursor: string | null): Promise<Page<JoinRequest>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await apiRequest<PageDto<JoinRequestDto>>(`${slugPath(id)}/join-requests${query}`, { auth: true });
  return { items: page.items.map(toJoinRequest), nextCursor: page.nextCursor };
}

export async function decideJoinRequest(id: string, requestId: string, approve: boolean): Promise<void> {
  await apiRequest(`${slugPath(id)}/join-requests/${encodeURIComponent(requestId)}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    auth: true,
  });
}

/** Pede para entrar numa comuna privada (idempotente). */
export async function requestToJoin(id: string): Promise<void> {
  await apiRequest<JoinRequestDto>(`${slugPath(id)}/join-request`, { method: 'PUT', auth: true });
}

export async function cancelJoinRequest(id: string): Promise<void> {
  await apiRequest(`${slugPath(id)}/join-request`, { method: 'DELETE', auth: true });
}

/** Propõe passar a comuna para outro membro, pelo @. Nada muda até o aceite. */
export async function proposeTransfer(id: string, handle: string): Promise<void> {
  await apiRequest<OwnershipTransferDto>(`${slugPath(id)}/ownership-transfer`, { method: 'PUT', body: { handle }, auth: true });
}

export async function cancelTransfer(id: string): Promise<void> {
  await apiRequest(`${slugPath(id)}/ownership-transfer`, { method: 'DELETE', auth: true });
}

/** Resposta de quem recebeu a proposta. */
export async function respondToTransfer(id: string, accept: boolean): Promise<void> {
  await apiRequest<OwnershipTransferDto>(`${slugPath(id)}/ownership-transfer/${accept ? 'accept' : 'decline'}`, {
    method: 'POST',
    auth: true,
  });
}
