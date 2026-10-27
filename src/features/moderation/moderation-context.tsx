/**
 * Estado local de denúncias e decisões de moderação.
 *
 * Nada sai do aparelho. Uma denúncia feita numa comuna que a própria pessoa
 * modera entra na fila dela, para o fluxo poder ser testado de ponta a ponta;
 * as demais ficam só registradas aqui.
 */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { DEMO_MODE } from '@/constants/config';
import { apiRequest } from '@/lib/api/client';
import { findComuna } from '@/features/lookup';
import { currentUser } from '@/mocks/users';
import type { ModerationLogEntry, ModerationReport, ReportTarget } from '@/types/models';

export type Decision = { label: string; reason: string; authorName: string };

type SubmitInput = { target: ReportTarget; reason: string; details: string };

type ModerationValue = {
  /** Denúncias enviadas neste aparelho que caem numa fila que a pessoa modera. */
  localReports: ModerationReport[];
  decisions: Record<string, Decision>;
  /** Registro local, do mais novo para o mais antigo. */
  localLog: ModerationLogEntry[];
  submitReport: (input: SubmitInput) => Promise<{ protocol: string; inMyQueue: boolean }>;
  decide: (report: ModerationReport, label: string) => void;
  undo: (reportId: string) => void;
};

const ModerationContext = createContext<ModerationValue | null>(null);

let counter = 0;

function logEntry(text: string): ModerationLogEntry {
  counter += 1;
  return { id: `local-log-${counter}`, createdAt: new Date().toISOString(), text };
}

export function ModerationProvider({ children }: { children: ReactNode }) {
  const [localReports, setLocalReports] = useState<ModerationReport[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [localLog, setLocalLog] = useState<ModerationLogEntry[]>([]);

  const submitReport = useCallback(async ({ target, reason, details }: SubmitInput) => {
    if (!DEMO_MODE) {
      await apiRequest('/reports', { auth: true, method: 'POST', body: { targetType: target.kind, targetId: target.id, reason: [reason, details.trim()].filter(Boolean).join(' · ').slice(0, 500) } });
      return { protocol: target.id, inMyQueue: false };
    }
    counter += 1;
    const protocol = `PA-${20930 + counter}`;
    const comuna = findComuna(target.comunaId);
    const inMyQueue = !!comuna && comuna.moderatorIds.includes(currentUser.id);
    if (comuna && inMyQueue) {
      const report: ModerationReport = {
        id: `local-report-${counter}`,
        comunaId: comuna.id,
        reason,
        reportCount: 1,
        author: target.author,
        where: target.where,
        text: target.excerpt,
        note: details.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setLocalReports((prev) => [report, ...prev]);
    }
    return { protocol, inMyQueue };
  }, []);

  const decide = useCallback((report: ModerationReport, label: string) => {
    setDecisions((prev) => ({
      ...prev,
      [report.id]: { label, reason: report.reason, authorName: report.author.name },
    }));
    setLocalLog((prev) => [
      logEntry(`Você: ${label.toLowerCase()} · ${report.author.name} (${report.reason.toLowerCase()}).`),
      ...prev,
    ]);
  }, []);

  const undo = useCallback((reportId: string) => {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[reportId];
      return next;
    });
    setLocalLog((prev) => [logEntry('Você desfez uma decisão de moderação.'), ...prev]);
  }, []);

  const value = useMemo(
    () => ({ localReports, decisions, localLog, submitReport, decide, undo }),
    [localReports, decisions, localLog, submitReport, decide, undo],
  );

  return <ModerationContext value={value}>{children}</ModerationContext>;
}

export function useModeration(): ModerationValue {
  const ctx = use(ModerationContext);
  if (!ctx) throw new Error('useModeration precisa estar dentro de <ModerationProvider>.');
  return ctx;
}
