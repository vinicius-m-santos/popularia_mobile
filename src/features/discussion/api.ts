/**
 * Acesso a dados de uma discussão (publicação + comentários).
 *
 * Com a API configurada, a publicação vem de GET /posts/{id} e os comentários de
 * GET /posts/{id}/comments: lista plana, do mais antigo para o mais novo, paginada por cursor;
 * a árvore é montada no app (thread.ts). No modo demonstração, tudo vem dos mocks.
 */
import { DEMO_MODE } from '@/constants/config';
import { findUser, toFeedItem as mockToFeedItem } from '@/features/lookup';
import { getPost, toUser } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import type { CommentDto, PageDto } from '@/lib/api/dto';
import { ApiError, NotFoundError } from '@/lib/errors';
import { mockDelay } from '@/lib/mock-delay';
import { singlePage, type Page } from '@/lib/pagination';
import { comments } from '@/mocks/comments';
import { posts } from '@/mocks/posts';
import type { CommentStatus, CommentWithAuthor, FeedItem } from '@/types/models';

/** Texto exibido no lugar de comentários sem conteúdo. */
const PLACEHOLDER_TEXT: Record<Exclude<CommentStatus, 'published'>, string> = {
  deleted: 'Comentário apagado por quem escreveu.',
  removed: 'Comentário removido pela moderação.',
  hidden: 'Comentário indisponível.',
};

function postPath(postId: string): string {
  return `/posts/${encodeURIComponent(postId)}`;
}

export function toComment(dto: CommentDto): CommentWithAuthor {
  const base = {
    id: dto.id,
    postId: dto.postId,
    parentId: dto.parentId,
    createdAt: dto.createdAt,
    supportCount: dto.supportCount,
    viewerSupported: dto.viewer.supported,
    status: dto.status,
    isOwn: dto.viewer.isAuthor,
  };
  if (dto.status === 'published' && dto.author && dto.body !== null) {
    return { ...base, authorId: dto.author.id, text: dto.body, author: toUser(dto.author) };
  }
  // Marcador: sem texto nem autoria (apagado, removido ou de quem tem bloqueio com você).
  const status = dto.status === 'published' ? 'hidden' : dto.status;
  return {
    ...base,
    status,
    authorId: '',
    text: PLACEHOLDER_TEXT[status],
    author: { id: '', name: 'Indisponível', handle: '', initials: '', tone: 'cream' },
  };
}

export async function getDiscussionPost(postId: string): Promise<FeedItem> {
  if (!DEMO_MODE) return getPost(postId);

  const raw = posts.find((p) => p.id === postId);
  const post = raw ? mockToFeedItem(raw) : null;
  if (!post) throw new NotFoundError('Publicação');
  return mockDelay(post);
}

export async function getComments(postId: string, cursor: string | null): Promise<Page<CommentWithAuthor>> {
  if (!DEMO_MODE) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    try {
      const page = await apiRequest<PageDto<CommentDto>>(`${postPath(postId)}/comments${query}`, { auth: true });
      return { items: page.items.map(toComment), nextCursor: page.nextCursor };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw new NotFoundError('Publicação');
      throw error;
    }
  }

  const list = comments
    .filter((c) => c.postId === postId)
    .flatMap((c) => {
      const author = findUser(c.authorId);
      return author ? [{ ...c, author }] : [];
    });
  return mockDelay(singlePage(list));
}

/**
 * POST /posts/{id}/comments. A autoria é sempre quem está logado (o servidor decide).
 * Exige e-mail confirmado (403 /errors/email-not-verified) e, em comunas, participar delas
 * (403 /errors/not-a-member). Resposta a comentário indisponível: 422 em `parentId`.
 */
export async function createComment(input: {
  postId: string;
  parentId: string | null;
  text: string;
}): Promise<CommentWithAuthor> {
  const dto = await apiRequest<CommentDto>(`${postPath(input.postId)}/comments`, {
    method: 'POST',
    body: { body: input.text, parentId: input.parentId },
    auth: true,
  });
  return toComment(dto);
}

export async function setCommentSupport(commentId: string, supported: boolean): Promise<CommentWithAuthor> {
  const dto = await apiRequest<CommentDto>(`/comments/${encodeURIComponent(commentId)}/support`, {
    method: supported ? 'PUT' : 'DELETE',
    auth: true,
  });
  return toComment(dto);
}
