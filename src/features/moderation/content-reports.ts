/** Denúncias de publicação, comentário, perfil e comuna. A fila da praça e da biblioteca fica nos módulos delas. */
import type { IconName } from '@/components/icon';
import { apiRequest } from '@/lib/api/client';
import type { PageDto } from '@/lib/api/dto';
import { queryClient } from '@/lib/query/client';
import type { Page } from '@/lib/pagination';

import { DETAILS_MAX_LENGTH } from './constants';

export type ReportBucket = 'open' | 'closed';

export type ContentReport = {
  id: string;
  targetType: 'post' | 'comment' | 'profile' | 'comuna';
  targetId: string;
  reasonCode: string | null;
  reasonLabel: string;
  description: string | null;
  snapshot: string | null;
  status: string;
  escalated: boolean;
  scope: 'comuna' | 'platform';
  createdAt: string;
  targetAvailable: boolean;
  targetLabel: string | null;
  comunaSlug: string | null;
  targetAuthor: { id: string; handle: string; displayName: string } | null;
  actions: string[];
};

export const TARGET_LABEL: Record<ContentReport['targetType'], string> = {
  post: 'Publicação',
  comment: 'Comentário',
  profile: 'Perfil',
  comuna: 'Comuna',
};

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  reviewing: 'Em análise',
  resolved: 'Ação tomada',
  dismissed: 'Sem ação',
  removed: 'Encerrada',
};

export const ACTION_LABEL: Record<string, string> = {
  claim: 'Assumir análise',
  dismiss: 'Sem ação',
  remove: 'Remover conteúdo',
  remove_and_escalate: 'Remover e escalar',
  escalate: 'Escalar para a plataforma',
  restore: 'Restaurar conteúdo',
  suspend: 'Suspender conta',
  reactivate: 'Reativar conta',
  suspend_comuna: 'Suspender comuna',
  reactivate_comuna: 'Reativar comuna',
};

export const ACTION_ICON: Record<string, IconName> = {
  claim: 'shield',
  dismiss: 'close',
  remove: 'trash',
  remove_and_escalate: 'trash',
  escalate: 'arrowRight',
  restore: 'check',
  suspend: 'shield',
  reactivate: 'check',
  suspend_comuna: 'shield',
  reactivate_comuna: 'check',
};

/** Ações graves esperam a resposta do servidor. O texto explica o efeito real. */
export const GRAVE_CONFIRM: Record<string, { title: string; message: string; confirm: string }> = {
  suspend: {
    title: 'Suspender esta conta?',
    message: 'Ela não poderá usar o Popularia até ser reativada.',
    confirm: 'Suspender',
  },
  suspend_comuna: {
    title: 'Suspender esta comuna?',
    message: 'Ela some da busca e ninguém publica nela até a plataforma reativar. O que já existe fica guardado.',
    confirm: 'Suspender comuna',
  },
};

export function comunaReportsKey(slug: string, bucket: ReportBucket) {
  return ['comuna-reports', slug, bucket] as const;
}

export function platformReportsKey(bucket: ReportBucket) {
  return ['platform-reports', bucket] as const;
}

export function contentReportPayload(input: {
  targetType: ContentReport['targetType'];
  targetId: string;
  reasonCode: string;
  description: string;
}) {
  const description = input.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().slice(0, DETAILS_MAX_LENGTH);
  return {
    targetType: input.targetType,
    targetId: input.targetId,
    reasonCode: input.reasonCode,
    ...(description ? { description } : {}),
  };
}

export async function sendContentReport(input: {
  targetType: ContentReport['targetType'];
  targetId: string;
  reasonCode: string;
  description: string;
}) {
  await apiRequest('/reports', { auth: true, method: 'POST', body: contentReportPayload(input) });
}

function queuePath(slug: string | null, bucket: ReportBucket, cursor: string | null) {
  const params = new URLSearchParams({ bucket });
  if (cursor) params.set('cursor', cursor);
  const base = slug === null ? '/moderation/reports' : `/comunas/${encodeURIComponent(slug)}/content-reports`;
  return `${base}?${params.toString()}`;
}

export async function getContentReports(slug: string | null, bucket: ReportBucket, cursor: string | null, signal?: AbortSignal): Promise<Page<ContentReport>> {
  const page = await apiRequest<PageDto<ContentReport>>(queuePath(slug, bucket, cursor), { auth: true, signal });
  return { items: page.items, nextCursor: page.nextCursor };
}

export async function decideReport(id: string, action: string) {
  await apiRequest(`/moderation/reports/${encodeURIComponent(id)}/decision`, { auth: true, method: 'POST', body: { action } });
}

/** Atualiza a fila tocada, o alvo e as listas que ainda poderiam mostrá-lo. */
export function invalidateAfterModeration(comunaSlug: string | null) {
  if (comunaSlug) void queryClient.invalidateQueries({ queryKey: ['comuna-reports', comunaSlug] });
  void queryClient.invalidateQueries({ queryKey: ['platform-reports'] });
  void queryClient.invalidateQueries({ queryKey: ['feed'] });
  void queryClient.invalidateQueries({ queryKey: ['post'] });
  void queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
  void queryClient.invalidateQueries({ queryKey: ['search'] });
  if (comunaSlug) void queryClient.invalidateQueries({ queryKey: ['comuna-pins', comunaSlug] });
}
