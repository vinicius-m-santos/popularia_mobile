import { shareDestination } from '@/features/links/share';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
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
        <View style={styles.head}>
          <AppText variant="label" color={Colors.inkSoft}>{[`PDF`, d.pageCount ? `${d.pageCount} páginas` : '', sizeLabel(d.byteSize)].filter(Boolean).join(' · ')}</AppText>
          <AppText variant="display" accessibilityRole="header" style={styles.documentTitle} numberOfLines={4}>{d.title}</AppText>
          {d.author ? <AppText variant="bodyStrong" style={styles.author}>Autoria: {d.author}</AppText> : null}
          {d.description ? <AppText style={styles.description}>{d.description}</AppText> : null}
        </View>
        <View style={styles.facts}>
          <FactRow label="Biblioteca" value={d.origin?.name ?? 'Biblioteca de origem'} />
          {d.topic ? <FactRow label="Assunto" value={topicGroups.data?.flatMap((group) => group.topics).find((topic) => topic.id === d.topic)?.label ?? 'Assunto do documento'} /> : null}
          {d.createdAt ? <FactRow label="Adicionado em" value={new Date(d.createdAt).toLocaleDateString('pt-BR')} /> : null}
          {d.responsible?.name ? <FactRow label="Disponibilizado por" value={d.responsible.name} /> : null}
        </View>
        {d.collection ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir coleção ${d.collection.name}`} onPress={() => router.push({ pathname: '/biblioteca', params: { collection: d.collection!.id, scope: d.viewer.canEdit ? d.origin?.kind === 'comuna' ? 'comuna' : 'personal' : 'public', ...(d.origin?.slug ? { comuna: d.origin.slug } : {}), ...(d.origin?.kind === 'personal' ? { owner: d.origin.id } : {}) } })} style={({ pressed }) => [styles.collection, pressed && styles.pressed]}>
          <View style={styles.collectionIcon}><Icon name="folder" size={20} color={Colors.ink} /></View>
          <View style={styles.collectionBody}><AppText variant="label">Coleção</AppText><AppText variant="bodyStrong" style={styles.collectionName} numberOfLines={2}>{d.collection.name}</AppText></View>
          <Icon name="chevronRight" size={18} color={Colors.muted} />
        </Pressable> : null}
        <View style={styles.actions}>
          <EditorialAction label={busy ? 'Aguarde…' : 'Abrir PDF'} accessibilityLabel="Abrir PDF" icon="library" tone="red" disabled={busy} onPress={open} />
          <View style={styles.secondaryActions}>
            <EditorialAction label="Publicar no feed" icon="share" disabled={busy} onPress={() => router.push({ pathname: '/criar', params: { documentId: id } })} style={styles.publishAction} />
            <EditorialAction label={(saved ?? d.saved) ? 'Salvo' : 'Salvar'} accessibilityLabel={(saved ?? d.saved) ? 'Remover dos salvos' : 'Salvar documento'} icon="bookmark" disabled={busy} onPress={toggleSave} style={styles.saveAction} />
          </View>
          <AppText variant="caption">O sistema oferece os aplicativos instalados para abrir ou compartilhar o PDF.</AppText>
        </View>
        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Onde está disponível" />
          <AvailabilityRow label={`Biblioteca original · ${accessLabel(d)}`} value={`${d.origin?.name ?? 'Biblioteca de origem'} · Original`} onPress={d.origin?.slug ? () => nav.openComuna(d.origin!.slug!) : undefined} />
          {d.distributions?.map((distribution) => <AvailabilityRow key={distribution.slug} label="Biblioteca compartilhada" value={`${distribution.name} · Compartilhado`} onPress={() => nav.openComuna(distribution.slug)} />)}
          {d.distributions ? <AvailabilityRow label="Visibilidade pública" value={d.isPublic ? 'Biblioteca Pública · Público' : 'Biblioteca Pública · Fora'} onPress={() => router.push({ pathname: '/biblioteca', params: { scope: 'public' } })} /> : null}
          <AppText variant="caption">O original fica na biblioteca de origem. Cada lugar tem alcance próprio, e publicar no feed não muda nenhum deles.</AppText>
        </View>
        {(d.viewer.canRemove || canRemoveShared) ? <View style={styles.section}>
          <TextField label="Motivo da remoção" placeholder="Ex.: direitos autorais não creditados" value={reason} onChangeText={setReason} maxLength={500} />
          <PillButton label={canRemoveShared && d.origin?.kind === 'personal' ? 'Remover da biblioteca da comuna' : 'Remover pela moderação'} variant="outline" disabled={busy || !reason.trim()} onPress={() => action(async () => { await removeDocument(id, reason.trim(), comuna ?? d.origin?.slug); toast.show('Conteúdo removido pela moderação.'); goBack(); })} />
        </View> : null}
      </> : null}
      {error ? <AppText color={Colors.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
    </ScrollView>
    <BottomSheet visible={menuVisible} onClose={() => setMenuVisible(false)} title="Opções do documento">
      <View style={styles.sheetActions}>
        {available ? <EditorialAction label="Compartilhar link" icon="shareNodes" onPress={() => { setMenuVisible(false); void action(() => shareDestination({ kind: 'document', id }).then(() => {})); }} /> : null}
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

function FactRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.factRow}>
    <AppText variant="label" style={styles.factLabel} color={Colors.inkSoft}>{label}</AppText>
    <AppText style={styles.factValue}>{value}</AppText>
  </View>;
}

function AvailabilityRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const content = <>
    <View style={styles.availabilityCopy}><AppText variant="label">{label}</AppText><AppText variant="bodyStrong">{value}</AppText></View>
    {onPress ? <Icon name="chevronRight" size={18} color={Colors.muted} /> : null}
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={value} onPress={onPress} style={({ pressed }) => [styles.availabilityRow, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.availabilityRow}>{content}</View>;
}

const styles = StyleSheet.create({
  bar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.one, backgroundColor: Colors.cream, borderBottomWidth: 1.5, borderBottomColor: Colors.ink },
  barDivider: { width: 1.5, height: 28, backgroundColor: Colors.ink, marginRight: Spacing.two },
  barTitle: { flex: 1, fontSize: 12.5 },
  barSpacer: { width: 44 },
  content: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.seven },
  head: { gap: Spacing.two },
  documentTitle: { fontSize: 40, lineHeight: 50, textTransform: 'none' },
  author: { fontSize: 14.5, lineHeight: 20 },
  description: { fontSize: 15.5, lineHeight: 22 },
  facts: { borderTopWidth: 1, borderTopColor: Colors.rule },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  factLabel: { width: 112, paddingTop: 3 },
  factValue: { flex: 1, minWidth: 0, fontSize: 15.5, lineHeight: 22 },
  collection: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: Colors.paper, padding: Spacing.three },
  collectionIcon: { width: 24, alignItems: 'center' },
  collectionBody: { flex: 1, minWidth: 0, gap: 2 },
  collectionName: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 22 },
  actions: { gap: Spacing.two },
  secondaryActions: { flexDirection: 'row', gap: Spacing.three },
  publishAction: { flex: 1.65 },
  saveAction: { flex: 1 },
  section: { gap: Spacing.three },
  availabilityRow: { gap: 2, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  availabilityCopy: { minWidth: 0 },
  pressed: { opacity: 0.66 },
  sheetActions: { gap: Spacing.two },
});
