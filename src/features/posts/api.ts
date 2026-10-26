/**
 * Publicações na API real: leitura, criação e a conversão do JSON para os modelos do app.
 * Feed, comunas e discussões usam `toFeedItem` para exibir as publicações do mesmo jeito.
 *
 * Autoria, contagens e permissões vêm sempre do servidor: o app só manda o texto e a comuna.
 */
import { apiRequest } from '@/lib/api/client';
import type { AuthorDto, PostDto } from '@/lib/api/dto';
import { ApiError, NotFoundError } from '@/lib/errors';
import { initialsOf } from '@/lib/format';
import type { FeedItem, Tone, User } from '@/types/models';

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
  };
}

/** Publicação da API → item exibível. Apoios e ecos ainda não existem na API (ficam em 0). */
export function toFeedItem(post: PostDto): FeedItem {
  return {
    id: post.id,
    authorId: post.author.id,
    // No app, a comuna é identificada pelo slug, que também é o endereço da rota.
    comunaId: post.comuna?.slug ?? null,
    createdAt: post.createdAt,
    text: post.body,
    supportCount: 0,
    commentCount: post.commentCount,
    echoCount: 0,
    viewer: post.viewer,
    author: toUser(post.author),
    comuna: post.comuna ? { id: post.comuna.slug, name: post.comuna.name } : null,
    event: null,
    topCommentAuthor: null,
  };
}

/** GET /posts/{id}. A API responde 404 também para publicações que a pessoa não pode ver. */
export async function getPost(id: string): Promise<FeedItem> {
  try {
    return toFeedItem(await apiRequest<PostDto>(`/posts/${encodeURIComponent(id)}`, { auth: true }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new NotFoundError('Publicação');
    throw error;
  }
}

/**
 * POST /posts. `comunaServerId` é o UUID da comuna (null publica no próprio perfil).
 * Exige e-mail confirmado (403 /errors/email-not-verified) e participar da comuna (403 /errors/not-a-member).
 */
export async function createPost(input: { comunaServerId: string | null; text: string }): Promise<FeedItem> {
  const post = await apiRequest<PostDto>('/posts', {
    method: 'POST',
    body: { comunaId: input.comunaServerId, body: input.text },
    auth: true,
  });
  return toFeedItem(post);
}
