/**
 * Publicações na API real: leitura, criação e a conversão do JSON para os modelos do app.
 * Feed, comunas e discussões usam `toFeedItem` para exibir as publicações do mesmo jeito.
 *
 * Autoria, contagens e permissões vêm sempre do servidor: o app só manda o texto e a comuna.
 */
import { API_BASE_URL } from '@/constants/config';
import { absoluteMediaUrl } from '@/features/media/media-url';
import { apiRequest } from '@/lib/api/client';
import type { AuthorDto, PageDto, PostDto, SavedPostDto } from '@/lib/api/dto';
import { ApiError, NotFoundError } from '@/lib/errors';
import { initialsOf } from '@/lib/format';
import type { Page } from '@/lib/pagination';
import type { FeedItem, Tone, TopicId, User } from '@/types/models';

const TONES: Tone[] = ['red', 'black', 'cream'];

/** Tom do avatar escolhido pelo ID: a mesma pessoa tem sempre a mesma cor. */
export function toneFor(id: string): Tone {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

export function toUser(author: AuthorDto): User {
  return {
    id: author.id,
    name: author.displayName,
    handle: author.handle,
    initials: initialsOf(author.displayName),
    tone: toneFor(author.id),
    avatarUrl: absoluteMediaUrl(author.avatarUrl),
  };
}

/** Publicação da API → item exibível. Apoios e ecos ainda não existem na API (ficam em 0). */
export function toFeedItem(post: PostDto): FeedItem {
  const media = post.media ? { ...post.media, url: post.media.url?.startsWith('/') ? `${API_BASE_URL.replace(/\/api\/v1$/, '')}${post.media.url}` : post.media.url } : null;
  return {
    id: post.id,
    document: post.document ?? null,
    attachment: media,
    authorId: post.author.id,
    // No app, a comuna é identificada pelo slug, que também é o endereço da rota.
    comunaId: post.comuna?.slug ?? null,
    createdAt: post.createdAt,
    text: post.body,
    supportCount: 0,
    commentCount: post.commentCount,
    echoCount: 0,
    viewer: post.viewer,
    poll: post.poll ?? null,
    author: toUser(post.author),
    comuna: post.comuna ? { id: post.comuna.slug, name: post.comuna.name, status: post.comuna.status } : null,
    event: null,
    topCommentAuthor: null,
  };
}

/** GET /posts/{id}. A API responde 404 também para publicações que a pessoa não pode ver. */
export async function getPost(id: string, signal?: AbortSignal): Promise<FeedItem> {
  try {
    return toFeedItem(await apiRequest<PostDto>(`/posts/${encodeURIComponent(id)}`, { auth: true, ...(signal ? { signal } : {}) }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new NotFoundError('Publicação');
    throw error;
  }
}

/**
 * POST /posts. `comunaServerId` é o UUID da comuna (null publica no próprio perfil).
 * Exige e-mail confirmado (403 /errors/email-not-verified) e participar da comuna (403 /errors/not-a-member).
 */
export async function createPost(input: { comunaServerId: string | null; text: string; topic?: TopicId | null; documentId?: string; mediaId?: string; poll?: { question: string; options: { label: string }[] } | null }): Promise<FeedItem> {
  const post = await apiRequest<PostDto>('/posts', {
    method: 'POST',
    body: { ...(input.documentId ? { documentId: input.documentId } : {}), ...(input.mediaId ? { mediaId: input.mediaId } : {}), ...(input.poll ? { poll: input.poll } : {}), comunaId: input.comunaServerId, body: input.text, ...(input.comunaServerId === null && input.topic ? { topic: input.topic } : {}) },
    auth: true,
  });
  return toFeedItem(post);
}

/** PUT ou DELETE /posts/{id}/save. As duas respostas são vazias e podem repetir sem efeito. */
export function setPostSaved(id: string, saved: boolean): Promise<void> {
  return apiRequest<void>(`/posts/${encodeURIComponent(id)}/save`, { method: saved ? 'PUT' : 'DELETE', auth: true });
}

/** GET /me/saved-posts. A ordem é a data em que foi salvo; o cartão continua sendo a publicação. */
export async function listSavedPosts(cursor: string | null, signal?: AbortSignal): Promise<Page<FeedItem>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await apiRequest<PageDto<SavedPostDto>>(`/me/saved-posts${query}`, { auth: true, ...(signal ? { signal } : {}) });
  return {
    items: page.items.map((item) => ({ ...toFeedItem({ ...item.post, viewer: { ...item.post.viewer, saved: true } }), savedAt: item.savedAt })),
    nextCursor: page.nextCursor,
  };
}

/** PUT /posts/{id}/poll/vote. A resposta já traz a publicação com o resultado atualizado. */
export async function voteOnPoll(postId: string, optionId: string): Promise<FeedItem> {
  const post = await apiRequest<PostDto>(`/posts/${encodeURIComponent(postId)}/poll/vote`, {
    method: 'PUT',
    body: { optionId },
    auth: true,
  });
  return toFeedItem(post);
}
