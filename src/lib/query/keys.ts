import type { QueryKey } from '@tanstack/react-query';

/**
 * Factory das chaves de cache por domínio.
 *
 * A chave é o contrato entre leitura, mutação e invalidação. Prefixos estáveis
 * (`feed`, `profile`, `comuna`, `post`, `discovery`, `search`…) permitem invalidar
 * uma superfície inteira sem varrer o cache do aplicativo. Subchaves de uma
 * entidade ficam sempre abaixo da raiz dela: a comuna `hortas` mora em
 * `['comuna', 'hortas']`, e posts/fixados/eventos são filhos dessa raiz.
 *
 * Regras de payload que acompanham a factory:
 * - o detalhe de uma entidade só recebe o payload completo daquele endpoint;
 * - itens de lista (resumo de comuna, pessoa em descoberta) não são gravados na
 *   chave de detalhe: isso evita que um payload parcial sobrescreva o completo;
 * - mutações de relação (seguir, participar, salvar, apoiar) alteram somente os
 *   campos de que são donas, preservando o restante do objeto.
 */
export const queryKeys = {
  avatar: {
    all: ['user-avatar'] as const,
    detail: (userId: string) => ['user-avatar', userId] as const,
  },

  feed: {
    all: ['feed'] as const,
    /** Aba do feed + escopo local (comunas seguidas, pessoas seguidas nos mocks). */
    list: (tab: string, ...scope: string[]) => ['feed', tab, ...scope] as const,
    following: ['feed', 'seguindo'] as const,
  },

  post: {
    all: ['post'] as const,
    detail: (id: string) => ['post', id] as const,
    previewAll: ['post-preview'] as const,
    preview: (id: string) => ['post-preview', id] as const,
  },

  profile: {
    all: ['profile'] as const,
    detail: (id: string) => ['profile', id] as const,
    postsAll: ['profile-posts'] as const,
    posts: (author: string) => ['profile-posts', author] as const,
    relationsAll: ['relations'] as const,
    relations: (kind: string, id: string) => ['relations', kind, id] as const,
  },

  comuna: {
    all: ['comuna'] as const,
    /**
     * O detalhe é a própria raiz da entidade (mesmo formato do POP-37), para
     * que imagem/gestão/eventos/moderação compartilhem uma única leitura.
     */
    detail: (slug: string) => ['comuna', slug] as const,
    posts: (slug: string) => ['comuna', slug, 'posts'] as const,
    pins: (slug: string) => ['comuna', slug, 'pins'] as const,
    square: (slug: string) => ['comuna', slug, 'square'] as const,
    /** Overlays de mídia: URL curta que não deve ser confundida com o detalhe. */
    cover: (slug: string) => ['comuna-cover', slug] as const,
    mark: (slug: string) => ['comuna-mark', slug] as const,
    eventsAll: (slug: string) => ['comuna', slug, 'events'] as const,
    events: (slug: string, when: string) => ['comuna', slug, 'events', when] as const,
    /** Predicado para as listas de publicações de todas as comunas. */
    isPostsKey: (key: QueryKey) => key[0] === 'comuna' && key[2] === 'posts',
    isEventsKey: (key: QueryKey) => key[0] === 'comuna' && key[2] === 'events',
  },

  discovery: {
    all: ['discovery'] as const,
    /** Descoberta da tela Explorar, por pessoa, assunto e escopo de interesses. */
    home: (userId: string, topic?: string | null, scope = '') => [
      'discovery',
      'home',
      userId,
      topic ?? null,
      ...(scope ? [scope] : []),
    ] as const,
    topicDocuments: (userId: string, topic: string) => ['discovery', 'topic-documents', userId, topic] as const,
    /** Toda a busca compartilha a raiz; cada combinação termos/filtro/assunto é uma entrada. */
    searchAll: ['search'] as const,
    search: (query: string, filter: string, topic?: string | null) => ['search', query, filter, topic ?? null] as const,
  },

  topic: {
    all: ['topic'] as const,
    info: (slug: string) => ['topic', slug] as const,
    postsAll: ['topic-posts'] as const,
    posts: (slug: string) => ['topic-posts', slug] as const,
  },

  saved: {
    all: ['saved-posts'] as const,
  },

  event: {
    all: ['event'] as const,
    detail: (id: string) => ['event', id] as const,
    attendees: (id: string, status: string) => ['event-attendees', id, status] as const,
  },

  notification: {
    all: ['notifications'] as const,
    session: (identity: string) => ['notifications', identity] as const,
    unread: (identity: string) => ['notifications', identity, 'unread'] as const,
  },

  moderation: {
    comunaReportsAll: (slug: string) => ['comuna-reports', slug] as const,
    comunaReports: (slug: string, bucket: string) => ['comuna-reports', slug, bucket] as const,
    platformReportsAll: ['platform-reports'] as const,
    platformReports: (bucket: string) => ['platform-reports', bucket] as const,
  },

  gamification: {
    detail: (accountId: string) => ['gamification', accountId] as const,
  },

  mention: {
    suggestions: (term: string) => ['mention-suggestions', term] as const,
  },
} as const;
