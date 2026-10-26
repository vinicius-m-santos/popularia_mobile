import type { CommentWithAuthor, FeedItem, ReportTarget, User } from '@/types/models';

/** Até onde o trecho do conteúdo aparece para a moderação. */
const EXCERPT_LENGTH = 180;

function excerpt(text: string): string {
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text;
}

/** Título curto de uma publicação, para "Comentário em “…”". */
function shortTitle(text: string): string {
  const words = text.split(/\s+/).slice(0, 5).join(' ');
  return words.length < text.length ? `${words}…` : words;
}

export function postTarget(post: FeedItem): ReportTarget {
  return {
    kind: 'post',
    id: post.id,
    author: post.author,
    comunaId: post.comunaId,
    excerpt: excerpt(post.text),
    where: 'Publicação',
    isOwn: post.viewer?.isAuthor,
  };
}

export function commentTarget(comment: CommentWithAuthor, post: FeedItem): ReportTarget {
  return {
    kind: 'comment',
    id: comment.id,
    author: comment.author,
    comunaId: post.comunaId,
    excerpt: excerpt(comment.text),
    where: `Comentário em “${shortTitle(post.text)}”`,
    isOwn: comment.isOwn,
  };
}

export function profileTarget(user: User, bio: string): ReportTarget {
  return { kind: 'profile', id: user.id, author: user, comunaId: null, excerpt: excerpt(bio), where: 'Perfil' };
}
