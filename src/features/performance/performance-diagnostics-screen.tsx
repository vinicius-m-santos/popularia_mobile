import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { formatStamp, plural } from '@/lib/format';
import { performanceDiagnosticsAvailable, type PerformanceSnapshot } from '@/lib/performance';
import { goBack } from '@/lib/routes';

import {
  commitComponentDiagnostics,
  commitTotals,
  environmentLabel,
  formatElapsed,
  formatMs,
  recentListLoads,
  recentRequests,
  requestScreenDiagnostics,
  resetPerformanceMeasurement,
  sharePerformanceReport,
  startPerformanceMeasurement,
  totalRequestRetries,
  videoDiagnostics,
} from './diagnostics';
import { usePerformanceSnapshot } from './use-performance-snapshot';

/**
 * Diagnóstico local da instrumentação de performance (POP-5).
 *
 * A tela não coleta nada por conta própria: lê o snapshot existente e só liga o
 * gate quando a pessoa toca em "Iniciar medição". Fora de desenvolvimento e
 * staging a rota nem é registrada; a checagem aqui é a segunda barreira.
 */
export function PerformanceDiagnosticsScreen() {
  if (!performanceDiagnosticsAvailable()) return <UnavailableScreen />;
  return <DiagnosticsContent />;
}

function UnavailableScreen() {
  return (
    <Screen>
      <EditorialHeader title="Diagnóstico" onBack={goBack} />
      <StateView
        kind="empty"
        title="Diagnóstico indisponível"
        message="Esta tela existe apenas em desenvolvimento e staging."
      />
    </Screen>
  );
}

function DiagnosticsContent() {
  const toast = useToast();
  const { snapshot, readAt, refresh } = usePerformanceSnapshot();
  const [exporting, setExporting] = useState(false);

  const hasSession = snapshot.sessionId !== null;
  const active = snapshot.enabled && hasSession;
  const statusTitle = active ? 'Coleta ativa' : snapshot.enabled ? 'Instrumentação ligada' : 'Coleta parada';
  const statusCaption = active
    ? 'Sessão local ativa.'
    : snapshot.enabled
      ? 'Instrumentação ligada; a primeira requisição cria a sessão.'
      : 'Nenhuma métrica é coletada enquanto a medição está parada.';
  const primaryLabel = hasSession ? 'Resetar medição' : 'Iniciar medição';

  const handlePrimary = () => {
    if (hasSession) {
      const reset = resetPerformanceMeasurement();
      toast.show(reset ? 'Medição zerada.' : 'Não foi possível zerar a medição.');
      refresh();
      return;
    }
    const started = startPerformanceMeasurement();
    toast.show(started ? 'Medição iniciada.' : 'Não foi possível iniciar a medição neste ambiente.');
    refresh();
  };

  const openHarness = () => {
    // Abrir o harness sem sessão montaria os cartões sem registrar commits.
    if (!hasSession) {
      if (!startPerformanceMeasurement()) {
        toast.show('Não foi possível iniciar a medição neste ambiente.');
        return;
      }
      toast.show('Medição iniciada.');
      refresh();
    }
    router.push('/diagnostico-performance-harness' as never);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await sharePerformanceReport();
      toast.show(result === 'shared'
        ? 'JSON pronto para compartilhar.'
        : result === 'downloaded'
          ? 'Download do JSON iniciado.'
          : 'JSON copiado para a área de transferência.');
    } catch {
      toast.show('Não foi possível exportar o JSON.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <EditorialHeader
        title="Diagnóstico"
        subtitle={`Performance · ${environmentLabel()}`}
        onBack={goBack}
        actions={[{ icon: 'replay', label: 'Atualizar leitura', onPress: refresh }]}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={styles.content}>
        <View style={styles.note}>
          <AppText variant="label" color={Colors.red}>Performance · uso interno</AppText>
          <AppText variant="caption">
            Disponível só em desenvolvimento e staging. A coleta fica na memória do aparelho e não envia nada para a rede.
          </AppText>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View style={[styles.statusDot, active && styles.statusDotActive]} />
            <View style={styles.statusCopy}>
              <AppText style={styles.statusTitle}>{statusTitle}</AppText>
              <AppText variant="caption">{statusCaption}</AppText>
            </View>
          </View>
          <View style={styles.statusGrid}>
            <StatusItem label="Ambiente" value={environmentLabel()} />
            <StatusItem label="Plataforma" value={platformLabel(snapshot.platform)} />
            <StatusItem testID="status-duration-value" label="Decorrido" value={hasSession ? formatElapsed(snapshot.durationMs) : '—'} />
            <StatusItem label="Descartes" value={String(snapshot.dropped)} />
          </View>
          <View style={styles.sessionLine}>
            <AppText variant="label" color={Colors.inkSoft}>Sessão</AppText>
            <AppText variant="caption" selectable numberOfLines={1}>{snapshot.sessionId ?? 'sem sessão'}</AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.actionRow}>
            <EditorialAction
              label={primaryLabel}
              icon={hasSession ? 'replay' : 'play'}
              tone="red"
              labelVariant="button"
              onPress={handlePrimary}
              style={styles.action}
            />
            <EditorialAction
              label={exporting ? 'Exportando…' : 'Exportar JSON'}
              icon="share"
              labelVariant="button"
              disabled={!hasSession || exporting}
              onPress={() => { void handleExport(); }}
              style={styles.action}
            />
          </View>
          <AppText variant="caption">
            Inicie, navegue pelo app e volte. A leitura é atualizada ao retornar para esta tela.
          </AppText>
        </View>

        {hasSession ? (
          <DiagnosticsResults snapshot={snapshot} readAt={readAt} />
        ) : (
          <View style={styles.emptyCard}>
            <AppText style={styles.emptyTitle}>Nenhuma coleta iniciada</AppText>
            <AppText variant="caption">
              Toque em “Iniciar medição” para criar uma sessão. Sem isso, não há métricas para consultar nem exportar.
            </AppText>
          </View>
        )}

        <HarnessSection onOpen={openHarness} />
      </ScrollView>
    </Screen>
  );
}

function DiagnosticsResults({ snapshot, readAt }: { snapshot: PerformanceSnapshot; readAt: number }) {
  const screens = requestScreenDiagnostics(snapshot);
  const commits = commitComponentDiagnostics(snapshot);
  const commitSummary = commitTotals(snapshot.commits);
  const lists = recentListLoads(snapshot);
  const requests = recentRequests(snapshot);
  const video = videoDiagnostics(snapshot);
  const retries = totalRequestRetries(snapshot);

  return (
    <>
      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="Resumo" />
        <View style={styles.metricGrid}>
          <MetricCard testID="metric-requests" label="Requests lógicas" value={String(snapshot.counters.logicalRequests)} />
          <MetricCard testID="metric-http-attempts" label="Tentativas HTTP" value={String(snapshot.counters.httpAttempts)} />
          <MetricCard testID="metric-retries" label="Retries" value={String(retries)} detail="tentativas extras" />
          <MetricCard testID="metric-commits" label="Commits React" value={String(snapshot.counters.profilerCommits)} />
          <MetricCard testID="metric-list-loads" label="onLoad FlashList" value={String(snapshot.counters.listLoads)} />
          <MetricCard testID="metric-video-mounts" label="Montagens de vídeo" value={String(snapshot.counters.videoMounts)} />
        </View>
        <AppText variant="caption">
          Retries soma as tentativas extras das requests concluídas. Tentativas em voo aparecem só em “Tentativas HTTP”.
        </AppText>
      </View>

      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="Requests por tela" />
        {screens.length > 0 ? (
          <DataCard>
            {screens.map((screen, index) => (
              <DataRow
                key={screen.screen}
                title={screen.screen}
                firstLine={`${plural(screen.count, 'request', 'requests')} · ${screen.retries} retries · ${screen.refreshCount} refresh`}
                secondLine={`${screen.errors} erros · ${screen.aborted} abortadas · média ${formatMs(screen.averageMs)}`}
                last={index === screens.length - 1}
              />
            ))}
          </DataCard>
        ) : <EmptyMetric>Nenhuma request concluída nesta sessão.</EmptyMetric>}
      </View>

      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="Últimas requests" />
        {requests.length > 0 ? (
          <DataCard>
            {requests.map((request, index) => (
              <DataRow
                key={`${request.id}-${index}`}
                title={`${request.method} ${request.path}`}
                firstLine={`${plural(request.attempts, 'tentativa', 'tentativas')} · ${formatMs(request.durationMs)} · ${request.status ?? 'sem status'}`}
                secondLine={`${performanceActionLabel(request.scope.action)} · ${requestOutcomeLabel(request.outcome)}${request.attempts > 1 ? ' · retry' : ''}`}
                last={index === requests.length - 1}
              />
            ))}
          </DataCard>
        ) : <EmptyMetric>Nenhuma request concluída nesta sessão.</EmptyMetric>}
        {requests.length > 0 ? (
          <AppText variant="caption">Mais recentes primeiro. Mostrando {requests.length} de {snapshot.requests.length} registros.</AppText>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="Commits do React" />
        <View style={styles.metricGrid}>
          <MetricCard testID="metric-commit-total" label="Commits" value={String(commitSummary.commits)} detail={`${plural(commitSummary.instances, 'instância', 'instâncias')}`} />
          <MetricCard testID="metric-commit-duration" label="actualDuration total" value={formatMs(commitSummary.totalActualMs)} detail={`máx. ${formatMs(commitSummary.maxActualMs)}`} />
        </View>
        {commits.length > 0 ? (
          <DataCard>
            {commits.map((component, index) => (
              <DataRow
                key={component.component}
                title={component.component}
                firstLine={`${plural(component.commits, 'commit', 'commits')} · ${plural(component.instances, 'instância', 'instâncias')}`}
                secondLine={`média ${formatMs(component.averageActualMs)} · máx. ${formatMs(component.maxActualMs)} · ${component.mountCommits} mount · ${component.updateCommits} update`}
                last={index === commits.length - 1}
              />
            ))}
          </DataCard>
        ) : <EmptyMetric>Nenhum commit de PostCard ou CommentRow registrado.</EmptyMetric>}
        <AppText variant="caption">
          actualDuration vem do React Profiler, inclui o overhead do Profiler e só é comparável entre builds com profiling.
        </AppText>
      </View>

      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="FlashList · onLoad" />
        {lists.length > 0 ? (
          <DataCard>
            {lists.map((list, index) => (
              <DataRow
                key={`${list.list}-${list.atMs}-${index}`}
                title={list.list}
                firstLine={`${formatMs(list.elapsedTimeInMs)} · ${plural(list.itemCount, 'item', 'itens')}`}
                secondLine={`aos ${formatMs(list.atMs)} da sessão`}
                last={index === lists.length - 1}
              />
            ))}
          </DataCard>
        ) : <EmptyMetric>Nenhum onLoad de FlashList registrado.</EmptyMetric>}
        <AppText variant="caption">onLoad é o tempo informado pela FlashList até desenhar os itens; não é TTI.</AppText>
      </View>

      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="Vídeos" />
        <View style={styles.metricGrid}>
          <MetricCard testID="metric-video-mounted" label="Players montados" value={String(video.mountedNow)} />
          <MetricCard testID="metric-video-playing" label="Tocando agora" value={String(video.playingNow)} />
          <MetricCard testID="metric-ttff-average" label="TTFF médio" value={video.firstFrameCount > 0 ? formatMs(video.averageFirstFrameMs) : '—'} />
          <MetricCard testID="metric-ttff-max" label="TTFF máximo" value={video.firstFrameCount > 0 ? formatMs(video.firstFrameMaxMs) : '—'} />
          <MetricCard testID="metric-video-first-frame" label="Primeiros quadros" value={String(video.firstFrameCount)} />
          <MetricCard testID="metric-video-errors" label="Erros de vídeo" value={String(video.errorCount)} />
        </View>
        <AppText variant="caption">
          TTFF vai do pedido de reprodução ao primeiro quadro, uma vez por player. “Players montados” e “Tocando agora” são o instante da leitura.
        </AppText>
      </View>

      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="Pôsteres de vídeo" />
        <View style={styles.metricGrid}>
          <MetricCard testID="metric-poster-cache" label="Cache" value={`${snapshot.posters.size}/${snapshot.posters.capacity}`} detail={`${snapshot.posters.retained} em uso`} />
          <MetricCard testID="metric-poster-hits" label="Hits" value={String(snapshot.posters.hits)} detail={`${snapshot.posters.misses} misses`} />
          <MetricCard testID="metric-poster-generations" label="Gerações" value={String(snapshot.posters.generationRequests)} detail={`${snapshot.posters.dedupedGenerations} compartilhadas`} />
          <MetricCard testID="metric-poster-evictions" label="Evictados" value={String(snapshot.posters.evictions)} detail={`${snapshot.posters.generationFailures} falhas`} />
          <MetricCard testID="metric-poster-discarded" label="Descartados" value={String(snapshot.posters.discardedGenerations)} detail={`${snapshot.posters.clears} limpezas`} />
        </View>
        <AppText variant="caption">
          Estado do processo, não da sessão. O cache conta miniaturas, não bytes: não é medição de memória.
        </AppText>
      </View>

      <AppText variant="caption" style={styles.readNote}>
        Leitura às {new Date(readAt).toLocaleTimeString('pt-BR')}
        {snapshot.startedAt ? ` · início ${formatStamp(snapshot.startedAt)}` : ''}
      </AppText>
    </>
  );
}

function HarnessSection({ onOpen }: { onOpen: () => void }) {
  return (
    <View style={styles.section}>
      <SectionHeading appearance="editorial" label="Harness de renderização" />
      <View style={styles.harnessCard}>
        <AppText style={styles.harnessTitle}>20 cartões montados de uma vez</AppText>
        <AppText variant="caption">
          Usa o dataset determinístico de QA (240 posts, 160 fotos e 80 vídeos) para exercitar renderização e like.
          Os vídeos ficam desligados neste cenário para não disputar players.
        </AppText>
        <EditorialAction
          label="Abrir harness de 20 posts"
          icon="arrowRight"
          iconPosition="trailing"
          labelVariant="button"
          onPress={onOpen}
        />
      </View>
    </View>
  );
}

function MetricCard({ label, value, detail, testID }: { label: string; value: string; detail?: string; testID?: string }) {
  return (
    <View style={styles.metricCard} testID={testID}>
      <AppText variant="label" color={Colors.muted}>{label}</AppText>
      <AppText style={styles.metricValue} testID={testID ? `${testID}-value` : undefined}>{value}</AppText>
      {detail ? <AppText variant="caption">{detail}</AppText> : null}
    </View>
  );
}

function StatusItem({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.statusItem}>
      <AppText variant="label" color={Colors.inkSoft}>{label}</AppText>
      <AppText variant="bodyStrong" numberOfLines={1} testID={testID}>{value}</AppText>
    </View>
  );
}

function DataCard({ children }: { children: ReactNode }) {
  return <View style={styles.dataCard}>{children}</View>;
}

function DataRow({ title, firstLine, secondLine, last = false }: {
  title: string;
  firstLine: string;
  secondLine: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.dataRow, last && styles.dataRowLast]}>
      <AppText style={styles.dataTitle} numberOfLines={2}>{title}</AppText>
      <AppText variant="caption">{firstLine}</AppText>
      <AppText variant="caption">{secondLine}</AppText>
    </View>
  );
}

function EmptyMetric({ children }: { children: ReactNode }) {
  return (
    <View style={styles.emptyMetric}>
      <AppText variant="caption">{children}</AppText>
    </View>
  );
}

function requestOutcomeLabel(outcome: string): string {
  if (outcome === 'success') return 'sucesso';
  if (outcome === 'error') return 'erro';
  if (outcome === 'aborted') return 'abortada';
  return outcome;
}

function performanceActionLabel(action: string): string {
  if (action === 'initial') return 'inicial';
  if (action === 'refresh') return 'refresh';
  if (action === 'pagination') return 'paginação';
  if (action === 'user') return 'interação';
  if (action === 'session') return 'sessão';
  if (action === 'other') return 'outro';
  return action;
}

function platformLabel(platform: string): string {
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  if (platform === 'web') return 'Web';
  return platform;
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.six,
  },
  note: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.strawLight,
  },
  statusCard: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
    ...Shadows.offsetSmall,
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.strawDark,
  },
  statusDotActive: {
    backgroundColor: Colors.red,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  statusTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 18,
    lineHeight: 26,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  statusItem: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 128,
    gap: 1,
  },
  sessionLine: {
    gap: 1,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
  },
  actions: {
    gap: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    borderRadius: Radius.sm,
  },
  section: {
    gap: Spacing.two,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 140,
    minHeight: 86,
    justifyContent: 'space-between',
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  metricValue: {
    fontFamily: Fonts.extrabold,
    fontSize: 24,
    lineHeight: 32,
  },
  dataCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  dataRow: {
    gap: 1,
    padding: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  dataRowLast: {
    borderBottomWidth: 0,
  },
  dataTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 23,
  },
  emptyCard: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  emptyTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
  },
  emptyMetric: {
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cream,
  },
  harnessCard: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  harnessTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
  },
  readNote: {
    textAlign: 'center',
  },
});
