import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DEMO_MODE } from '@/constants/config';
import { getComuna } from '@/features/comunas/api';
import { toUser } from '@/features/posts/api';
import { getSquareReports, resolveSquareReport } from '@/features/squares/api';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { PillButton } from '@/components/pill-button';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { CheckboxMark, RadioMark } from '@/components/choice-marks';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { StatRow } from '@/components/stat-row';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { ApiError, describeError, NotFoundError } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { goBack } from '@/lib/routes';
import type { ModerationReport } from '@/types/models';

import { LibraryReportQueue } from '@/features/library/report-queue';

import { DarkButton } from './actions-sheet';
import { ContentReportQueue } from './content-queue';
import { NotModeratorError } from './api';
import { RESTRICTIONS, type RestrictionId } from './constants';
import { useModeration, type Decision } from './moderation-context';
import { useModerationQueue } from './use-moderation-queue';

type ModTab = 'fila' | 'registro';

/** Ferramentas de moderação de uma comuna; fila persistida na API e demonstração local. */
export default function ModerationScreen() {
  return DEMO_MODE ? <DemoModerationScreen /> : <ConnectedModerationScreen />;
}

function ConnectedModerationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const comuna = useAsyncData(useCallback(() => getComuna(id), [id]));
  const reports = usePaginatedData(useCallback((cursor: string | null) => getSquareReports(id, cursor), [id]));
  const toast = useToast();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const resolve = async (reportId: string, status: 'dismissed' | 'removed') => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await resolveSquareReport(id, reportId, status); reports.refresh(); toast.show('Decisão registrada.'); }
    catch (e) { toast.show(describeError(e)); if (e instanceof ApiError && [403, 404].includes(e.status)) reports.refresh(); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Screen edges={['top', 'left', 'right', 'bottom']}>
    <View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><AppText variant="heading">Moderação</AppText></View>
    {reports.status === 'loading' ? <StateView kind="loading" message="Carregando denúncias" /> : reports.status === 'error' ? <StateView kind="error" message={describeError(reports.error)} onRetry={reports.refresh} /> : <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.queue}>
      {typeof id === 'string' ? <ContentReportQueue slug={id} heading="Publicações e comentários" /> : null}
      <AppText variant="label" color={Colors.muted}>Praça</AppText>
      {reports.items.map((r) => {
        const m = r.message;
        if (!m?.author || m.status !== 'published') return <View key={r.id}><AppText variant="caption">Conteúdo indisponível.</AppText><PillButton label="Encerrar denúncia" disabled={busy} variant="outline" onPress={() => { void resolve(r.id, 'dismissed'); }} /></View>;
        const report: ModerationReport = { id: r.id, comunaId: id, reason: r.reason, reportCount: 1, author: toUser(m.author), where: `Praça · ${comuna.data?.name ?? ''}`, text: m.body ?? `Figurinha: ${m.sticker?.label ?? ''}`, createdAt: r.createdAt };
        return <View key={r.id} pointerEvents={busy ? 'none' : 'auto'}><ReportCard report={report} onKeep={() => { void resolve(r.id, 'dismissed'); }} onRemove={m.viewer.canRemove ? () => { void resolve(r.id, 'removed'); } : undefined} /></View>;
      })}
      {reports.items.length === 0 ? <StateView kind="empty" title="Fila em dia" message="Nenhuma denúncia aguardando análise." /> : null}
      {reports.hasMore || reports.loadMoreError ? <PillButton label="Carregar mais denúncias" onPress={reports.loadMore} disabled={reports.loadingMore} /> : null}
      <LibraryReportQueue comuna={id} />
      <PillButton label="Atualizar fila" onPress={reports.refresh} variant="outline" />
    </ScrollView>}
  </Screen>;
}

function DemoModerationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queue = useModerationQueue(id);
  const { decide, undo } = useModeration();
  const toast = useToast();
  const [tab, setTab] = useState<ModTab>('fila');
  const [restricting, setRestricting] = useState<ModerationReport | null>(null);

  const { overview } = queue;
  const comunaName = overview.data ? `c/ ${overview.data.comuna.name}` : '';

  const header = (
    <View style={styles.bar}>
      <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
      <View style={styles.barTitle}>
        <AppText style={styles.barHeading} accessibilityRole="header">
          Moderação
        </AppText>
        {comunaName ? (
          <AppText style={styles.barSub} color={Colors.muted} numberOfLines={1}>
            {comunaName}
          </AppText>
        ) : null}
      </View>
      <View style={styles.barSpacer} />
    </View>
  );

  if (overview.status === 'loading') {
    return (
      <Screen>
        {header}
        <StateView kind="loading" message="Carregando a fila" />
      </Screen>
    );
  }

  if (overview.status === 'error' || !overview.data) {
    const denied = overview.error instanceof NotModeratorError;
    const missing = overview.error instanceof NotFoundError;
    return (
      <Screen>
        {header}
        {denied || missing ? (
          <StateView
            kind="empty"
            title={missing ? 'Comuna não encontrada' : 'Acesso restrito'}
            message={missing ? 'O link pode estar errado.' : 'Só quem modera esta comuna pode ver a fila de denúncias.'}
          />
        ) : (
          <StateView kind="error" message="Não conseguimos carregar a fila." onRetry={overview.reload} />
        )}
      </Screen>
    );
  }

  const data = overview.data;
  const resolve = (report: ModerationReport, label: string) => {
    decide(report, label);
    toast.show(`${label}. Decisão registrada só neste aparelho.`);
  };

  const tabs: TabOption<ModTab>[] = [
    { key: 'fila', label: `Fila (${queue.pending})` },
    { key: 'registro', label: 'Registro' },
  ];

  return (
    <Screen>
      {header}
      <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} stickyHeaderIndices={[1]} contentContainerStyle={styles.scroll}>
        <View style={[styles.column, styles.intro]}>
          <StatRow
            stats={[
              { value: String(queue.pending), label: 'Pendentes' },
              { value: String(data.resolvedLast30Days + queue.resolvedHere), label: 'Resolvidas · 30 dias' },
              { value: data.averageResponse, label: 'Tempo médio' },
            ]}
          />
          <AppText style={styles.introText} color={Colors.inkSoft}>
            Decisões ficam registradas para toda a moderação. Quem recebe uma restrição é avisado do motivo e pode
            pedir revisão.
          </AppText>
        </View>

        <View style={styles.tabs}>
          <View style={styles.column}>
            <UnderlineTabs options={tabs} value={tab} onChange={setTab} height={46} />
          </View>
        </View>

        <View style={styles.column}>
          {tab === 'fila' ? (
            <View style={styles.queue}>
              {queue.reports.map((r) => {
                const decision = queue.decisions[r.id];
                return decision ? (
                  <ResolvedRow key={r.id} report={r} decision={decision} onUndo={() => undo(r.id)} />
                ) : (
                  <ReportCard
                    key={r.id}
                    report={r}
                    onKeep={() => resolve(r, 'Mantido na comuna')}
                    onRemove={() => resolve(r, 'Conteúdo removido')}
                    onRestrict={() => setRestricting(r)}
                  />
                );
              })}
              {queue.pending === 0 ? (
                <View style={styles.clear} accessibilityLiveRegion="polite">
                  <AppText style={styles.clearTitle}>Fila em dia</AppText>
                  <AppText style={styles.clearText} color={Colors.inkSoft}>
                    Nenhuma denúncia aguardando análise.
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.log}>
              {queue.log.map((entry) => (
                <View key={entry.id} style={styles.logRow}>
                  <AppText style={styles.logWhen}>{formatRelative(entry.createdAt)}</AppText>
                  <AppText style={styles.logText}>{entry.text}</AppText>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <RestrictSheet
        report={restricting}
        onClose={() => setRestricting(null)}
        onApply={(label) => {
          if (restricting) resolve(restricting, label);
          setRestricting(null);
        }}
      />
    </Screen>
  );
}

type CardProps = {
  report: ModerationReport;
  onKeep: () => void;
  onRestrict?: () => void;
  onRemove?: () => void;
};

function ReportCard({ report, onKeep, onRestrict, onRemove }: CardProps) {
  const { author } = report;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.reasonTag}>
          <AppText style={styles.reasonTagText} color={Colors.cream}>
            {report.reason}
          </AppText>
        </View>
        <AppText style={styles.mono} color={Colors.muted}>
          {report.reportCount} {report.reportCount === 1 ? 'denúncia' : 'denúncias'}
        </AppText>
        <View style={styles.flex} />
        <AppText style={styles.mono} color={Colors.muted}>
          {formatRelative(report.createdAt)}
        </AppText>
      </View>
      <AppText style={styles.where} color={Colors.muted}>
        {report.where}
      </AppText>
      <View
        style={styles.quote}
        accessible
        accessibilityLabel={`${author.name}, @${author.handle}, escreveu: ${report.text}`}>
        <Avatar initials={author.initials} tone={author.tone} size={30} userId={author.id} imageUrl={author.avatarUrl} />
        <View style={styles.flex}>
          <AppText style={styles.quoteName}>
            {author.name}{' '}
            <AppText style={styles.quoteHandle} color={Colors.muted}>
              @{author.handle}
            </AppText>
          </AppText>
          <AppText style={styles.quoteText}>{report.text}</AppText>
        </View>
      </View>
      {report.note ? (
        <AppText style={styles.reporterNote} color={Colors.inkSoft}>
          <AppText style={[styles.reporterNote, styles.strong]}>Quem denunciou:</AppText> “{report.note}”
        </AppText>
      ) : null}
      <View style={styles.decisions}>
        <DecisionButton label="Manter" onPress={onKeep} hint={`Mantém o conteúdo de ${author.name}`} />
        {onRestrict ? <DecisionButton label="Restringir" onPress={onRestrict} hint={`Escolhe uma restrição para ${author.name}`} /> : null}
        {onRemove ? <DecisionButton label="Remover" onPress={onRemove} dark hint={`Remove o conteúdo de ${author.name}`} /> : null}
      </View>
    </View>
  );
}

function DecisionButton({ label, onPress, dark = false, hint }: { label: string; onPress: () => void; dark?: boolean; hint: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => [styles.decision, dark && styles.decisionDark, pressed && styles.pressed]}>
      <AppText style={styles.decisionLabel} color={dark ? Colors.cream : Colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ResolvedRow({ report, decision, onUndo }: { report: ModerationReport; decision: Decision; onUndo: () => void }) {
  return (
    <View style={styles.resolved}>
      <View style={styles.resolvedIcon}>
        <Icon name="check" size={14} color={Colors.cream} />
      </View>
      <View style={styles.flex}>
        <AppText style={styles.resolvedLabel}>{decision.label}</AppText>
        <AppText style={styles.resolvedSub} color={Colors.inkSoft}>
          Por você · agora · {report.reason} · {report.author.name}
        </AppText>
      </View>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel={`Desfazer: ${decision.label}`}
        style={styles.undo}>
        <AppText style={styles.undoLabel} color={Colors.red}>
          Desfazer
        </AppText>
      </Pressable>
    </View>
  );
}

type RestrictSheetProps = {
  report: ModerationReport | null;
  onClose: () => void;
  onApply: (label: string) => void;
};

function RestrictSheet({ report, onClose, onApply }: RestrictSheetProps) {
  const [pick, setPick] = useState<RestrictionId>('mute');
  const [notify, setNotify] = useState(true);
  const chosen = RESTRICTIONS.find((r) => r.id === pick) ?? RESTRICTIONS[0];

  return (
    <BottomSheet visible={report !== null} onClose={onClose}>
      {report ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <AppText variant="label" color={Colors.muted} style={styles.sheetKicker}>
              Moderação
            </AppText>
            <IconButton icon="close" size={18} accessibilityLabel="Fechar" onPress={onClose} style={styles.sheetClose} />
          </View>
          <AppText style={styles.sheetTitle} accessibilityRole="header">
            Restringir @{report.author.handle}
          </AppText>
          <View role="radiogroup">
            {RESTRICTIONS.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => setPick(o.id)}
                role="radio"
                accessibilityState={{ checked: pick === o.id }}
                accessibilityLabel={`${o.title}. ${o.description}`}
                style={styles.option}>
                <RadioMark selected={pick === o.id} />
                <View style={styles.flex}>
                  <AppText style={styles.optionTitle}>{o.title}</AppText>
                  <AppText style={styles.optionText} color={Colors.muted}>
                    {o.description}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setNotify(!notify)}
            role="checkbox"
            accessibilityState={{ checked: notify }}
            style={styles.check}>
            <CheckboxMark checked={notify} />
            <AppText style={styles.checkLabel}>Enviar o motivo para a pessoa</AppText>
          </Pressable>
          <DarkButton
            label="Aplicar restrição"
            onPress={() => onApply(chosen.result + (notify ? ' · motivo enviado' : ''))}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  barTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  barHeading: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 23,
    textTransform: 'uppercase',
  },
  barSub: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  barSpacer: {
    width: 44,
  },
  scroll: {
    paddingBottom: Spacing.seven,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  intro: {
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  introText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: Spacing.three,
    marginBottom: 14,
  },
  tabs: {
    backgroundColor: Colors.cream,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  queue: {
    paddingTop: 14,
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: 14,
    backgroundColor: Colors.paper,
    padding: 14,
    gap: Spacing.two + 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  reasonTag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.ink,
  },
  reasonTagText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mono: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
  },
  where: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  quote: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.cream,
  },
  quoteName: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  quoteHandle: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
  },
  quoteText: {
    fontSize: 14.5,
    lineHeight: 20,
    marginTop: 2,
  },
  reporterNote: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  strong: {
    fontFamily: Fonts.bold,
  },
  decisions: {
    flexDirection: 'row',
    gap: 6,
  },
  decision: {
    flex: 1,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionDark: {
    backgroundColor: Colors.ink,
  },
  decisionLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  resolved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingVertical: Spacing.three,
    paddingHorizontal: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.straw,
  },
  resolvedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolvedLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
  },
  resolvedSub: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 1,
  },
  undo: {
    minHeight: 40,
    paddingHorizontal: Spacing.one,
    justifyContent: 'center',
  },
  undoLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 13,
    lineHeight: 17,
  },
  clear: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.one,
  },
  clearTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 28,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  clearText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.one,
  },
  log: {
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.five,
  },
  logRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  logWhen: {
    width: 52,
    paddingTop: 2,
    fontFamily: Fonts.monoSemibold,
    fontSize: 10.5,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  logText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
  },
  sheet: {
    gap: Spacing.three,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetKicker: {
    fontSize: 10.5,
  },
  sheetClose: {
    marginRight: -10,
  },
  sheetTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 32,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
  },
  optionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  optionText: {
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 2,
  },
  check: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
