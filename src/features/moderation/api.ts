/** Acesso à fila de moderação de uma comuna. Só quem modera a comuna pode ver. */
import { USE_MOCKS } from '@/constants/config';
import { findComuna, findUser } from '@/features/lookup';
import { NotFoundError } from '@/lib/errors';
import { mockDelay } from '@/lib/mock-delay';
import { moderationLog, reports } from '@/mocks/moderation';
import type { ModerationOverview, ModerationReport } from '@/types/models';

/** A pessoa não modera a comuna pedida. */
export class NotModeratorError extends Error {
  constructor() {
    super('Você não modera esta comuna');
    this.name = 'NotModeratorError';
  }
}

export async function getModeration(comunaId: string, viewerId: string): Promise<ModerationOverview> {
  if (!USE_MOCKS) throw new Error('A integração com a API ainda não foi implementada.');
  const comuna = findComuna(comunaId);
  if (!comuna) throw new NotFoundError('Comuna');
  if (!comuna.moderatorIds.includes(viewerId)) throw new NotModeratorError();

  const queue = reports
    .filter((r) => r.comunaId === comunaId)
    .flatMap((r): ModerationReport[] => {
      const author = findUser(r.authorId);
      return author
        ? [
            {
              id: r.id,
              comunaId: r.comunaId,
              reason: r.reason,
              reportCount: r.reportCount,
              author,
              where: r.where,
              text: r.text,
              note: r.note,
              createdAt: r.createdAt,
            },
          ]
        : [];
    });

  return mockDelay({
    comuna,
    reports: queue,
    log: moderationLog[comunaId] ?? [],
    resolvedLast30Days: 12,
    averageResponse: '4 h',
  });
}
