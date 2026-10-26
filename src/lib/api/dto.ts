/**
 * Formatos JSON de comunas, publicações e comentários na API (/api/v1), escritos à mão a partir
 * de `popularia_backend/docs/openapi.json` e das classes de saída do backend (src/Api/...).
 * As telas não usam estes tipos: cada `features/<domínio>/api.ts` converte para os modelos.
 */

/** Página com paginação por cursor: repita `nextCursor` em ?cursor= até ele vir null. */
export type PageDto<T> = { items: T[]; nextCursor: string | null };

/** Limite máximo de itens por página aceito pela API (1 a 50). */
export const MAX_PAGE_LIMIT = 50;

/** Autoria de publicações e comentários: só dados públicos. */
export type AuthorDto = { id: string; handle: string; displayName: string };

export type ComunaDto = {
  /** UUID: usado em POST /posts (comunaId). */
  id: string;
  /** Endereço da comuna nas rotas (/comunas/{slug}). */
  slug: string;
  name: string;
  description: string;
  place: string;
  visibility: 'public' | 'private';
  tone: string;
  topics: string[];
  foundedYear: number;
  memberCount: number;
  moderationNote: string;
  rules: { title: string; body: string }[];
  viewer: { isMember: boolean; role: 'member' | 'moderator' | 'founder' | null };
};

/** PUT /comunas/{slug}/membership. */
export type MembershipDto = { slug: string; isMember: boolean; role: string | null; memberCount: number };

export type PostDto = {
  id: string;
  body: string;
  createdAt: string;
  author: AuthorDto;
  comuna: { id: string; slug: string; name: string } | null;
  commentCount: number;
  /** Dicas para a interface, calculadas no servidor; a decisão que vale é a da API. */
  viewer: { isAuthor: boolean; canComment: boolean; canDelete: boolean };
};

export type CommentDto = {
  id: string;
  postId: string;
  parentId: string | null;
  /** Só "published" traz texto e autoria; os outros são marcadores para as respostas não ficarem soltas. */
  status: 'published' | 'deleted' | 'removed' | 'hidden';
  body: string | null;
  author: AuthorDto | null;
  createdAt: string;
  viewer: { isAuthor: boolean };
};
