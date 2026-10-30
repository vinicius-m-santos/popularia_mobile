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
export type AuthorDto = { id: string; handle: string; displayName: string; avatarUrl?: string | null };

export type ComunaRoleDto = 'member' | 'moderator' | 'founder';

/**
 * Dicas para a interface, calculadas no servidor pelo papel e pelo estado da comuna.
 * A decisão que vale é a de cada operação, que confere tudo de novo.
 */
export type ComunaPermissionsDto = {
  canPost: boolean;
  canLeave: boolean;
  canEditDetails: boolean;
  canManageModerators: boolean;
  canRemoveMembers: boolean;
  canReviewJoinRequests: boolean;
  canModerateContent: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canTransferOwnership: boolean;
  canManageEvents: boolean;
};

/** Pessoa numa comuna (lista de membros e moderação). `founder` é quem é proprietário. */
export type ComunaMemberDto = { id: string; handle: string; displayName: string; role: ComunaRoleDto; joinedAt: string; avatarUrl?: string | null };

export type ComunaDto = {
  /** UUID: usado em POST /posts (comunaId). */
  id: string;
  /** Endereço da comuna nas rotas (/comunas/{slug}). Não muda: o nome também não. */
  slug: string;
  name: string;
  description: string;
  place: string;
  visibility: 'public' | 'private';
  status: 'active' | 'archived';
  archivedAt: string | null;
  tone: string;
  topics: string[];
  primaryTopic?: { id: string; label: string; shortLabel: string; group: string } | null;
  foundedYear: number;
  memberCount: number;
  moderationNote: string;
  coverUrl?: string | null;
  markUrl?: string | null;
  rules: { title: string; body: string }[];
  /** Null em comunas da equipe da plataforma. */
  owner: AuthorDto | null;
  /** Proprietário e moderação; só no detalhe (null nas listas). */
  moderation: ComunaMemberDto[] | null;
  viewer: {
    isMember: boolean;
    role: ComunaRoleDto | null;
    permissions: ComunaPermissionsDto;
    /** Só no detalhe: pedido de entrada em aberto. */
    joinRequest: 'pending' | null;
    /** Só no detalhe: proposta de transferência que envolve quem vê. */
    ownershipTransfer: { direction: 'outgoing' | 'incoming'; from: AuthorDto; to: AuthorDto; createdAt: string } | null;
  };
};

/** PUT /comunas/{slug}/membership. */
export type MembershipDto = { slug: string; isMember: boolean; role: string | null; memberCount: number };

/** Pedido de entrada numa comuna privada. */
export type JoinRequestDto = {
  id: string;
  comunaSlug: string;
  user: AuthorDto;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  decidedAt: string | null;
};

export type OwnershipTransferDto = {
  id: string;
  comunaSlug: string;
  from: AuthorDto;
  to: AuthorDto;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
};

/** GET /me/comuna-quota: só para explicar antes do formulário; POST /comunas confere de novo. */
export type ComunaQuotaDto = {
  activeOwned: number;
  limit: number;
  intervalDays: number;
  nextCreationAt: string | null;
  canCreate: boolean;
  blockedBy: string | null;
};

/** GET /comuna-names/availability?name=. */
export type ComunaNameAvailabilityDto = { name: string; slug: string; available: boolean; message: string | null };

export type MentionDto = {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  start: number;
  end: number;
};

export type PostDto = {
  document?: import('@/features/library/types').LibraryDocument | null;
  media?: import('@/features/posts/post-media').PostMediaDto | null;
  topic?: string | null;
  id: string;
  body: string;
  createdAt: string;
  author: AuthorDto;
  comuna: { id: string; slug: string; name: string; status: 'active' | 'archived' } | null;
  commentCount: number;
  /** Dicas para a interface, calculadas no servidor; a decisão que vale é a da API. */
  viewer: { isAuthor: boolean; canComment: boolean; canDelete: boolean; canRemove: boolean; saved?: boolean; canPin?: boolean; pinned?: boolean };
  mentions?: MentionDto[];
  poll?: {
    id: string;
    question: string;
    totalVotes: number;
    votedOptionId: string | null;
    options: { id: string; label: string; voteCount: number; percent: number; selected: boolean }[];
  } | null;
  /** Atividade da mesma comuna, quando a publicação aponta para uma. */
  event?: {
    id: string;
    title: string;
    format: 'in_person' | 'online' | 'hybrid';
    status: 'scheduled' | 'cancelled';
    startsAt: string;
    timeZone: string;
    placeName: string | null;
    goingCount: number;
    maybeCount: number;
    past: boolean;
  } | null;
};

/** GET /me/saved-posts. `savedAt` é quando esta pessoa guardou a publicação, não quando ela foi escrita. */
export type SavedPostDto = { id: string; savedAt: string; post: PostDto };

export type CommentDto = {
  id: string;
  postId: string;
  parentId: string | null;
  /** Só "published" traz texto e autoria; os outros são marcadores para as respostas não ficarem soltas. */
  status: 'published' | 'deleted' | 'removed' | 'hidden';
  body: string | null;
  author: AuthorDto | null;
  createdAt: string;
  supportCount: number;
  viewer: { isAuthor: boolean; canRemove: boolean; supported: boolean };
  mentions?: MentionDto[];
};
