import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { Colors, Spacing } from '@/constants/theme';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { ApiError, describeError } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { contentPolicy } from '@/lib/query/client';

import {
  ACTION_ICON,
  ACTION_LABEL,
  GRAVE_CONFIRM,
  STATUS_LABEL,
  TARGET_LABEL,
  comunaReportsKey,
  decideReport,
  getContentReports,
  invalidateAfterModeration,
  platformReportsKey,
  type ContentReport,
  type ReportBucket,
} from './content-reports';

const BUCKETS: TabOption<ReportBucket>[] = [
  { key: 'open', label: 'Pendentes' },
  { key: 'closed', label: 'Resolvidas' },
];

/** Fila paginada. `slug` null é a fila da plataforma. */
export function ContentReportQueue({ slug, heading }: { slug: string | null; heading: string }) {
  const [bucket, setBucket] = useState<ReportBucket>('open');
  const load = useCallback(
    (cursor: string | null, signal: AbortSignal) => getContentReports(slug, bucket, cursor, signal),
    [slug, bucket],
  );
  const key = slug === null ? platformReportsKey(bucket) : comunaReportsKey(slug, bucket);
  const page = useCachedPages({ queryKey: key, load, ...contentPolicy.post });
  const toast = useToast();
  const lock = useRef(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const commit = async (report: ContentReport, action: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(report.id);
    try {
      await decideReport(report.id, action);
      invalidateAfterModeration(report.comunaSlug ?? slug);
      toast.show('Decisão registrada.');
    } catch (error) {
      toast.show(describeError(error));
      if (error instanceof ApiError && [403, 404, 409].includes(error.status)) page.refresh();
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  };

  const decide = (report: ContentReport, action: string) => {
    const confirm = GRAVE_CONFIRM[action];
    if (!confirm) {
      void commit(report, action);
      return;
    }
    Alert.alert(confirm.title, confirm.message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: confirm.confirm, style: 'destructive', onPress: () => { void commit(report, action); } },
    ]);
  };

  const denied = page.error instanceof ApiError && page.error.status === 403;

  return (
    <View style={styles.section}>
      <AppText variant="label" color={Colors.muted}>{heading}</AppText>
      <UnderlineTabs options={BUCKETS} value={bucket} onChange={setBucket} />
      {page.status === 'loading' ? <AppText color={Colors.muted}>Carregando denúncias</AppText> : null}
      {page.status === 'error' && denied ? <StateView kind="empty" title="Acesso restrito" message="Você não pode ver esta fila." /> : null}
      {page.status === 'error' && !denied ? <StateView kind="error" message={describeError(page.error)} onRetry={page.refresh} /> : null}
      {page.status === 'success' ? page.items.map((report) => (
        <ReportRow key={report.id} report={report} busy={busyId === report.id} onDecide={(action) => decide(report, action)} />
      )) : null}
      {page.status === 'success' && page.items.length === 0 ? (
        <StateView kind="empty" title={bucket === 'open' ? 'Fila em dia' : 'Nada por aqui'} message={bucket === 'open' ? 'Nenhuma denúncia aguardando análise.' : 'Nenhuma denúncia resolvida nesta página.'} />
      ) : null}
      {page.hasMore || page.loadMoreError ? (
        <EditorialAction label={page.loadingMore ? 'Carregando…' : 'Carregar mais'} icon="chevronDown" disabled={page.loadingMore} onPress={page.loadMore} />
      ) : null}
    </View>
  );
}

function ReportRow({ report, busy, onDecide }: { report: ContentReport; busy: boolean; onDecide: (action: string) => void }) {
  const author = report.targetAuthor;
  const where = [TARGET_LABEL[report.targetType] ?? report.targetType, report.targetLabel].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <AppText variant="label" color={Colors.ink}>{report.reasonLabel}</AppText>
        <AppText variant="caption" color={Colors.muted}>{formatRelative(report.createdAt)}</AppText>
      </View>
      <AppText variant="caption" color={Colors.muted}>
        {where} · {STATUS_LABEL[report.status] ?? report.status}{report.escalated ? ' · Escalada' : ''}
      </AppText>
      <AppText>
        {report.targetAvailable ? (report.snapshot || 'Sem trecho de texto.') : 'O alvo não está mais disponível.'}
      </AppText>
      {author ? <AppText variant="caption" color={Colors.inkSoft}>{author.displayName} · @{author.handle}</AppText> : null}
      {report.description ? <AppText color={Colors.inkSoft}>Contexto: {report.description}</AppText> : null}
      <View style={styles.actions} pointerEvents={busy ? 'none' : 'auto'}>
        {report.actions.map((action) => (
          <EditorialAction
            key={action}
            label={ACTION_LABEL[action] ?? action}
            icon={ACTION_ICON[action] ?? 'flag'}
            tone={action === 'suspend' || action === 'suspend_comuna' || action === 'remove' || action === 'remove_and_escalate' ? 'red' : 'paper'}
            disabled={busy}
            accessibilityLabel={ACTION_LABEL[action] ?? action}
            onPress={() => onDecide(action)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three, paddingTop: Spacing.four },
  row: { gap: Spacing.two, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, padding: Spacing.three },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two },
});
