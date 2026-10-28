import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { TextField } from '@/components/text-field';
import { getComuna, getMyComunas } from '@/features/comunas/api';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { describeError } from '@/lib/errors';
import { goBack } from '@/lib/routes';
import type { TopicId } from '@/types/models';
import { editDocument, getDocument, listCollections, shareDocument, uploadDocument } from './api';
import { CollectionEditor } from './collection-editor';
import { returnAttachment } from './composer-attachment';
import { sizeLabel } from './document-card';
import { pickPdf } from './transfers';
import type { DocumentAccess, LibraryDocument, PickedPdf } from './types';

export function uploadClientId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (key) => { const n = Math.floor(Math.random() * 16); return (key === 'x' ? n : (n & 3) | 8).toString(16); });
}
export default function UploadScreen() {
  const params = useLocalSearchParams<{ comuna?: string; collection?: string; edit?: string; composerKey?: string }>();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [collectionId, setCollectionId] = useState(params.collection ?? '');
  const [access, setAccess] = useState<DocumentAccess>(params.comuna ? 'members' : 'private');
  const [isPublic, setPublic] = useState(false);
  const [shares, setShares] = useState<string[]>([]);
  const [original, setOriginal] = useState<LibraryDocument | null>(null);
  const [done, setDone] = useState<LibraryDocument | null>(null);
  const [newCollection, setNewCollection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [clientId, setClientId] = useState(uploadClientId);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const comunaSlug = params.comuna ?? original?.origin?.slug;
  const loadOrigin = useCallback(() => comunaSlug ? getComuna(comunaSlug) : Promise.resolve(null), [comunaSlug]);
  const origin = useAsyncData(loadOrigin);
  const loadMemberships = useCallback(() => getMyComunas(), []);
  const memberships = useAsyncData(loadMemberships);
  const loadCollections = useCallback((cursor: string | null) => listCollections({ scope: comunaSlug ? 'comuna' : 'personal', ...(comunaSlug ? { comuna: comunaSlug } : {}) }, cursor), [comunaSlug]);
  const collections = usePaginatedData(loadCollections);
  const canPublicize = original ? !!original.viewer.canPublicize : !comunaSlug || ['founder', 'moderator'].includes(origin.data?.viewerRole ?? '');
  const disablePrevention = usePreventRemove(!leaving && !done && (busy || !!file || !!title), ({ repeat }) => {
    Alert.alert('Sair do envio?', 'Se o envio já chegou ao servidor, tentar de novo usa o mesmo documento. As informações ainda não enviadas serão perdidas.', [
      { text: 'Continuar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: () => { controller.current?.abort(); setLeaving(true); repeat(); } },
    ]);
  });
  useEffect(() => {
    if (!params.edit) return;
    let active = true;
    getDocument(params.edit).then((document) => {
      if (!active) return;
      if (!document.viewer.canEdit) { setError('Você não pode editar este documento.'); return; }
      setOriginal(document); setTitle(document.title ?? ''); setDescription(document.description ?? ''); setTopic(document.topic);
      setCollectionId(document.collection?.id ?? ''); setAccess(document.access ?? 'private'); setPublic(document.isPublic ?? false);
      setShares(document.distributions?.map((d) => d.slug) ?? []);
    }, (e: unknown) => { if (active) setError(describeError(e)); });
    return () => { active = false; };
  }, [params.edit]);
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active' && pending.current) controller.current?.abort(); });
    return () => { alive.current = false; controller.current?.abort(); sub.remove(); };
  }, []);
  const select = async () => {
    if (selecting) return;
    setSelecting(true); setError('');
    try {
      const selected = await pickPdf();
      if (selected && alive.current) { setFile(selected); setClientId(uploadClientId()); if (!title) setTitle(selected.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')); }
    } catch (e) { if (alive.current) setError(describeError(e)); }
    finally { if (alive.current) setSelecting(false); }
  };
  const confirm = async () => {
    if (pending.current) return;
    if (!collectionId || !title.trim() || (!params.edit && !file)) { setError('Escolha o PDF, dê um nome e selecione uma coleção.'); return; }
    pending.current = true; setBusy(true); setError(''); setProgress(0);
    const abort = new AbortController(); controller.current = abort;
    try {
      let result: LibraryDocument;
      if (params.edit) {
        result = await editDocument(params.edit, { title: title.trim(), description: description.trim(), collectionId, access, topic, clearTopic: topic === null, ...(canPublicize ? { isPublic } : {}) });
        if (original?.viewer.canShare) {
          const previous = original.distributions?.map((d) => d.slug) ?? [];
          for (const slug of shares.filter((s) => !previous.includes(s))) await shareDocument(params.edit, slug, true);
          for (const slug of previous.filter((s) => !shares.includes(s))) await shareDocument(params.edit, slug, false);
          result = await getDocument(params.edit);
        }
      } else {
        result = await uploadDocument(file!, { title: title.trim(), description: description.trim(), collectionId, access, topic, isPublic, sharedWith: shares, clientId }, (percent) => { if (alive.current) setProgress(percent); }, abort.signal);
      }
      if (alive.current) { setDone(result); setStep(5); }
    } catch (e) { if (alive.current) setError(`${params.edit ? 'Não foi possível concluir todas as alterações. Confira o documento antes de tentar novamente. ' : ''}${describeError(e)}`); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const next = () => {
    setError('');
    if (step === 1 && ((!file && !params.edit) || !title.trim() || (params.edit && !original))) { setError('Selecione um PDF e dê um nome ao documento.'); return; }
    if (step === 2 && !collectionId) { setError('A coleção é obrigatória. Escolha uma ou crie agora.'); return; }
    if (step === 3 && comunaSlug && !origin.data) { setError('Aguarde carregar as permissões da comuna.'); return; }
    if (step === 4) void confirm(); else setStep((value) => value + 1);
  };
  const exit = (destination: 'document' | 'library' | 'composer' | 'post') => {
    if (!done) return;
    setLeaving(true); disablePrevention();
    if (destination === 'composer' && params.composerKey) { returnAttachment(params.composerKey, done); goBack(); }
    else if (destination === 'post') router.replace({ pathname: '/criar', params: { documentId: done.id } });
    else if (destination === 'document') router.replace({ pathname: '/biblioteca/documento/[id]', params: { id: done.id } });
    else router.replace({ pathname: '/biblioteca', params: { scope: comunaSlug ? 'comuna' : 'personal', ...(comunaSlug ? { comuna: comunaSlug, add: '1' } : {}) } });
  };
  const availableMemberships = memberships.data ?? [];
  const chosenCollection = collections.items.find((item) => item.id === collectionId);
  return <Screen><KeyboardView style={styles.flex}>
    <View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={() => { if (step > 1 && step < 5 && !busy) setStep(step - 1); else goBack(); }} />
      <View style={styles.flex}><AppText variant="heading">{params.edit ? 'Editar documento' : 'Adicionar PDF'}</AppText><AppText variant="caption">{comunaSlug ? `Biblioteca de c/ ${origin.data?.name ?? comunaSlug}` : 'Sua biblioteca'}</AppText></View>
      <AppText variant="caption">{step < 5 ? `${step} de 4` : 'Concluído'}</AppText></View>
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {step === 1 ? <>
        <AppText variant="display">Arquivo e informações</AppText><AppText>Só PDF, até 25 MB. Nas próximas etapas você escolhe a coleção e quem pode abrir.</AppText>
        {params.edit ? <AppText variant="caption">O arquivo é imutável. Para outro PDF, faça um novo envio.</AppText> : <PillButton label={selecting ? 'Abrindo arquivos…' : file ? 'Trocar PDF' : 'Escolher PDF do aparelho'} disabled={selecting} onPress={select} />}
        {file ? <AppText>{file.name} · {sizeLabel(file.size ?? null)}</AppText> : null}
        <TextField label="Nome do documento" value={title} onChangeText={setTitle} maxLength={160} />
        <TextField label="Descrição curta" labelAside={`opcional · ${description.length}/1000`} value={description} onChangeText={setDescription} maxLength={1000} multiline />
        <SingleTopicField value={topic} onChange={setTopic} optional />
      </> : null}
      {step === 2 ? <>
        <AppText variant="display">Escolha a coleção</AppText><AppText>Todo PDF precisa estar em uma coleção. Escolha uma existente ou crie agora mesmo, sem sair do envio.</AppText>
        {collections.status === 'loading' ? <StateView kind="loading" message="Carregando coleções" /> : null}
        {collections.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as coleções." onRetry={collections.refresh} /> : null}
        {collections.items.map((item) => <PillButton key={item.id} label={`${item.id === collectionId ? '✓ ' : ''}${item.name}`} selected={item.id === collectionId} variant={item.id === collectionId ? 'dark' : 'outline'} onPress={() => setCollectionId(item.id)} />)}
        {chosenCollection === undefined && collectionId ? <AppText variant="caption">Uma coleção foi selecionada. Você pode escolher outra acima.</AppText> : null}
        {collections.hasMore ? <PillButton label="Mais coleções" disabled={collections.loadingMore} onPress={collections.loadMore} variant="outline" /> : null}
        {collections.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais coleções." onRetry={collections.loadMore} /> : null}
        <PillButton label="Criar nova coleção" variant="outline" onPress={() => setNewCollection(true)} />
      </> : null}
      {step === 3 ? <>
        <AppText variant="display">Onde disponibilizar</AppText><AppText>O original fica em {comunaSlug ? `c/ ${origin.data?.name ?? comunaSlug}` : 'sua biblioteca'}. Cada lugar abaixo tem alcance próprio.</AppText>
        <AppText variant="heading">{comunaSlug ? 'Biblioteca da comuna · Original' : 'Sua biblioteca · Original'}</AppText>
        {(comunaSlug ? [...(origin.data?.visibility === 'public' ? [{ value: 'visitors' as const, label: 'Quem visitar a comuna' }] : []), { value: 'members' as const, label: 'Só membros' }, ...(canPublicize ? [{ value: 'moderators' as const, label: 'Só coordenação' }] : [])] : [{ value: 'private' as const, label: 'Só você' }, { value: 'followers' as const, label: 'Seus seguidores' }]).map((option) => <PillButton key={option.value} label={option.label} selected={access === option.value} variant={access === option.value ? 'dark' : 'outline'} onPress={() => setAccess(option.value)} />)}
        {!comunaSlug ? <>
          <AppText variant="caption">Continua restrito a seguidores mesmo se o perfil mudar.</AppText><AppText variant="heading">Comunas · Opcional</AppText>
          <AppText>Compartilhar numa comuna não torna o PDF público nem o coloca na Biblioteca Pública.</AppText>
          {memberships.status === 'loading' ? <StateView kind="loading" message="Carregando suas comunas" /> : null}
          {memberships.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar suas comunas." onRetry={memberships.reload} /> : null}
          {availableMemberships.map((comuna) => <View key={comuna.id} style={styles.group}><PillButton label={`${shares.includes(comuna.id) ? '✓ ' : ''}c/ ${comuna.name}`} selected={shares.includes(comuna.id)} disabled={comuna.status === 'archived' && !shares.includes(comuna.id)} variant={shares.includes(comuna.id) ? 'dark' : 'outline'} onPress={() => setShares((items) => items.includes(comuna.id) ? items.filter((s) => s !== comuna.id) : [...items, comuna.id])} />
            <AppText variant="caption">{comuna.visibility === 'private' ? 'Só membros aprovados da comuna' : 'Quem visitar a biblioteca da comuna'}{comuna.status === 'archived' ? ' · Arquivada' : ''}</AppText></View>)}
          {!availableMemberships.length && memberships.status === 'success' ? <AppText>Você ainda não participa de nenhuma comuna.</AppText> : null}
        </> : null}
        <AppText variant="heading">Biblioteca Pública · Opcional</AppText>
        <AppText>Só entra quando você marcar. Dá para retirar depois.</AppText>
        {canPublicize ? <PillButton label={isPublic ? '✓ Disponível para qualquer pessoa na Popularia' : 'Disponibilizar para qualquer pessoa na Popularia'} selected={isPublic} variant={isPublic ? 'dark' : 'outline'} onPress={() => setPublic(!isPublic)} /> : <AppText variant="caption">Só a propriedade ou a moderação da comuna pode tornar este PDF público.</AppText>}
      </> : null}
      {step === 4 ? <>
        <AppText variant="display">Confira antes de enviar</AppText><AppText>Nada vai para o feed. O PDF entra na biblioteca com o acesso escolhido.</AppText>
        <AppText variant="heading">{title}</AppText><AppText>{description}</AppText><AppText>Coleção: {chosenCollection?.name ?? original?.collection?.name ?? 'Coleção selecionada'}</AppText>
        <AppText>Arquivo: {file?.name ?? 'PDF original preservado'}</AppText>
        <AppText>Quem poderá abrir: {({ private: 'só você', followers: 'seus seguidores', visitors: 'quem visitar a comuna', members: 'membros da comuna', moderators: 'coordenação da comuna' })[access]}.</AppText>
        {shares.map((slug) => <AppText key={slug}>Também em c/ {availableMemberships.find((c) => c.id === slug)?.name ?? slug}</AppText>)}
        <AppText>{isPublic ? 'Também na Biblioteca Pública.' : 'Fica fora da Biblioteca Pública.'}</AppText>
        <AppText variant="caption">Ao enviar, você confirma que pode compartilhar este documento e que ele segue as regras do Popularia.</AppText>
        {busy ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }} style={styles.group}><ActivityIndicator color={Colors.red} /><AppText>{progress < 100 ? `Enviando PDF · ${progress}%` : 'Validando e guardando o PDF…'}</AppText><PillButton label="Interromper envio" variant="outline" onPress={() => controller.current?.abort()} /></View> : null}
      </> : null}
      {step === 5 && done ? <>
        <AppText variant="display">{params.edit ? 'Documento atualizado' : 'PDF na biblioteca'}</AppText><AppText>“{done.title}” está na coleção {done.collection?.name}.</AppText><AppText>{done.isPublic ? 'Também na Biblioteca Pública' : 'Fora da Biblioteca Pública'}</AppText>
        <PillButton label={params.composerKey ? 'Voltar para a publicação' : 'Ver na biblioteca'} onPress={() => exit(params.composerKey ? 'composer' : 'library')} />
        <PillButton label="Ver documento" variant="outline" onPress={() => exit('document')} />
        {!params.composerKey ? <PillButton label="Publicar no feed" variant="outline" onPress={() => exit('post')} /> : null}
      </> : null}
      {error ? <AppText color={Colors.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
      {step < 5 ? <PillButton label={busy ? 'Enviando…' : step === 4 ? params.edit ? 'Salvar alterações' : error ? 'Tentar enviar novamente' : 'Enviar PDF' : 'Continuar'} disabled={busy || selecting} onPress={next} /> : null}
    </ScrollView>
    <CollectionEditor key={String(newCollection)} visible={newCollection} onClose={() => setNewCollection(false)} comuna={comunaSlug} onDone={(collection) => { if (collection) { collections.append(collection); setCollectionId(collection.id); } }} />
  </KeyboardView></Screen>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, bar: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.five, gap: Spacing.two, borderBottomWidth: 1.5, borderColor: Colors.ink }, content: { padding: Spacing.five, gap: Spacing.four, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.seven }, group: { gap: Spacing.two } });
