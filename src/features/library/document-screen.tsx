import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getTopicGroups } from '@/features/onboarding/api';
import { getComuna } from '@/features/comunas/api';
import { REPORT_REASONS } from '@/features/moderation/constants';
import { useAsyncData } from '@/hooks/use-async-data';
import { ApiError, describeError } from '@/lib/errors';
import { goBack, useNav } from '@/lib/routes';
import { deleteDocument, getDocument, removeDocument, reportDocument, saveDocument } from './api';
import { accessLabel, DocumentCard, sizeLabel } from './document-card';
import { openPdf } from './transfers';

export default function DocumentScreen() {
  const { id, comuna } = useLocalSearchParams<{ id: string; comuna?: string }>();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const load = useCallback(async () => { const value = await getDocument(id); setSaved(null); setUnavailable(false); return value; }, [id]);
  const document = useAsyncData(load);
  const { reload } = document;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const loadContext = useCallback(() => comuna ? getComuna(comuna) : Promise.resolve(null), [comuna]);
  const context = useAsyncData(loadContext);
  const topicGroups = useAsyncData(useCallback(() => getTopicGroups(), []));
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
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
    <View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><AppText variant="label">Documento</AppText></View>
    <ScrollView contentContainerStyle={styles.content}>
      {document.status === 'loading' && !d ? <StateView kind="loading" message="Carregando documento" /> : null}
      {!available && document.status !== 'loading' ? <>
        <StateView kind="empty" title="Acesso restrito" message="Este documento não está mais disponível para você. Ver o título ou uma publicação com este PDF não dá acesso ao arquivo." />
        {d?.title ? <AppText variant="heading">{d.title}</AppText> : null}
        {d?.origin?.slug ? <PillButton label="Ver comuna para participar" variant="outline" onPress={() => nav.openComuna(d.origin!.slug!)} /> : null}
        <PillButton label="Remover dos salvos" variant="outline" disabled={busy} onPress={() => action(async () => { await saveDocument(id, false); toast.show('Referência removida dos salvos.'); })} />
        {document.status === 'error' && !(document.error instanceof ApiError && [403, 404].includes(document.error.status)) ? <StateView kind="error" message="Não conseguimos carregar o documento." onRetry={reload} /> : null}
      </> : null}
      {available ? <>
        <DocumentCard document={d} onPress={() => {}} />
        <AppText variant="display">{d.title}</AppText><AppText>{d.description}</AppText>
        <AppText variant="caption">{d.origin?.name} · {d.responsible?.name}</AppText>
        <AppText variant="caption">{[d.createdAt ? new Date(d.createdAt).toLocaleDateString('pt-BR') : '', d.pageCount ? `${d.pageCount} páginas` : '', sizeLabel(d.byteSize)].filter(Boolean).join(' · ')}</AppText>
        {d.topic ? <AppText variant="caption">Assunto: {topicGroups.data?.flatMap((group) => group.topics).find((topic) => topic.id === d.topic)?.label ?? 'Assunto do documento'}</AppText> : null}
        {d.collection ? <PillButton label={`Coleção · ${d.collection.name}`} variant="outline" onPress={() => router.push({ pathname: '/biblioteca', params: { collection: d.collection!.id, scope: d.viewer.canEdit ? d.origin?.kind === 'comuna' ? 'comuna' : 'personal' : 'public', ...(d.origin?.slug ? { comuna: d.origin.slug } : {}), ...(d.origin?.kind === 'personal' ? { owner: d.origin.id } : {}) } })} /> : null}
        <PillButton label={busy ? 'Aguarde…' : 'Abrir PDF'} disabled={busy} onPress={open} />
        <AppText variant="caption">O sistema oferece os aplicativos instalados para abrir ou compartilhar o PDF.</AppText>
        <PillButton label="Publicar no feed" variant="outline" disabled={busy} onPress={() => router.push({ pathname: '/criar', params: { documentId: id } })} />
        <PillButton label={(saved ?? d.saved) ? 'Remover dos salvos' : 'Salvar'} variant="outline" disabled={busy} onPress={toggleSave} />
        <AppText variant="heading">Onde está disponível</AppText><AppText>{accessLabel(d)}</AppText>
        {d.distributions ? <>
          <AppText>{d.origin?.name} · Original</AppText>
          {d.distributions.map((distribution) => <AppText key={distribution.slug}>c/ {distribution.name} · Compartilhado</AppText>)}
          <AppText>{d.isPublic ? 'Biblioteca Pública · Público' : 'Biblioteca Pública · Fora'}</AppText>
          <AppText variant="caption">O original fica na biblioteca de origem. Cada lugar tem alcance próprio, e publicar no feed não muda nenhum deles.</AppText>
        </> : null}
        {d.viewer.canEdit ? <PillButton label="Editar documento e acesso" variant="outline" onPress={() => router.push({ pathname: '/biblioteca/enviar', params: { edit: id } })} /> : null}
        {d.viewer.canDelete ? <PillButton label="Excluir documento" variant="outline" disabled={busy} onPress={remove} /> : null}
        <PillButton label="Denunciar documento" variant="outline" onPress={() => setReporting(true)} />
        {(d.viewer.canRemove || canRemoveShared) ? <><TextField label="Motivo da remoção" value={reason} onChangeText={setReason} maxLength={500} />
          <PillButton label={canRemoveShared && d.origin?.kind === 'personal' ? 'Remover da biblioteca da comuna' : 'Remover pela moderação'} variant="outline" disabled={busy || !reason.trim()} onPress={() => action(async () => { await removeDocument(id, reason.trim(), comuna ?? d.origin?.slug); toast.show('Conteúdo removido pela moderação.'); goBack(); })} /></> : null}
      </> : null}
      {error ? <AppText color={Colors.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
    </ScrollView>
    <BottomSheet visible={reporting} onClose={() => { if (!busy) setReporting(false); }} title="Denunciar documento">
      <View style={{ gap: Spacing.two }}>{[...REPORT_REASONS, 'Violação de direitos autorais'].map((item) => <PillButton key={item} label={item} variant={reason === item ? 'dark' : 'outline'} onPress={() => setReason(item)} />)}
        <PillButton label={busy ? 'Enviando…' : 'Enviar denúncia'} disabled={busy || !reason.trim()} onPress={() => action(async () => { await reportDocument(id, reason, comuna); toast.show('Denúncia registrada.'); setReporting(false); })} />
        {error ? <AppText color={Colors.error}>{error}</AppText> : null}
      </View>
    </BottomSheet>
  </Screen>;
}
const styles = StyleSheet.create({ bar: { flexDirection: 'row', alignItems: 'center' }, content: { padding: Spacing.five, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.seven } });
