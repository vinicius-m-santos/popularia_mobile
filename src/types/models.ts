/**
 * Modelos de domínio usados pelas telas.
 *
 * São independentes do formato da API: cada feature converte o JSON da API (`lib/api/dto.ts`)
 * para estes modelos no próprio `features/<domínio>/api.ts`. Campos opcionais marcados como
 * "só na API" ou "só nos mocks" existem em apenas um dos modos.
 * Datas são strings ISO 8601, como o API Platform serializa por padrão.
 */

/** Variação visual de avatares e cartões no design. */
export type Tone = 'red' | 'black' | 'cream';

export type TopicId =
  | 'pol'
  | 'trab'
  | 'sind'
  | 'eco'
  | 'fem'
  | 'anti'
  | 'lgbt'
  | 'edu'
  | 'saude'
  | 'clima'
  | 'comun'
  | 'cult'
  | 'hist'
  | 'livros'
  | 'tec'
  | 'games'
  | 'esp'
  | 'humor';

export type User = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  tone: Tone;
  /** Selo exibido ao lado do nome, como "Criadora" ou "Moderação". */
  badge?: string;
};

export type ComunaStat = { value: string; label: string };
export type ComunaRule = { title: string; description: string };

export type Comuna = {
  /** Endereço da comuna nas rotas: o slug na API (`/comunas/{slug}`), igual ao ID dos mocks. */
  id: string;
  /** Só na API: UUID usado para publicar na comuna (POST /posts). */
  serverId?: string;
  visibility?: 'public' | 'private';
  /** Só na API: comunas arquivadas ficam só para leitura. */
  status?: 'active' | 'archived';
  /** Se a pessoa participa, segundo o servidor, quando a comuna foi carregada. */
  viewerIsMember?: boolean;
  /** Só na API: papel da pessoa na comuna, segundo o servidor ("founder" = proprietário). */
  viewerRole?: ComunaRole | null;
  name: string;
  handle: string;
  initials: string;
  tone: Tone;
  place: string;
  foundedYear: string;
  description: string;
  memberCount: number;
  /** Só nos mocks: a API não informa quem está online. */
  onlineCount?: number;
  /** Descrição da foto de capa (texto alternativo). */
  coverAlt: string;
  topics: TopicId[];
  stats: ComunaStat[];
  rules: ComunaRule[];
  /** Nota sobre como a moderação é escolhida. */
  moderationNote: string;
  /** Publicação fixada; a API ainda não tem. */
  pinned: { title: string; text: string } | null;
  moderatorIds: string[];
  /** Papel da primeira pessoa moderadora, por exemplo "Fundadora · Moderação". */
  founderRole: string;
  /** Algumas pessoas membras exibidas em destaque. */
  featuredMemberIds: string[];
};

export type EventKind = 'Ato' | 'Mutirão' | 'Assembleia';

export type CommunityEvent = {
  id: string;
  comunaId: string;
  kind: EventKind;
  title: string;
  startsAt: string;
  place: string;
  attendeeCount: number;
  tone: Tone;
};

export type PostMedia = {
  meta: string;
  title: string;
};

export type PostImage = {
  /** Descrição usada como texto alternativo e legenda do placeholder. */
  alt: string;
};

export type Post = {
  id: string;
  authorId: string;
  comunaId: string | null;
  createdAt: string;
  text: string;
  images?: PostImage[];
  eventId?: string;
  media?: PostMedia;
  supportCount: number;
  commentCount: number;
  echoCount: number;
  /** Rótulo do selo de autoria nos comentários ("Autora", "Autor", "Autoria"). */
  authorLabel?: string;
  topComment?: { authorId: string; text: string };
  /** Só na API: o que a pessoa logada pode fazer, calculado no servidor. */
  viewer?: PostViewer;
};

export type PostViewer = { isAuthor: boolean; canComment: boolean; canDelete: boolean; canRemove?: boolean };

/** Comuna citada numa publicação (a API manda só o essencial). */
export type ComunaRef = Pick<Comuna, 'id' | 'name' | 'status'>;

/** Post com as entidades relacionadas já resolvidas, pronto para exibição. */
export type FeedItem = Post & {
  author: User;
  comuna: ComunaRef | null;
  event: CommunityEvent | null;
  topCommentAuthor: User | null;
};

/** Comentário em lista plana; respostas apontam para o comentário pai. */
export type Comment = {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  createdAt: string;
  text: string;
  supportCount: number;
  /**
   * Só na API. Comentários apagados, removidos pela moderação ou ocultos por bloqueio continuam
   * na lista como marcadores sem texto nem autoria, para as respostas não ficarem soltas.
   */
  status?: CommentStatus;
  /** Só na API: a pessoa logada escreveu este comentário (segundo o servidor). */
  isOwn?: boolean;
};

export type CommentStatus = 'published' | 'deleted' | 'removed' | 'hidden';

export type CommentWithAuthor = Comment & { author: User };

export type ComunaMember = User & { role: string };

/** Papel dentro de uma comuna. "founder" é quem é proprietário (pode ter recebido por transferência). */
export type ComunaRole = 'member' | 'moderator' | 'founder';

/** O que a pessoa pode fazer na comuna, segundo o servidor (dica; a API confere de novo). */
export type ComunaPermissions = {
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
};

/** Pessoa da comuna com papel, na gestão (só na API). */
export type ComunaPerson = User & { role: ComunaRole; joinedAt: string };

export type OwnershipTransfer = { direction: 'outgoing' | 'incoming'; from: User; to: User; createdAt: string };

/** Comuna com pessoas resolvidas, para a página da comuna. */
export type ComunaDetails = Comuna & {
  /** Se a pessoa já participava ao carregar (o total de membros a inclui). */
  viewerIsMember: boolean;
  /** Só na API. */
  viewerPermissions?: ComunaPermissions;
  /** Só na API: pedido de entrada em aberto (comunas privadas). */
  viewerJoinRequest?: 'pending' | null;
  /** Só na API: proposta de transferência que envolve a pessoa. */
  ownershipTransfer?: OwnershipTransfer | null;
  /** Só na API: quem responde pela comuna (null em comunas da equipe). */
  owner?: User | null;
  archivedAt?: string | null;
  moderators: User[];
  featuredMembers: User[];
  members: ComunaMember[];
};

export type FeedTab = 'para-voce' | 'minhas' | 'perto';

export type Topic = { id: TopicId; label: string; shortLabel: string };

/** Grupo de assuntos na escolha de interesses ("Política e direitos"…). */
export type TopicGroup = { title: string; topics: Topic[] };

/** Assunto em destaque no Explorar; tocar nele preenche a busca. */
export type Trend = { label: string; postCountLabel: string; query: string; tone: Tone };

export type ProfileStat = { value: string; label: string };

export type PodcastEpisode = { number: string; title: string; meta: string };

/** Dados de vitrine de uma pessoa criadora (podcast, apoio coletivo). */
export type CreatorInfo = {
  mastheadKicker: string;
  mastheadTitle: string;
  mastheadLeft: string;
  mastheadRight: string;
  episodes: PodcastEpisode[];
};

export type Profile = {
  user: User;
  bio: string;
  /** Linha de contexto: cidade e tempo na Popularia. */
  meta: string;
  /** Resumo curto usado em listas, como "Criadora · podcast Leitura Crítica". */
  summary: string;
  stats: ProfileStat[];
  comunaIds: string[];
  creator: CreatorInfo | null;
};

export type NotificationKind =
  | 'follow' | 'comment' | 'reply'
  | 'join_requested' | 'join_approved' | 'join_rejected'
  | 'ownership_proposed' | 'ownership_accepted' | 'ownership_declined' | 'ownership_cancelled';

/** Destino ao tocar no aviso. */
export type NotificationTarget = { kind: 'post' | 'comuna' | 'profile' | 'join_requests'; id: string };

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  actor: User | null;
  text: string;
  /** Trecho em negrito depois do texto, como o nome da comuna. */
  subject?: string;
  quote?: string;
  /** Vinha marcado como não lido do servidor (o estado local pode marcar como lido). */
  unread: boolean;
  target: NotificationTarget | null;
};

export type ExploreFilter = 'tudo' | 'comunas' | 'pessoas' | 'assuntos' | 'posts';

/** O que pode ser denunciado pelo menu "⋯". */
export type ReportTarget = {
  kind: 'post' | 'comment' | 'profile';
  id: string;
  /** Quem publicou o conteúdo (ou o dono do perfil). */
  author: User;
  /** Comuna cuja moderação recebe a denúncia; sem comuna, vai para a moderação geral. */
  comunaId: string | null;
  /** Trecho exibido para a moderação. */
  excerpt: string;
  /** Onde está o conteúdo, como "Comentário em “Simulado do sábado”". */
  where: string;
  /** Conteúdo da própria pessoa, segundo o servidor (ausente nos mocks: compara o ID "me"). */
  isOwn?: boolean;
};

/** Denúncia na fila de uma comuna. */
export type ModerationReport = {
  id: string;
  comunaId: string;
  reason: string;
  /** Quantas pessoas denunciaram o mesmo conteúdo. */
  reportCount: number;
  author: User;
  where: string;
  text: string;
  /** Comentário de quem denunciou. */
  note?: string;
  createdAt: string;
};

export type ModerationLogEntry = { id: string; createdAt: string; text: string };

export type ModerationOverview = {
  comuna: Comuna;
  reports: ModerationReport[];
  log: ModerationLogEntry[];
  /** Decisões dos últimos 30 dias, antes das tomadas neste aparelho. */
  resolvedLast30Days: number;
  averageResponse: string;
};
