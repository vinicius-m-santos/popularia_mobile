import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { getTopicGroups } from '@/features/onboarding/api';
import { getComuna } from '@/features/comunas/api';
import { REPORT_REASONS } from '@/features/moderation/constants';
import { useAsyncData } from '@/hooks/use-async-data';
import { ApiError, describeError } from '@/lib/errors';
import { goBack, useNav } from '@/lib/routes';
import { deleteDocument, getDocument, removeDocument, reportDocument, saveDocument } from './api';
import { accessLabel, sizeLabel } from './document-card';
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
  return <Screen>
    <View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><View style={styles.barDivider} /><AppText variant="label" style={styles.barTitle}>Documento</AppText>{available ? <IconButton icon="more" accessibilityLabel="Mais opções do documento" onPress={() => setMenuVisible(true)} /> : <View style={styles.barSpacer} />}</View>
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
        <View style={styles.documentHero}>
          <DocumentCover />
          <View style={styles.documentDetails}>
            <View style={styles.pdfBadge}><AppText variant="label" color={Colors.paper} style={styles.pdfBadgeText}>PDF</AppText></View>
            <AppText variant="display" accessibilityRole="header" style={styles.documentTitle}>{d.title}</AppText>
            {d.author ? <AppText variant="bodyStrong" style={styles.author}>Autoria: {d.author}</AppText> : null}
            {d.responsible?.name ? <DocumentFact icon="user" label="Disponibilizado por" value={d.responsible.name} wide /> : null}
          </View>
        </View>
        <View style={styles.facts}>
          <DocumentFact icon="institution" label="Biblioteca" value={d.origin?.name ?? 'Biblioteca de origem'} />
          {d.createdAt ? <DocumentFact icon="calendar" label="Data" value={new Date(d.createdAt).toLocaleDateString('pt-BR')} /> : null}
          {d.pageCount ? <DocumentFact icon="document" label="Páginas" value={`${d.pageCount} páginas`} /> : null}
          {d.byteSize !== null ? <DocumentFact icon="pie" label="Tamanho" value={sizeLabel(d.byteSize)} /> : null}
        </View>
        {d.description || d.topic ? <View style={styles.documentNotes}>
          {d.description ? <AppText>{d.description}</AppText> : null}
          {d.topic ? <AppText variant="caption">Assunto: {topicGroups.data?.flatMap((group) => group.topics).find((topic) => topic.id === d.topic)?.label ?? 'Assunto do documento'}</AppText> : null}
        </View> : null}
        {d.collection ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir coleção ${d.collection.name}`} onPress={() => router.push({ pathname: '/biblioteca', params: { collection: d.collection!.id, scope: d.viewer.canEdit ? d.origin?.kind === 'comuna' ? 'comuna' : 'personal' : 'public', ...(d.origin?.slug ? { comuna: d.origin.slug } : {}), ...(d.origin?.kind === 'personal' ? { owner: d.origin.id } : {}) } })} style={({ pressed }) => [styles.collection, pressed && styles.pressed]}>
          <View style={styles.collectionIcon}><Icon name="folder" size={29} /></View>
          <View style={styles.collectionBody}><AppText variant="label">Coleção</AppText><AppText variant="bodyStrong" style={styles.collectionName} numberOfLines={2}>{d.collection.name}</AppText></View>
          <Icon name="chevronRight" size={22} />
        </Pressable> : null}
        <View style={styles.actions}>
          <EditorialAction label={busy ? 'Aguarde…' : 'Abrir PDF'} accessibilityLabel="Abrir PDF" icon="library" tone="red" disabled={busy} onPress={open} style={styles.openAction} />
          <View style={styles.secondaryActions}>
            <EditorialAction label="Publicar no feed" icon="share" disabled={busy} onPress={() => router.push({ pathname: '/criar', params: { documentId: id } })} style={styles.publishAction} />
            <EditorialAction label={(saved ?? d.saved) ? 'Salvo' : 'Salvar'} accessibilityLabel={(saved ?? d.saved) ? 'Remover dos salvos' : 'Salvar documento'} icon="bookmark" disabled={busy} onPress={toggleSave} style={styles.saveAction} />
          </View>
          <AppText variant="caption">O sistema oferece os aplicativos instalados para abrir ou compartilhar o PDF.</AppText>
        </View>
        <View style={styles.availability}>
          <AppText variant="heading" accessibilityRole="header">Onde está disponível</AppText>
          <AvailabilityRow icon="institution" label={`Biblioteca original · ${accessLabel(d)}`} value={`${d.origin?.name ?? 'Biblioteca de origem'} · Original`} onPress={d.origin?.slug ? () => nav.openComuna(d.origin!.slug!) : undefined} />
          {d.distributions?.map((distribution) => <AvailabilityRow key={distribution.slug} icon="institution" label="Biblioteca compartilhada" value={`${distribution.name} · Compartilhado`} onPress={() => nav.openComuna(distribution.slug)} />)}
          {d.distributions ? <AvailabilityRow icon="globe" label="Visibilidade pública" value={d.isPublic ? 'Biblioteca Pública · Público' : 'Biblioteca Pública · Fora'} onPress={() => router.push({ pathname: '/biblioteca', params: { scope: 'public' } })} /> : null}
          <AppText variant="caption">O original fica na biblioteca de origem. Cada lugar tem alcance próprio, e publicar no feed não muda nenhum deles.</AppText>
        </View>
        {(d.viewer.canRemove || canRemoveShared) ? <><TextField label="Motivo da remoção" value={reason} onChangeText={setReason} maxLength={500} />
          <PillButton label={canRemoveShared && d.origin?.kind === 'personal' ? 'Remover da biblioteca da comuna' : 'Remover pela moderação'} variant="outline" disabled={busy || !reason.trim()} onPress={() => action(async () => { await removeDocument(id, reason.trim(), comuna ?? d.origin?.slug); toast.show('Conteúdo removido pela moderação.'); goBack(); })} /></> : null}
      </> : null}
      {error ? <AppText color={Colors.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
    </ScrollView>
    <BottomSheet visible={menuVisible} onClose={() => setMenuVisible(false)} title="Opções do documento">
      <View style={styles.sheetActions}>
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

function DocumentCover() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.cover}>
    <View style={styles.coverHeader}><AppText variant="label">Popularia</AppText><View style={styles.coverRule} /></View>
    <View style={styles.coverCopy}>
      <AppText variant="heading" style={styles.coverHeading} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Documento</AppText>
      <AppText variant="heading" style={styles.coverHeading} numberOfLines={1}>digital</AppText>
      <AppText variant="label">Biblioteca pública</AppText>
    </View>
    <View style={styles.coverArt}>
      <View style={styles.coverOrbit} />
      <View style={styles.coverPlanet} />
      <View style={styles.coverMark}><Icon name="library" size={43} color={Colors.paper} /></View>
    </View>
    <View style={styles.coverFooter}><AppText variant="label" color={Colors.paper}>PDF</AppText></View>
  </View>;
}

function DocumentFact({ icon, label, value, wide = false }: { icon: IconName; label: string; value: string; wide?: boolean }) {
  return <View style={[styles.fact, wide && styles.factWide]}>
    <View style={styles.factIcon}><Icon name={icon} size={24} /></View>
    <View style={styles.factCopy}><AppText variant="label" style={styles.factLabel}>{label}</AppText><AppText style={styles.factValue}>{value}</AppText></View>
  </View>;
}

function AvailabilityRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress?: () => void }) {
  const content = <>
    <View style={styles.availabilityIcon}><Icon name={icon} size={27} /></View>
    <View style={styles.availabilityCopy}><AppText variant="label">{label}</AppText><AppText variant="bodyStrong">{value}</AppText></View>
    {onPress ? <Icon name="chevronRight" size={20} /> : null}
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={value} onPress={onPress} style={({ pressed }) => [styles.availabilityRow, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.availabilityRow}>{content}</View>;
}

const styles = StyleSheet.create({
  bar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.one, backgroundColor: Colors.cream, borderBottomWidth: 1.5, borderBottomColor: Colors.ink },
  barDivider: { width: 1.5, height: 28, backgroundColor: Colors.ink, marginRight: Spacing.two },
  barTitle: { flex: 1, fontSize: 12.5 },
  barSpacer: { width: 44 },
  content: { paddingHorizontal: Spacing.five, paddingTop: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.seven },
  documentHero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: Spacing.four },
  cover: { width: '43%', minWidth: 140, maxWidth: 250, minHeight: 330, flexGrow: 0, overflow: 'hidden', borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, padding: Spacing.four },
  coverHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  coverRule: { height: 1.5, flex: 1, backgroundColor: Colors.ink },
  coverCopy: { gap: Spacing.one, marginTop: Spacing.seven },
  coverHeading: { fontSize: 26, lineHeight: 28 },
  coverArt: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '47%', overflow: 'hidden', backgroundColor: Colors.ink },
  coverOrbit: { position: 'absolute', width: '145%', height: 54, left: '-25%', top: 22, borderWidth: 3, borderColor: Colors.paper, borderRadius: 999, transform: [{ rotate: '-18deg' }] },
  coverPlanet: { position: 'absolute', width: 150, height: 150, left: -47, bottom: -58, borderRadius: 999, backgroundColor: Colors.red },
  coverMark: { position: 'absolute', right: Spacing.four, top: Spacing.four },
  coverFooter: { position: 'absolute', right: Spacing.four, bottom: Spacing.four },
  documentDetails: { flex: 1, minWidth: 165, gap: Spacing.two },
  pdfBadge: { alignSelf: 'flex-start', minWidth: 48, minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.red, paddingHorizontal: Spacing.two },
  pdfBadgeText: { fontSize: 13 },
  documentTitle: { fontSize: 34, lineHeight: 35, textTransform: 'none' },
  author: { fontSize: 13.5, lineHeight: 18 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.four, columnGap: Spacing.three, paddingVertical: Spacing.one },
  fact: { width: '47%', flexGrow: 1, minWidth: 135, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  factWide: { width: '100%', minWidth: 0, flexGrow: 0, marginTop: Spacing.two },
  factIcon: { width: 30, paddingTop: 1, alignItems: 'center' },
  factCopy: { flex: 1, minWidth: 0 },
  factLabel: { fontSize: 10.5, lineHeight: 13 },
  factValue: { fontSize: 14, lineHeight: 18 },
  documentNotes: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: Colors.ink, paddingVertical: Spacing.three, gap: Spacing.one },
  collection: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.four, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, paddingRight: Spacing.four },
  collectionIcon: { width: 58, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1.5, borderRightColor: Colors.ink },
  collectionBody: { flex: 1, minWidth: 0, gap: 2 },
  collectionName: { fontFamily: Fonts.extrabold, fontSize: 17, lineHeight: 21 },
  actions: { gap: Spacing.two },
  secondaryActions: { flexDirection: 'row', gap: Spacing.three },
  openAction: { minHeight: 60 },
  publishAction: { flex: 1.65 },
  saveAction: { flex: 1 },
  availability: { borderWidth: 1.5, borderColor: Colors.ink, padding: Spacing.four, gap: Spacing.three, backgroundColor: Colors.paper },
  availabilityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.rule, paddingTop: Spacing.three },
  availabilityIcon: { width: 32, alignItems: 'center' },
  availabilityCopy: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { opacity: 0.66 },
  sheetActions: { gap: Spacing.two },
});
