import { queryClient } from '@/lib/query/client';
import type { Comuna, ComunaDetails } from '@/types/models';

/**
 * Toda leitura de uma comuna vive sob a mesma raiz (`['comuna', slug]`).
 *
 * O detalhe é a própria raiz; resumo, publicações, fixados, eventos e Praça são
 * subchaves. Invalidar `comunaKeys.group(slug)` atinge tudo o que é daquela
 * comuna, sem tocar em outra. Assim uma edição, entrada/saída ou decisão de
 * moderação pode refrescar todas as leituras abertas e desmontadas de uma vez.
 */
export const comunaKeys = {
  all: ['comuna'] as const,
  group: (slug: string) => ['comuna', slug] as const,
  detail: (slug: string) => ['comuna', slug] as const,
  summary: (slug: string) => ['comuna', slug, 'summary'] as const,
  posts: (slug: string) => ['comuna', slug, 'posts'] as const,
  pins: (slug: string) => ['comuna', slug, 'pins'] as const,
  square: (slug: string) => ['comuna', slug, 'square'] as const,
  eventsAll: (slug: string) => ['comuna', slug, 'events'] as const,
  events: (slug: string, when: string) => ['comuna', slug, 'events', when] as const,
};

/**
 * Resumo leve usado como `placeholderData` quando a comuna é aberta a partir de
 * uma lista. Nunca inclui permissões, moderação ou pessoas: esses dados só valem
 * depois que o detalhe autorizado chega do servidor.
 */
export function toComunaSummary(comuna: Comuna): Comuna {
  return {
    id: comuna.id,
    serverId: comuna.serverId,
    visibility: comuna.visibility,
    status: comuna.status,
    viewerIsMember: comuna.viewerIsMember,
    viewerRole: comuna.viewerRole,
    name: comuna.name,
    handle: comuna.handle,
    initials: comuna.initials,
    tone: comuna.tone,
    place: comuna.place,
    foundedYear: comuna.foundedYear,
    description: comuna.description,
    memberCount: comuna.memberCount,
    onlineCount: comuna.onlineCount,
    coverAlt: comuna.coverAlt,
    coverUrl: comuna.coverUrl,
    markUrl: comuna.markUrl,
    topics: comuna.topics,
    primaryTopic: comuna.primaryTopic,
    stats: comuna.stats,
    rules: comuna.rules,
    moderationNote: comuna.moderationNote,
    pinned: comuna.pinned,
    moderatorIds: comuna.moderatorIds,
    founderRole: comuna.founderRole,
    featuredMemberIds: comuna.featuredMemberIds,
  };
}

export function rememberComunaSummary(comuna: Comuna): void {
  queryClient.setQueryData(comunaKeys.summary(comuna.id), toComunaSummary(comuna));
}

/** Listas de comunas (Explorar, perfil, compositor) alimentam o resumo de cada uma. */
export function rememberComunaSummaries(comunas: Comuna[]): void {
  for (const comuna of comunas) rememberComunaSummary(comuna);
}

export function readComunaSummary(slug: string): Comuna | undefined {
  return queryClient.getQueryData<Comuna>(comunaKeys.summary(slug));
}

/** Detalhe mínimo para a capa não piscar enquanto o servidor confirma o acesso. */
export function placeholderComunaDetails(slug: string): ComunaDetails | undefined {
  const summary = readComunaSummary(slug);
  if (!summary) return undefined;
  return {
    ...summary,
    viewerIsMember: summary.viewerIsMember ?? false,
    moderators: [],
    featuredMembers: [],
    members: [],
  };
}

/**
 * Entrar/sair é confirmado pela API; o detalhe e o resumo compartilhados passam
 * a refletir a resposta sem esperar uma nova leitura. Em comuna privada,
 * publicações, Praça e fixados são invalidados porque o acesso abre ou fecha.
 */
function membershipFields(current: Comuna, joined: boolean, memberCount?: number) {
  return {
    viewerIsMember: joined,
    viewerRole: joined ? current.viewerRole ?? 'member' : null,
    memberCount: memberCount ?? Math.max(
      0,
      current.memberCount + (joined ? (current.viewerIsMember ? 0 : 1) : (current.viewerIsMember ? -1 : 0)),
    ),
  };
}

export function updateComunaMembership(slug: string, joined: boolean, memberCount?: number): void {
  const current = queryClient.getQueryData<Comuna>(comunaKeys.detail(slug)) ?? readComunaSummary(slug);
  const privateComuna = current?.visibility === 'private';
  queryClient.setQueryData<ComunaDetails>(comunaKeys.detail(slug), (value) => {
    if (!value) return value;
    const next = { ...value, ...membershipFields(value, joined, memberCount) };
    // Sair remove as permissões antigas: gestão e publicação não podem sobreviver ao vínculo.
    if (!joined) delete next.viewerPermissions;
    return next;
  });
  queryClient.setQueryData<Comuna>(comunaKeys.summary(slug), (value) => (
    value ? { ...value, ...membershipFields(value, joined, memberCount) } : value
  ));
  // Em comuna pública a leitura não muda ao entrar/sair; só a privada abre/fecha conteúdo.
  if (privateComuna) {
    void queryClient.invalidateQueries({ queryKey: comunaKeys.posts(slug) });
    void queryClient.invalidateQueries({ queryKey: comunaKeys.square(slug) });
    if (!joined) queryClient.removeQueries({ queryKey: comunaKeys.pins(slug) });
    else void queryClient.invalidateQueries({ queryKey: comunaKeys.pins(slug) });
  }
}
