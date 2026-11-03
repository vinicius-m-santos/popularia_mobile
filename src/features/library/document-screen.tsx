import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { Icon } from '@/components/icon';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { getComuna } from '@/features/comunas/api';
import { shareDestination } from '@/features/links/share';
import { REPORT_REASONS } from '@/features/moderation/constants';
import { getTopicGroups } from '@/features/onboarding/api';
import { useAsyncData } from '@/hooks/use-async-data';
import { ApiError, describeError } from '@/lib/errors';
import { goBack, useNav } from '@/lib/routes';
import { deleteDocument, getDocument, removeDocument, reportDocument, saveDocument } from './api';
import { sizeLabel } from './document-card';
import { PdfMark } from './pdf-mark';
import { openPdf } from './transfers';

export default function DocumentScreen() {
  const { id, comuna } = useLocalSearchParams<{ id: string; comuna?: string }>();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const load = useCallback(async () => { const value = await getDocument(id); setSaved(null); setUnavailable(false); return value; }, [id]);
  const document = useAsyncData(load);
  const { reload } = document;
  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) reload();
    focusedOnce.current = true;
  }, [reload]));
  const loadContext = useCallback(() => comuna ? getComuna(comuna) : Promise.resolve(null), [comuna]);
  const context = useAsyncData(loadContext);
  const topicGroups = useAsyncData(useCallback(() => getTopicGroups(), []));
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const toast = useToast();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') abort.current?.abort(); else reload(); });
    return () => { alive.current = false; abort.current?.abort(); sub.remove(); };
  }, [reload]);
  const action = async (run: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await run(); }
    catch (e) {
      if (alive.current) {
        setError(describeError(e));
        if (e instanceof ApiError && [403, 404].includes(e.status)) { setUnavailable(true); reload(); }
      }
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const open = () => action(async () => { abort.current = new AbortController(); await openPdf(id, abort.current.signal); });
  const toggleSave = () => action(async () => {
    const next = !(saved ?? document.data?.saved ?? false);
    await saveDocument(id, next); if (alive.current) setSaved(next);
  });
  const remove = () => Alert.alert('Excluir o documento original?', 'Ele sai das bibliotecas e da busca. Publicações e salvos ficam indisponíveis. As referências são preservadas.', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Excluir documento', style: 'destructive', onPress: () => action(async () => { await deleteDocument(id); toast.show('Documento excluído.'); goBack(); }) },
  ]);
  const d = document.data;
  const available = !!d && d.state === 'available' && !unavailable;
  const canRemoveShared = !!comuna && !!context.data?.viewerPermissions?.canModerateContent;
  const isSaved = saved ?? d?.saved ?? false;
  const topicLabel = d?.topic ? (() => { const topic = topicGroups.data?.flatMap((group) => group.topics).find((item) => item.id === d.topic); return topic ? topic.shortLabel ?? topic.label : null; })() : null;
  const addedAt = d?.createdAt ? new Date(d.createdAt) : null;
  const addedShort = addedAt ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(addedAt).replace('.', '').toUpperCase() : null;
  const addedLong = addedAt ? addedAt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const editDescription = () => router.push({ pathname: '/biblioteca/enviar', params: { edit: id } });

  return <Screen>
    <EditorialHeader
      title="Documento"
      onBack={goBack}
      actions={[
        ...(available ? [{ icon: 'bookmark' as const, label: isSaved ? 'Remover dos salvos' : 'Salvar documento', active: isSaved, plain: true, onPress: () => { void toggleSave(); } }] : []),
        { icon: 'more' as const, label: 'Mais opções do documento', plain: true, onPress: () => setMenuVisible(true) },
      ]}
    />
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
      {document.status === 'loading' && !d ? <StateView kind="loading" message="Carregando documento" /> : null}
      {!available && document.status !== 'loading' ? <>
        <StateView kind="empty" title="Acesso restrito" message="Poxa, não achamos este documento. Ver uma publicação com este PDF não dá acesso ao arquivo." />
        {d?.title ? <AppText variant="heading">{d.title}</AppText> : null}
        {d?.origin?.slug ? <PillButton label="Ver comuna para participar" variant="outline" onPress={() => nav.openComuna(d.origin!.slug!)} /> : null}
        <PillButton label="Remover dos salvos" variant="outline" disabled={busy} onPress={() => action(async () => { await saveDocument(id, false); toast.show('Referência removida dos salvos.'); })} />
        {document.status === 'error' && !(document.error instanceof ApiError && [403, 404].includes(document.error.status)) ? <StateView kind="error" message="Não conseguimos carregar o documento." onRetry={reload} /> : null}
      </> : null}
      {available ? <>
        <View style={styles.coverRow}>
          <PdfMark size="large" />
          <View style={styles.coverMeta}>
            {topicLabel ? <View style={styles.topicTag}><View style={styles.topicSquare} /><AppText style={styles.topicText}>{topicLabel}</AppText></View> : null}
            {d.pageCount ? <AppText style={styles.pages}>{d.pageCount} páginas</AppText> : null}
            <AppText style={styles.fileMeta}>{[sizeLabel(d.byteSize), addedShort ? `Adicionado ${addedShort}` : null].filter(Boolean).join(' · ')}</AppText>
          </View>
        </View>

        <AppText accessibilityRole="header" style={styles.title} numberOfLines={4}>{d.title}</AppText>
        {d.author ? <AppText style={styles.author}>por <AppText style={styles.authorStrong}>{d.author}</AppText></AppText> : null}
        {d.description ? <AppText style={styles.description}>{d.description}</AppText> : d.viewer.canEdit ? (
          <AppText style={styles.description}>Sem descrição ainda. <AppText style={styles.inlineLink} onPress={editDescription}>Adicionar</AppText></AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Publicar no feed. Cria um post com este PDF anexado"
          disabled={busy}
          onPress={() => router.push({ pathname: '/criar', params: { documentId: id } })}
          style={({ pressed }) => [styles.publishBox, pressed && styles.pressed]}>
          <View style={styles.publishIcon}><Icon name="share" size={18} color={Colors.ink} /></View>
          <View style={styles.publishCopy}>
            <AppText style={styles.publishTitle}>Publicar no feed</AppText>
            <AppText variant="caption">Cria um post com este PDF anexado.</AppText>
          </View>
          <Icon name="chevronRight" size={18} />
        </Pressable>

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Detalhes" />
          <View style={styles.detailsCard}>
            {d.responsible ? <View style={styles.detailRow}>
              <AppText variant="label" color={Colors.inkSoft} style={styles.detailLabel}>Responsável</AppText>
              <View style={styles.detailValueRow}>
                <Avatar initials={d.responsible.name.slice(0, 1).toUpperCase()} tone="black" size={30} shape="square" outline font="anton" userId={d.responsible.id} />
                <AppText style={styles.detailStrong} numberOfLines={1}>{d.responsible.name}</AppText>
              </View>
            </View> : null}
            {d.origin?.name ? <DetailRow label="Biblioteca" value={d.origin.name} /> : null}
            {addedLong ? <DetailRow label="Adicionado em" value={addedLong} /> : null}
            {d.collection ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir coleção ${d.collection.name}`} onPress={() => router.push({ pathname: '/biblioteca', params: { collection: d.collection!.id, scope: d.viewer.canEdit ? d.origin?.kind === 'comuna' ? 'comuna' : 'personal' : 'public', ...(d.origin?.slug ? { comuna: d.origin.slug } : {}), ...(d.origin?.kind === 'personal' ? { owner: d.origin.id } : {}) } })} style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}>
              <AppText variant="label" color={Colors.inkSoft} style={styles.detailLabel}>Coleção</AppText>
              <View style={styles.detailValueRow}>
                <Icon name="folder" size={19} color={Colors.ink} />
                <AppText style={styles.detailStrong} numberOfLines={2}>{d.collection.name}</AppText>
              </View>
              <Icon name="chevronRight" size={18} color={Colors.ink} />
            </Pressable> : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Onde está disponível" />
          <View style={styles.availabilityList}>
            {d.origin?.name ? <AvailabilityRow
              icon="home"
              dark
              title={d.origin.name}
              badges={['Original', d.isPublic ? 'Público' : null].filter((badge): badge is string => !!badge)}
            /> : null}
            {d.distributions?.map((distribution) => <AvailabilityRow key={distribution.slug} icon="globe" title={distribution.name} badges={['Público']} onPress={() => nav.openComuna(distribution.slug)} />)}
            <AvailabilityRow
              icon="globe"
              title="Biblioteca Pública"
              badges={d.isPublic ? ['Público'] : []}
              onPress={() => router.push({ pathname: '/biblioteca', params: { scope: 'public' } })}
              caption={d.isPublic ? undefined : 'Fora do acervo público'}
            />
          </View>
          <AppText variant="caption" style={styles.footnote}>O original fica na biblioteca de origem. Cada lugar tem seu próprio alcance, e publicar no feed não muda nenhum deles.</AppText>
        </View>
        {(d.viewer.canRemove || canRemoveShared) ? <View style={styles.section}>
          <TextField label="Motivo da remoção" placeholder="Ex.: direitos autorais não creditados" value={reason} onChangeText={setReason} maxLength={500} />
          <PillButton label={canRemoveShared && d.origin?.kind === 'personal' ? 'Remover da biblioteca da comuna' : 'Remover pela moderação'} variant="outline" disabled={busy || !reason.trim()} onPress={() => action(async () => { await removeDocument(id, reason.trim(), comuna ?? d.origin?.slug); toast.show('Conteúdo removido pela moderação.'); goBack(); })} />
        </View> : null}
      </> : null}
      {error ? <AppText color={Colors.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
    </ScrollView>

    {available ? <View style={[styles.openBar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
      <EditorialAction label={busy ? 'Abrindo…' : 'Abrir PDF'} accessibilityLabel="Abrir PDF" icon="library" tone="red" labelVariant="button" disabled={busy} onPress={open} style={styles.openAction} />
    </View> : null}

    <BottomSheet visible={menuVisible} onClose={() => setMenuVisible(false)} title="Opções do documento">
      <View style={styles.sheetActions}>
        {available ? <EditorialAction label="Compartilhar link" icon="shareNodes" onPress={() => { setMenuVisible(false); void action(() => shareDestination({ kind: 'document', id }).then(() => {})); }} /> : null}
        {available ? <EditorialAction label={isSaved ? 'Remover dos salvos' : 'Salvar documento'} icon="bookmark" onPress={() => { setMenuVisible(false); void toggleSave(); }} /> : null}
        {d?.viewer.canEdit ? <EditorialAction label="Editar documento e acesso" icon="edit" onPress={() => { setMenuVisible(false); router.push({ pathname: '/biblioteca/enviar', params: { edit: id } }); }} /> : null}
        {d?.viewer.canDelete ? <EditorialAction label="Excluir documento" icon="trash" disabled={busy} onPress={() => { setMenuVisible(false); remove(); }} /> : null}
        <EditorialAction label="Denunciar documento" icon="flag" onPress={() => { setMenuVisible(false); setReporting(true); }} />
      </View>
    </BottomSheet>
    <BottomSheet dismissible={!busy} visible={reporting} onClose={() => { if (!busy) setReporting(false); }} title="Denunciar documento">
      <View style={{ gap: Spacing.two }}>{[...REPORT_REASONS, 'Violação de direitos autorais'].map((item) => <PillButton key={item} label={item} variant={reason === item ? 'dark' : 'outline'} onPress={() => setReason(item)} />)}
        <PillButton label={busy ? 'Enviando…' : 'Enviar denúncia'} disabled={busy || !reason.trim()} onPress={() => action(async () => { await reportDocument(id, reason, comuna); toast.show('Denúncia registrada.'); setReporting(false); })} />
        {error ? <AppText color={Colors.error}>{error}</AppText> : null}
      </View>
    </BottomSheet>
  </Screen>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}>
    <AppText variant="label" color={Colors.inkSoft} style={styles.detailLabel}>{label}</AppText>
    <AppText style={styles.detailValue}>{value}</AppText>
  </View>;
}

function AvailabilityRow({ icon, title, badges, dark = false, caption, onPress }: {
  icon: 'home' | 'globe';
  title: string;
  badges: string[];
  dark?: boolean;
  caption?: string;
  onPress?: () => void;
}) {
  const content = <>
    <View style={[styles.availabilityIcon, dark && styles.availabilityIconDark]}>
      <Icon name={icon} size={21} color={dark ? Colors.paper : Colors.ink} />
    </View>
    <View style={styles.availabilityCopy}>
      <AppText style={styles.availabilityTitle} numberOfLines={2}>{title}</AppText>
      {badges.length ? <View style={styles.badges}>
        {badges.map((badge) => <View key={badge} style={[styles.badge, badge === 'Público' ? styles.badgePublic : styles.badgeOriginal]}>
          <AppText style={styles.badgeText} color={badge === 'Público' ? Colors.paper : Colors.ink}>{badge}</AppText>
        </View>)}
      </View> : caption ? <AppText variant="caption">{caption}</AppText> : null}
    </View>
    {onPress ? <Icon name="chevronRight" size={18} color={Colors.ink} /> : null}
  </>;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.availabilityRow, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={styles.availabilityRow}>{content}</View>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.five, paddingTop: Spacing.four, paddingBottom: Spacing.seven, gap: Spacing.three },
  coverRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.four },
  coverMeta: { flex: 1, minWidth: 0, gap: Spacing.two, paddingBottom: Spacing.one },
  topicTag: { alignSelf: 'flex-start', minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.sm, backgroundColor: Colors.strawLight, paddingHorizontal: Spacing.two },
  topicSquare: { width: 6, height: 6, backgroundColor: Colors.red },
  topicText: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 19, letterSpacing: 0.7, textTransform: 'uppercase' },
  pages: { fontFamily: Fonts.extrabold, fontSize: 14.5, lineHeight: 23, textTransform: 'uppercase' },
  fileMeta: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 19, letterSpacing: 0.5, textTransform: 'uppercase', color: Colors.muted },
  title: { fontFamily: Fonts.anton, fontSize: 40, lineHeight: 48, letterSpacing: -0.6, textTransform: 'capitalize', color: Colors.ink },
  author: { fontSize: 15.5, lineHeight: 22 },
  authorStrong: { fontFamily: Fonts.bold },
  description: { fontSize: 15.5, lineHeight: 22 },
  inlineLink: { fontFamily: Fonts.bold, textDecorationLine: 'underline' },
  publishBox: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two + 2, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.ink, borderRadius: Radius.sm },
  publishIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.yellow },
  publishCopy: { flex: 1, minWidth: 0, gap: 2 },
  publishTitle: { fontFamily: Fonts.extrabold, fontSize: 15.5, lineHeight: 24 },
  section: { gap: 0, paddingTop: Spacing.one },
  detailsCard: { borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  detailRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.strawDark },
  detailLabel: { width: 124 },
  detailValue: { flex: 1, minWidth: 0, fontSize: 15.5, lineHeight: 22 },
  detailValueRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  detailStrong: { flex: 1, minWidth: 0, fontFamily: Fonts.bold, fontSize: 15.5, lineHeight: 24 },
  availabilityList: { gap: Spacing.two },
  availabilityRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  availabilityIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, backgroundColor: Colors.straw },
  availabilityIconDark: { backgroundColor: Colors.ink },
  availabilityCopy: { flex: 1, minWidth: 0, gap: 4 },
  availabilityTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2 },
  badge: { minHeight: 21, justifyContent: 'center', borderRadius: Radius.sm, paddingHorizontal: 6 },
  badgeOriginal: { borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  badgePublic: { backgroundColor: Colors.red },
  badgeText: { fontFamily: Fonts.monoSemibold, fontSize: 9.5, lineHeight: 18, letterSpacing: 0.5, textTransform: 'uppercase' },
  footnote: { color: Colors.inkSoft, marginTop: Spacing.two },
  openBar: { backgroundColor: Colors.cream, paddingHorizontal: Spacing.five, paddingTop: Spacing.three },
  openAction: { alignSelf: 'stretch', minHeight: 52, borderWidth: 2, borderRadius: Radius.sm, ...Shadows.offset, boxShadow: '3px 3px 0 #16120F' },
  sheetActions: { gap: Spacing.two },
  pressed: { opacity: 0.66 },
});
