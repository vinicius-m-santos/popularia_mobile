import type { CommentWithAuthor } from '@/types/models';

export type CommentSort = 'top' | 'recent';

export type ThreadRow = {
  comment: CommentWithAuthor;
  /** 0 = comentário principal; respostas aumentam a profundidade. */
  depth: number;
  replyCount: number;
  collapsed: boolean;
};

/** A partir daqui, respostas não recuam mais (telas estreitas). */
export const MAX_VISUAL_DEPTH = 3;

type BuildOptions = {
  sort: CommentSort;
  /** IDs de comentários com respostas ocultas. */
  collapsed: Record<string, boolean>;
  /** IDs criados nesta sessão: aparecem primeiro entre os principais, como no design. */
  localIds?: Set<string>;
  /** Contagem de apoio exibida (inclui o apoio local), usada em "Mais apoiados". */
  supportOf?: (c: CommentWithAuthor) => number;
};

/**
 * Transforma a lista plana (com `parentId`) em linhas na ordem de leitura.
 * Comentários principais seguem a ordenação escolhida; respostas ficam em
 * ordem cronológica, logo abaixo do comentário que respondem.
 */
export function buildThread(comments: CommentWithAuthor[], options: BuildOptions): ThreadRow[] {
  const { sort, collapsed, localIds = new Set(), supportOf = (c) => c.supportCount } = options;
  const children = new Map<string | null, CommentWithAuthor[]>();
  const ids = new Set(comments.map((c) => c.id));

  for (const c of comments) {
    // Resposta cujo pai não existe (removido, por exemplo) vira comentário principal.
    const parent = c.parentId !== null && ids.has(c.parentId) ? c.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(c);
    children.set(parent, list);
  }

  const byDateAsc = (a: CommentWithAuthor, b: CommentWithAuthor) => a.createdAt.localeCompare(b.createdAt);
  const topLevel = [...(children.get(null) ?? [])].sort((a, b) => {
    const aLocal = localIds.has(a.id);
    const bLocal = localIds.has(b.id);
    if (aLocal !== bLocal) return aLocal ? -1 : 1;
    if (sort === 'recent') return b.createdAt.localeCompare(a.createdAt);
    return supportOf(b) - supportOf(a);
  });

  const rows: ThreadRow[] = [];
  const visit = (c: CommentWithAuthor, depth: number) => {
    const replies = [...(children.get(c.id) ?? [])].sort(byDateAsc);
    const isCollapsed = !!collapsed[c.id];
    rows.push({ comment: c, depth, replyCount: replies.length, collapsed: isCollapsed });
    if (!isCollapsed) replies.forEach((r) => visit(r, depth + 1));
  };
  topLevel.forEach((c) => visit(c, 0));
  return rows;
}
