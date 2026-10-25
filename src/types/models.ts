/**
 * Modelos de domínio usados pelas telas.
 *
 * São independentes do formato da API: quando a API Symfony/API Platform existir,
 * cada feature terá um mapeador (JSON-LD/Hydra → modelo) em `features/<domínio>/api.ts`.
 * Datas chegam como string ISO 8601, como o API Platform serializa por padrão.
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

export type Topic = {
  id: TopicId;
  label: string;
  shortLabel: string;
};

export type User = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  tone: Tone;
  /** Selo exibido ao lado do nome, como "Criadora" ou "Moderação". */
  badge?: string;
};

export type Comuna = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  tone: Tone;
  place: string;
  description: string;
  memberCount: number;
  topics: TopicId[];
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
};

export type PostMedia = {
  meta: string;
  title: string;
};

export type PostImage = {
  /** Descrição usada como texto alternativo (acessibilidade). */
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
  topComment?: { authorId: string; text: string };
};

/** Post com as entidades relacionadas já resolvidas, pronto para exibição. */
export type FeedItem = Post & {
  author: User;
  comuna: Comuna | null;
  event: CommunityEvent | null;
  topCommentAuthor: User | null;
};
