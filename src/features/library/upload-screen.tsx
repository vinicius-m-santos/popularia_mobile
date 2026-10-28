import { AppText } from '@/components/app-text';
import { CheckboxMark, RadioMark } from '@/components/choice-marks';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getComuna, getMyComunas } from '@/features/comunas/api';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import { getTopicGroups } from '@/features/onboarding/api';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { describeError } from '@/lib/errors';
import { initialsOf } from '@/lib/format';
import { goBack } from '@/lib/routes';
import type { TopicId } from '@/types/models';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { editDocument, getDocument, listCollections, shareDocument, uploadDocument } from './api';
import { CollectionEditor } from './collection-editor';
import { returnAttachment } from './composer-attachment';
import { sizeLabel } from './document-card';
import { pickPdf } from './transfers';
import type { DocumentAccess, LibraryDocument, PickedPdf } from './types';

const ACCESS_COPY: Record<DocumentAccess, { title: string; description: string }> = {
  private: { title: 'Só você', description: 'Visível apenas para você' },
  followers: { title: 'Seus seguidores', description: 'Visível para seus seguidores' },
  visitors: { title: 'Quem visitar a comuna', description: 'Visível para quem acessar a comuna' },
  members: { title: 'Só membros', description: 'Visível para membros da comuna' },
  moderators: { title: 'Só coordenação', description: 'Visível para a coordenação da comuna' },
};

function SectionLabel({ children, aside }: { children: ReactNode; aside?: string }) {
  return <View style={styles.sectionLabelRow}><AppText variant="label">{children}</AppText>{aside ? <AppText variant="caption" style={styles.sectionAside}>{aside}</AppText> : null}</View>;
}

function ReviewHeader({ label, onEdit }: { label: string; onEdit: () => void }) {
  return <View style={styles.reviewHeader}><AppText variant="label">{label}</AppText><Pressable accessibilityRole="button" accessibilityLabel={`Editar ${label.toLocaleLowerCase('pt-BR')}`} onPress={onEdit} hitSlop={8}><AppText style={styles.editLink}>Editar</AppText></Pressable></View>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.reviewRow}><AppText variant="bodyStrong" style={styles.reviewKey}>{label}</AppText><AppText style={styles.reviewValue}>{value}</AppText></View>;
}

export function titleFromFilename(filename: string) {
  return filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => `${space}${letter.toLocaleUpperCase('pt-BR')}`);
}

export function uploadClientId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (key) => { const n = Math.floor(Math.random() * 16); return (key === 'x' ? n : (n & 3) | 8).toString(16); });
}
export default function UploadScreen() {
  const params = useLocalSearchParams<{ comuna?: string; collection?: string; edit?: string; composerKey?: string }>();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [title, setTitle] = useState('');
  const titleEdited = useRef(false);
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
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
  const topicGroups = useAsyncData(useCallback(() => getTopicGroups(), []));
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
      setOriginal(document); setTitle(document.title ?? ''); setDescription(document.description ?? ''); setAuthor(document.author ?? ''); setTopic(document.topic);
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
      if (selected && alive.current) {
        setFile(selected);
        setClientId(uploadClientId());
        if (!titleEdited.current && !title) setTitle(titleFromFilename(selected.name));
      }
    } catch (e) { if (alive.current) setError(describeError(e)); }
    finally { if (alive.current) setSelecting(false); }
  };
  const confirm = async () => {
    if (pending.current) return;
    if (!collectionId || !topic || !title.trim() || (!params.edit && !file)) { setError('Confira o arquivo e preencha os campos obrigatórios.'); return; }
    pending.current = true; setBusy(true); setError(''); setProgress(0);
    const abort = new AbortController(); controller.current = abort;
    try {
      let result: LibraryDocument;
      if (params.edit) {
        const authorValue = author.trim();
        result = await editDocument(params.edit, { title: title.trim(), description: description.trim(), ...(authorValue ? { author: authorValue } : { clearAuthor: true }), collectionId, access, topic, clearTopic: topic === null, ...(canPublicize ? { isPublic } : {}) });
        if (original?.viewer.canShare) {
          const previous = original.distributions?.map((d) => d.slug) ?? [];
          for (const slug of shares.filter((s) => !previous.includes(s))) await shareDocument(params.edit, slug, true);
          for (const slug of previous.filter((s) => !shares.includes(s))) await shareDocument(params.edit, slug, false);
          result = await getDocument(params.edit);
        }
      } else {
        result = await uploadDocument(file!, { title: title.trim(), description: description.trim(), ...(author.trim() ? { author: author.trim() } : {}), collectionId, access, topic, isPublic, sharedWith: shares, clientId }, (percent) => { if (alive.current) setProgress(percent); }, abort.signal);
      }
      if (alive.current) { setDone(result); setStep(5); }
    } catch (e) { if (alive.current) setError(`${params.edit ? 'Não foi possível concluir todas as alterações. Confira o documento antes de tentar novamente. ' : ''}${describeError(e)}`); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const next = () => {
    setError('');
    if (step === 1 && ((!file && !params.edit) || !title.trim() || (params.edit && !original))) { setError('Selecione um PDF e dê um nome ao documento.'); return; }
    if (step === 2 && !topic) { setError('Escolha um assunto para o documento.'); return; }
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
    else goBack();
  };
  const availableMemberships = memberships.data ?? [];
  const chosenCollection = collections.items.find((item) => item.id === collectionId);
  const topicLabel = topicGroups.data?.flatMap((group) => group.topics).find((item) => item.id === topic)?.label ?? (topic ? 'Assunto selecionado' : '—');
  return <Screen><KeyboardView style={styles.flex}>
    <View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={() => { if (step > 1 && step < 5 && !busy) setStep(step - 1); else goBack(); }} />
      <View style={styles.barDivider} />
      <View style={styles.flex}><AppText variant="label" style={styles.barTitle}>{params.edit ? 'Editar documento' : 'Adicionar arquivo'}</AppText><AppText variant="caption" style={styles.barSubtitle}>{comunaSlug ? `Biblioteca de c/ ${origin.data?.name ?? comunaSlug}` : 'Sua biblioteca'}</AppText></View>
      <AppText variant="caption" style={styles.stepCounter}>{step < 5 ? `${step} de 4` : 'Concluído'}</AppText></View>
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {step === 1 ? <>
        <View style={styles.stepIntro}><AppText variant="display" style={styles.stepTitle}>Arquivo e informações</AppText><AppText style={styles.stepDescription}>Selecione o PDF do seu dispositivo e preencha as informações básicas.</AppText></View>
        <View style={styles.fileSection}>
          <AppText variant="label">Arquivo</AppText>
          {params.edit ? <View style={styles.immutableFile}><Icon name="document" size={31} /><View style={styles.flex}><AppText variant="bodyStrong">PDF original preservado</AppText><AppText variant="caption">O arquivo é imutável. Para outro PDF, faça um novo envio.</AppText></View></View> : <Pressable accessibilityRole="button" accessibilityLabel={selecting ? 'Abrindo arquivos' : 'Selecionar arquivo'} disabled={selecting} onPress={select} style={({ pressed }) => [styles.filePicker, (pressed || selecting) && styles.pressed]}>
            <View style={styles.filePickerIcon}><Icon name="document" size={34} /></View><View style={styles.flex}><AppText variant="bodyStrong">{selecting ? 'Abrindo arquivos…' : 'Selecionar arquivo'}</AppText><AppText variant="caption">PDF de até 25 MB.</AppText></View><Icon name="chevronRight" size={21} />
          </Pressable>}
          {file ? <View style={styles.selectedFile}><View style={styles.selectedFileIcon}><Icon name="document" size={27} color={Colors.paper} /></View><View style={styles.selectedFileCopy}><AppText variant="bodyStrong" numberOfLines={2} ellipsizeMode="middle">{file.name}</AppText><AppText variant="caption">{sizeLabel(file.size ?? null)} · PDF</AppText></View><IconButton icon="close" accessibilityLabel="Remover arquivo selecionado" onPress={() => setFile(null)} /></View> : null}
        </View>
        <TextField appearance="editorial" label="Nome do documento" value={title} onChangeText={(value) => { titleEdited.current = true; setTitle(value); }} maxLength={160} truncateWhenBlurred />
        <TextField appearance="editorial" label="Autoria" labelAside="opcional" placeholder="Quem escreveu ou organizou?" hint="Informe manualmente; a autoria não é extraída do arquivo." value={author} onChangeText={setAuthor} maxLength={200} />
      </> : null}
      {step === 2 ? <>
        <View style={styles.stepIntro}><AppText variant="display" style={styles.stepTitle}>Detalhes</AppText><AppText style={styles.stepDescription}>Adicione uma descrição, escolha o assunto e organize o documento.</AppText></View>
        <TextField appearance="editorial" label="Descrição curta" labelAside={`${description.length}/1000`} value={description} onChangeText={setDescription} maxLength={1000} multiline multilineHeight={148} />
        <SingleTopicField value={topic} onChange={setTopic} error={!topic && error.startsWith('Escolha um assunto') ? error : undefined} appearance="editorial" />
        <View style={styles.collectionSection}>
          <SectionLabel aside="obrigatório">Coleção</SectionLabel>
          <AppText variant="caption">Todo documento precisa estar em uma coleção.</AppText>
          {collections.status === 'loading' ? <StateView kind="loading" message="Carregando coleções" /> : null}
          {collections.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as coleções." onRetry={collections.refresh} /> : null}
          {collections.items.length ? <View style={styles.optionList}>
            {collections.items.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === collectionId }} accessibilityLabel={item.name} onPress={() => setCollectionId(item.id)} style={({ pressed }) => [styles.collectionOption, pressed && styles.pressed]}>
              <Icon name="folder" size={24} /><AppText variant="bodyStrong" style={styles.flex}>{item.name}</AppText><RadioMark selected={item.id === collectionId} />
            </Pressable>)}
          </View> : null}
          {chosenCollection === undefined && collectionId ? <AppText variant="caption">Uma coleção foi selecionada. Você pode escolher outra acima.</AppText> : null}
          {collections.hasMore ? <EditorialAction label="Mais coleções" icon="chevronDown" disabled={collections.loadingMore} onPress={collections.loadMore} /> : null}
          {collections.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais coleções." onRetry={collections.loadMore} /> : null}
          <EditorialAction label="Criar nova coleção" icon="plus" onPress={() => setNewCollection(true)} />
        </View>
      </> : null}
      {step === 3 ? <>
        <View style={styles.stepIntro}><AppText variant="display" style={styles.stepTitle}>Onde disponibilizar</AppText><AppText style={styles.stepDescription}>O arquivo fica na {comunaSlug ? `biblioteca de c/ ${origin.data?.name ?? comunaSlug}` : 'sua biblioteca'}. Escolha também onde ele será compartilhado.</AppText></View>
        <View style={styles.availabilitySection}>
          <SectionLabel aside="obrigatório">{comunaSlug ? 'Biblioteca da comuna' : 'Sua biblioteca'}</SectionLabel>
          <View style={styles.optionList}>
            {(comunaSlug ? [...(origin.data?.visibility === 'public' ? ['visitors' as const] : []), 'members' as const, ...(canPublicize ? ['moderators' as const] : [])] : ['private' as const, 'followers' as const]).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: access === value }} accessibilityLabel={ACCESS_COPY[value].title} onPress={() => setAccess(value)} style={({ pressed }) => [styles.availabilityOption, pressed && styles.pressed]}>
              <View style={styles.availabilityIcon}><Icon name={comunaSlug ? 'institution' : 'user'} size={30} /></View>
              <View style={styles.flex}><AppText variant="bodyStrong">{ACCESS_COPY[value].title}</AppText><AppText variant="caption">{ACCESS_COPY[value].description}</AppText></View>
              <RadioMark selected={access === value} />
            </Pressable>)}
          </View>
        </View>
        {!comunaSlug ? <>
          <View style={styles.availabilitySection}>
            <SectionLabel aside="opcional">Comunas</SectionLabel>
            <AppText variant="caption">Compartilhar numa comuna não torna o arquivo público nem o coloca na Biblioteca Pública.</AppText>
            {memberships.status === 'loading' ? <StateView kind="loading" message="Carregando suas comunas" /> : null}
            {memberships.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar suas comunas." onRetry={memberships.reload} /> : null}
            {availableMemberships.length ? <View style={styles.optionList}>{availableMemberships.map((comuna) => {
              const checked = shares.includes(comuna.id);
              const disabled = comuna.status === 'archived' && !checked;
              return <Pressable key={comuna.id} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} accessibilityLabel={`c/ ${comuna.name}`} disabled={disabled} onPress={() => setShares((items) => checked ? items.filter((slug) => slug !== comuna.id) : [...items, comuna.id])} style={({ pressed }) => [styles.comunaOption, disabled && styles.disabled, pressed && styles.pressed]}>
                <CheckboxMark checked={checked} /><ComunaMark initials={comuna.initials ?? initialsOf(comuna.name)} tone={comuna.tone ?? 'red'} size={42} />
                <View style={styles.flex}><AppText variant="bodyStrong">c/ {comuna.name}</AppText><AppText variant="caption">{comuna.visibility === 'private' ? 'Visível para membros da comuna' : 'Visível para quem visitar a comuna'}{comuna.status === 'archived' ? ' · Arquivada' : ''}</AppText></View>
              </Pressable>;
            })}</View> : null}
            {!availableMemberships.length && memberships.status === 'success' ? <AppText>Você ainda não participa de nenhuma comuna.</AppText> : null}
          </View>
        </> : null}
        <View style={styles.availabilitySection}>
          <SectionLabel aside="opcional">Biblioteca pública</SectionLabel>
          {canPublicize ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isPublic }} accessibilityLabel="Biblioteca Pública" onPress={() => setPublic(!isPublic)} style={({ pressed }) => [styles.publicOption, pressed && styles.pressed]}>
            <CheckboxMark checked={isPublic} /><Icon name="globe" size={32} /><View style={styles.flex}><AppText variant="bodyStrong">Biblioteca Pública</AppText><AppText variant="caption">Disponível para todas as pessoas no Popularia</AppText></View>
          </Pressable> : <AppText variant="caption">Só a propriedade ou a moderação da comuna pode tornar este arquivo público.</AppText>}
        </View>
      </> : null}
      {step === 4 ? <>
        <View style={styles.stepIntro}><AppText variant="display" style={styles.stepTitle}>Confira antes de enviar</AppText><AppText style={styles.stepDescription}>Verifique se as informações estão corretas.</AppText></View>
        <View style={styles.reviewCard}>
          <ReviewHeader label="Arquivo" onEdit={() => setStep(1)} />
          <View style={styles.reviewFile}><View style={styles.selectedFileIcon}><Icon name="document" size={27} color={Colors.paper} /></View><View style={styles.flex}><AppText numberOfLines={2} ellipsizeMode="middle">{file?.name ?? 'PDF original preservado'}</AppText><AppText variant="caption">{file ? `${sizeLabel(file.size ?? null)} · PDF` : 'Arquivo original · PDF'}</AppText></View></View>
        </View>
        <View style={styles.reviewCard}>
          <ReviewHeader label="Informações" onEdit={() => setStep(1)} />
          <View style={styles.reviewRows}>
            <ReviewRow label="Nome" value={title} />
            <ReviewRow label="Autoria" value={author.trim() || '—'} />
            <ReviewRow label="Descrição" value={description.trim() || '—'} />
            <ReviewRow label="Assunto" value={topicLabel} />
            <ReviewRow label="Coleção" value={chosenCollection?.name ?? original?.collection?.name ?? 'Coleção selecionada'} />
          </View>
        </View>
        <View style={styles.reviewCard}>
          <ReviewHeader label="Onde disponibilizar" onEdit={() => setStep(3)} />
          <View style={styles.distributionList}>
            <View style={styles.distributionRow}><Icon name={comunaSlug ? 'institution' : 'user'} size={30} /><View style={styles.flex}><AppText variant="bodyStrong">{comunaSlug ? `c/ ${origin.data?.name ?? comunaSlug}` : 'Sua biblioteca'}</AppText><AppText variant="caption">{ACCESS_COPY[access].title}</AppText></View></View>
            {shares.map((slug) => { const comuna = availableMemberships.find((item) => item.id === slug); return <View key={slug} style={styles.distributionRow}><ComunaMark initials={comuna?.initials ?? initialsOf(comuna?.name ?? slug)} tone={comuna?.tone ?? 'red'} size={38} /><View style={styles.flex}><AppText variant="bodyStrong">c/ {comuna?.name ?? slug}</AppText><AppText variant="caption">Visível para membros da comuna</AppText></View></View>; })}
            {isPublic ? <View style={styles.distributionRow}><Icon name="globe" size={30} /><View style={styles.flex}><AppText variant="bodyStrong">Biblioteca Pública</AppText><AppText variant="caption">Disponível para todas as pessoas</AppText></View></View> : null}
          </View>
        </View>
        <AppText variant="caption">Ao enviar, você confirma que pode compartilhar este documento e que ele segue as regras do Popularia.</AppText>
        {busy ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }} style={styles.group}><ActivityIndicator color={Colors.red} /><AppText>{progress < 100 ? `Enviando PDF · ${progress}%` : 'Validando e guardando o PDF…'}</AppText><PillButton label="Interromper envio" variant="outline" onPress={() => controller.current?.abort()} /></View> : null}
      </> : null}
      {step === 5 && done ? <>
        <AppText variant="display">{params.edit ? 'Documento atualizado' : 'PDF na biblioteca'}</AppText><AppText>“{done.title}” está na coleção {done.collection?.name}.</AppText><AppText>{done.isPublic ? 'Também na Biblioteca Pública' : 'Fora da Biblioteca Pública'}</AppText>
        <PillButton label={params.composerKey ? 'Voltar para a publicação' : 'Ver na biblioteca'} onPress={() => exit(params.composerKey ? 'composer' : 'library')} />
        <PillButton label="Ver documento" variant="outline" onPress={() => exit('document')} />
        {!params.composerKey ? <PillButton label="Publicar no feed" variant="outline" onPress={() => exit('post')} /> : null}
      </> : null}
      {error && !(step === 2 && error.startsWith('Escolha um assunto')) ? <AppText color={Colors.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
      {step < 5 ? <View style={styles.wizardActions}>
        {step > 1 ? <EditorialAction label="Voltar" icon="back" disabled={busy} onPress={() => { setError(''); setStep(step - 1); }} style={styles.wizardBack} /> : null}
        <EditorialAction label={busy ? 'Enviando…' : step === 4 ? params.edit ? 'Salvar alterações' : error ? 'Tentar enviar novamente' : 'Enviar arquivo' : 'Continuar'} icon={step === 4 ? params.edit ? 'check' : 'send' : 'arrowRight'} iconPosition="trailing" tone="red" disabled={busy || selecting} onPress={next} style={styles.wizardNext} />
      </View> : null}
    </ScrollView>
    <CollectionEditor key={String(newCollection)} visible={newCollection} onClose={() => setNewCollection(false)} comuna={comunaSlug} onDone={(collection) => { if (collection) { collections.append(collection); setCollectionId(collection.id); } }} />
  </KeyboardView></Screen>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.one, gap: Spacing.two, borderBottomWidth: 1.5, borderColor: Colors.ink },
  barDivider: { width: 1.5, height: 28, backgroundColor: Colors.ink },
  barTitle: { fontSize: 12.5 },
  barSubtitle: { color: Colors.muted },
  stepCounter: { paddingHorizontal: Spacing.three },
  content: { flexGrow: 1, padding: Spacing.five, gap: Spacing.four, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.seven },
  stepIntro: { gap: Spacing.three, marginBottom: Spacing.three },
  stepTitle: { fontSize: 42, lineHeight: 45 },
  stepDescription: { fontSize: 17, lineHeight: 24 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.three },
  sectionAside: { color: Colors.muted },
  fileSection: { gap: Spacing.three },
  filePicker: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, paddingHorizontal: Spacing.four },
  filePickerIcon: { width: 42, alignItems: 'center' },
  immutableFile: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, padding: Spacing.four },
  selectedFile: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three },
  selectedFileIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.red },
  selectedFileCopy: { flex: 1, minWidth: 0 },
  collectionSection: { gap: Spacing.three, paddingTop: Spacing.two },
  availabilitySection: { gap: Spacing.three },
  optionList: { borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  collectionOption: { minHeight: 58, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  availabilityOption: { minHeight: 76, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  availabilityIcon: { width: 38, alignItems: 'center' },
  comunaOption: { minHeight: 68, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  publicOption: { minHeight: 72, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  disabled: { opacity: 0.45 },
  wizardActions: { flexDirection: 'row', gap: Spacing.three, marginTop: 'auto', paddingTop: Spacing.six },
  wizardBack: { flex: 0.72 },
  wizardNext: { flex: 1.15 },
  pressed: { opacity: 0.68 },
  group: { gap: Spacing.two },
  reviewCard: { borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, padding: Spacing.four, gap: Spacing.four },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  editLink: { textDecorationLine: 'underline' },
  reviewFile: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  reviewRows: { gap: Spacing.three },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  reviewKey: { width: 92 },
  reviewValue: { flex: 1, minWidth: 0 },
  distributionList: { gap: Spacing.four },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
});
