import { useCallback, useMemo } from 'react';

import { useMe } from '@/features/account/account-context';
import { useAsyncData } from '@/hooks/use-async-data';

import { getModeration } from './api';
import { useModeration } from './moderation-context';

/** Fila de uma comuna: denúncias da API somadas às enviadas neste aparelho, com as decisões locais. */
export function useModerationQueue(comunaId: string) {
  const me = useMe();
  const load = useCallback(() => getModeration(comunaId, me.id), [comunaId, me.id]);
  const overview = useAsyncData(load);
  const { localReports, decisions, localLog } = useModeration();

  return useMemo(() => {
    const reports = [...localReports.filter((r) => r.comunaId === comunaId), ...(overview.data?.reports ?? [])];
    const pending = reports.filter((r) => !decisions[r.id]).length;
    const resolvedHere = reports.length - pending;
    const log = [...localLog, ...(overview.data?.log ?? [])];
    return { overview, reports, pending, resolvedHere, log, decisions };
  }, [overview, localReports, comunaId, decisions, localLog]);
}
