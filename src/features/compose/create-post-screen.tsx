import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { getComunas, getMyComunas } from '@/features/comunas/api';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { useInteractions } from '@/features/interactions/interactions-context';
import { getDocument } from '@/features/library/api';
import { subscribeAttachment } from '@/features/library/composer-attachment';
import { DocumentCard } from '@/features/library/document-card';
import { LibraryPane } from '@/features/library/library-screen';
import type { LibraryDocument } from '@/features/library/types';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import { MentionSuggestions } from '@/features/mentions/mention-suggestions';
import { useMentionDraft } from '@/features/mentions/use-mention-draft';
import { createPost } from '@/features/posts/api';
import { POLL_MAX_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX, draftToPoll, pollDraftError, type PollDraft } from '@/features/posts/poll';
import { PostCard } from '@/features/posts/components/post-card';
import { PostAttachment } from '@/features/posts/components/post-attachment';
import { durationLabel, pickPostImage, pickPostVideo, uploadPostMedia, type LocalPostMedia } from '@/features/posts/post-media';
import { useAsyncData } from '@/hooks/use-async-data';
import { ApiError, describeError } from '@/lib/errors';
import { formatPeople } from '@/lib/format';
import type { Comuna, FeedItem, TopicId } from '@/types/models';

const MAX_LENGTH = 1000;
/** Seguidores do perfil de demonstração, para "Visível para…". */
const MY_FOLLOWERS = 312;

/** Destino da publicação: o próprio perfil ou uma comuna de que a pessoa participa. */
type Destination = { kind: 'perfil' } | { kind: 'comuna'; comuna: Comuna };

/** Texto para as recusas conhecidas de POST /posts. */
function publishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.type === '/errors/not-a-member') return 'Entre na comuna para publicar nela.';
    if (error.violations.body) return error.violations.body;
    if (error.violations.comunaId) return error.violations.comunaId;
    const pollViolation = Object.entries(error.violations).find(([path]) => path.startsWith('poll'));
    if (pollViolation) return pollViolation[1];
  }
  return `Não foi possível publicar. ${describeError(error)}`;
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Criar publicação (design 2f). Com a API, publica de verdade (só em comunas de que a pessoa
 * participa ou no próprio perfil); no modo demonstração, guarda só neste aparelho.
 */
export default function CreatePostScreen() {
  const me = useMe();
  const params = useLocalSearchParams<{ documentId?: string }>();
  const [pdfMode, setPdfMode] = useState(false);
  const [document, setDocument] = useState<LibraryDocument | null>(null);
  const [pickingDocument, setPickingDocument] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [media, setMedia] = useState<LocalPostMedia | null>(null);
  const [pickingMedia, setPickingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadController = useRef<AbortController | null>(null);
  const composerKey = useId();
  useEffect(() => subscribeAttachment(composerKey, (attachment) => { setDocument(attachment); setPdfMode(true); setMedia(null); }), [composerKey]);
  useEffect(() => {
    if (!params?.documentId) return;
    let active = true;
    getDocument(params.documentId).then((value) => { if (active && value.state === 'available') { setDocument(value); setPdfMode(true); setMedia(null); } }, () => { if (active) { setAttachmentError('Este documento não está mais disponível para você.'); setPdfMode(true); } });
    return () => { active = false; };
  }, [params?.documentId]);
  const { account, reloadAccount } = useAccount();
  const toast = useToast();
  const { membershipOf, addPost, notifyPostCreated } = useInteractions();
  // Na API, só as comunas de que a pessoa participa, segundo o servidor.
  const loadComunas = useCallback(() => (DEMO_MODE ? getComunas() : getMyComunas()), []);
  const comunas = useAsyncData(loadComunas);

  const draft = useMentionDraft();
  const text = draft.text;
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const optionSeq = useRef(2);
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [preview, setPreview] = useState(false);
  const [picking, setPicking] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const needsVerification = !DEMO_MODE && account !== null && !account.emailVerified;

  const joined = useMemo(
    () => (comunas.data ?? []).filter((c) => c.status !== 'archived' && (membershipOf(c.id) ?? c.viewerIsMember ?? false)),
    [comunas.data, membershipOf],
  );

  // Se a escolha deixou de valer (saiu da comuna), cai para a primeira comuna ou o perfil.
  const destination: Destination = useMemo(() => {
    if (chosenId === 'perfil') return { kind: 'perfil' };
    const comuna = joined.find((c) => c.id === chosenId) ?? joined[0];
    return comuna ? { kind: 'comuna', comuna } : { kind: 'perfil' };
  }, [chosenId, joined]);

  const composed = draft.compose();
  const trimmed = composed.body;
  const destinationsReady = chosenId === 'perfil' || comunas.data !== null;
  const canPublish = (!!document || !!media || trimmed.length > 0 || poll !== null) && !publishing && destinationsReady;
  const where = destination.kind === 'perfil' ? 'seu perfil' : `c/ ${destination.comuna.name}`;
  const disablePrevention = usePreventRemove(!leaving && (publishing || trimmed.length > 0 || !!document || !!media || poll !== null), ({ repeat }) => {
    if (publishingRef.current) return;
    Alert.alert('Descartar publicação?', 'O texto e os anexos deste rascunho serão perdidos.', [
      { text: 'Continuar escrevendo', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => { setLeaving(true); repeat(); } },
    ]);
  });

  const close = () => {
    if (publishingRef.current) return;
    leave();
  };

  const askToVerify = () =>
    Alert.alert(
      'Confirme seu e-mail',
      'Para publicar, confirme o e-mail da sua conta com o código que enviamos. Seu texto continua aqui.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Confirmar e-mail', onPress: () => router.push('/verificar-email') },
      ],
    );

  const publish = async () => {
    if (publishingRef.current) return;
    if (!destinationsReady) {
      toast.show('Aguarde carregar os destinos ou selecione seu perfil em Publicar em.');
      return;
    }
    if (pdfMode && !document) { toast.show('Escolha um PDF da biblioteca ou envie um novo.'); return; }
    const pollIssue = pollDraftError(poll);
    if (pollIssue) { toast.show(pollIssue); return; }
    if (!trimmed && !document && !media && !poll) {
      toast.show('Escreva algo antes de publicar.');
      return;
    }
    const comunaId = destination.kind === 'comuna' ? destination.comuna.id : null;

    if (DEMO_MODE) {
      publishingRef.current = true;
      setLeaving(true);
      disablePrevention();
      addPost({ comunaId, text: trimmed, ...(composed.mentions.length > 0 ? { mentions: composed.mentions } : {}), ...(poll ? { poll: { ...draftToPoll(poll), id: `local-poll-${Date.now()}` } } : {}) });
      toast.show(`Publicado em ${where} só neste aparelho. Nada foi enviado.`);
      if (comunaId) router.dismissTo({ pathname: '/comuna/[id]', params: { id: comunaId } });
      else router.dismissTo('/perfil');
      return;
    }

    if (needsVerification) return askToVerify();
    // Comunas da API sempre trazem o UUID; sem ele, nunca cair para "publicar no perfil" por engano.
    const comunaServerId = destination.kind === 'comuna' ? destination.comuna.serverId : null;
    if (comunaServerId === undefined) {
      toast.show('Não foi possível identificar a comuna. Escolha o destino de novo.');
      return;
    }
    publishingRef.current = true;
    setPublishing(true);
    try {
      let mediaId = media?.uploaded?.id;
      let readyMedia = media;
      if (media && !mediaId) {
        const controller = new AbortController();
        uploadController.current = controller;
        setUploadProgress(0);
        const uploaded = await uploadPostMedia(media, setUploadProgress, controller.signal);
        readyMedia = { ...media, uploaded };
        mediaId = uploaded.id;
        setMedia(readyMedia);
      }
      await createPost({
        comunaServerId,
        text: trimmed,
        ...(composed.mentions.length > 0 ? { mentions: composed.mentions } : {}),
        ...(pdfMode && document ? { documentId: document.id } : {}),
        ...(mediaId ? { mediaId } : {}),
        ...(destination.kind === 'perfil' && topic ? { topic } : {}),
        ...(poll ? { poll: { question: poll.question.trim(), options: poll.options.map((option) => ({ label: option.label.trim() })) } } : {}),
      });
    } catch (error) {
      publishingRef.current = false;
      setPublishing(false);
      if (error instanceof ApiError && error.type === '/errors/email-not-verified') {
        // A conta no aparelho estava desatualizada: recarrega para os avisos ficarem certos.
        reloadAccount().catch(() => {});
        return askToVerify();
      }
      toast.show(publishErrorMessage(error));
      return;
    } finally {
      uploadController.current = null;
    }
    notifyPostCreated();
    toast.show(`Publicado em ${where}.`);
    setLeaving(true);
    disablePrevention();
    // Publicações no perfil aparecem no feed "Para você" (o perfil próprio ainda é fictício).
    if (comunaId) router.dismissTo({ pathname: '/comuna/[id]', params: { id: comunaId } });
    else router.dismissTo('/');
  };

  const soon = (what: string) => () => toast.show(`${what} chega numa próxima etapa.`);

  const selectMedia = async (kind: 'image' | 'video') => {
    if (pickingMedia || publishing) return;
    setPickingMedia(true);
    try {
      const selected = kind === 'image' ? await pickPostImage() : await pickPostVideo();
      if (!selected) return;
      setMedia(selected);
      setDocument(null);
      setPdfMode(false);
      setAttachmentError('');
    } catch (error) {
      toast.show(describeError(error));
    } finally {
      setPickingMedia(false);
    }
  };

  const previewItem: FeedItem = {
    id: 'preview',
    document: pdfMode ? document : null,
    attachment: media ? { id: media.uploaded?.id ?? 'preview-media', type: media.kind, mimeType: media.mimeType, byteSize: media.size, width: media.width, height: media.height, durationMs: media.durationMs, url: media.uri } : null,
    authorId: me.id,
    comunaId: destination.kind === 'comuna' ? destination.comuna.id : null,
    createdAt: new Date().toISOString(),
    text: trimmed || (pdfMode ? '' : 'Seu texto aparece aqui.'),
    ...(composed.mentions.length > 0 ? { mentions: composed.mentions } : {}),
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    author: me,
    comuna: destination.kind === 'comuna' ? destination.comuna : null,
    event: null,
    topCommentAuthor: null,
    poll: poll ? draftToPoll(poll) : null,
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardView style={styles.flex}>
        <View style={styles.bar}>
          <IconButton icon="back" size={24} accessibilityLabel="Fechar" onPress={close} />
          <View style={styles.barDivider} />
          <AppText variant="label" style={styles.barTitle} accessibilityRole="header" numberOfLines={1}>
            Nova publicação
          </AppText>
          <Pressable
            onPress={publish}
            disabled={!canPublish || publishing}
            accessibilityRole="button"
            accessibilityLabel={publishing ? 'Publicando' : 'Publicar'}
            accessibilityState={{ disabled: !canPublish, busy: publishing }}
            accessibilityHint={canPublish ? `Publica em ${where}` : 'Escreva algo para publicar'}
            style={({ pressed }) => [
              styles.publish,
              !canPublish && !publishing && styles.publishIdle,
              (pressed || publishing) && styles.pressed,
            ]}>
            {publishing ? (
              <ActivityIndicator color={Colors.paper} />
            ) : (
              <AppText style={styles.publishLabel} color={canPublish ? Colors.paper : Colors.muted}>
                Publicar
              </AppText>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
          {comunas.status === 'loading' && !comunas.data ? (
            <ActivityIndicator color={Colors.red} accessibilityLabel="Carregando destinos" />
          ) : null}
          {comunas.status === 'error' ? (
            <StateView kind="error" message="Não conseguimos carregar suas comunas." onRetry={comunas.reload} />
          ) : null}
          {needsVerification ? (
            <Pressable
              onPress={() => router.push('/verificar-email')}
              accessibilityRole="button"
              accessibilityHint="Abre a confirmação de e-mail"
              style={({ pressed }) => [styles.verify, pressed && styles.pressed]}>
              <AppText style={styles.verifyText} color={Colors.ink}>
                Confirme seu e-mail para publicar. Você pode escrever agora e publicar depois de confirmar.{' '}
                <AppText style={[styles.verifyText, styles.verifyLink]} color={Colors.red}>
                  Confirmar e-mail
                </AppText>
              </AppText>
            </Pressable>
          ) : null}
          <View>
            <AppText variant="label" style={styles.fieldLabel}>
              Publicar em
            </AppText>
            <Pressable
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              accessibilityLabel={`Publicar em ${where}. Trocar destino`}
              style={({ pressed }) => [styles.dest, pressed && styles.pressed]}>
              <DestinationMark destination={destination} me={me} />
              <View style={styles.destText}>
                <AppText style={styles.destName} numberOfLines={1}>
                  {destination.kind === 'perfil' ? 'Meu perfil' : `c/ ${destination.comuna.name}`}
                </AppText>
                <AppText style={styles.destSub} color={Colors.muted} numberOfLines={1}>
                  {destination.kind === 'perfil'
                    ? DEMO_MODE
                      ? `Visível para seus ${MY_FOLLOWERS} seguidores`
                      : 'Visível no seu perfil e no feed'
                    : `Visível para ${formatPeople(destination.comuna.memberCount)} membros da comuna`}
                </AppText>
              </View>
              <Icon name="chevronRight" size={24} />
            </Pressable>
          </View>

          {destination.kind === 'perfil' && !DEMO_MODE ? <SingleTopicField value={topic} onChange={setTopic} optional disabled={publishing} /> : null}

          <View>
            <AppText variant="label" style={styles.sectionLabel}>
              Tipo de publicação
            </AppText>
            <View style={styles.typeGrid} role="tablist">
              <TypeButton icon="document" label="Escrever" active onPress={() => setPreview(false)} />
              <TypeButton icon="calendar" label="Chamado" onPress={soon('Criar chamado')} />
              <TypeButton icon="poll" label="Enquete" active={poll !== null} onPress={() => { if (!poll) setPoll({ question: '', options: [{ key: 'option-1', label: '' }, { key: 'option-2', label: '' }] }); }} />
            </View>
          </View>

          <View>
            <View style={styles.sectionHeading}>
              <AppText variant="label" style={styles.sectionLabel}>
                Conteúdo
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={preview ? 'Editar publicação' : 'Pré-visualizar publicação'}
                onPress={() => setPreview((value) => !value)}
                style={({ pressed }) => pressed && styles.pressed}>
                <AppText style={styles.previewToggle} color={Colors.red}>
                  {preview ? 'Editar' : 'Pré-visualizar'}
                </AppText>
              </Pressable>
            </View>
            {preview ? (
              <View
                style={styles.previewBox}
                pointerEvents="none"
                accessible
                accessibilityLabel={`Pré-visualização: ${previewItem.text}`}
                importantForAccessibility="no-hide-descendants">
                <PostCard item={previewItem} />
              </View>
            ) : (
              <View style={styles.contentBox}>
                {draft.query ? <MentionSuggestions query={draft.query.query} onSelect={draft.insert} /> : null}
                <View style={styles.writeRow}>
                  <Avatar initials={me.initials} tone={me.tone} size={38} userId={me.id} imageUrl={me.avatarUrl} />
                  <TextInput
                    editable={!publishing}
                    scrollEnabled={false}
                    value={text}
                    onChangeText={draft.onChangeText}
                    onSelectionChange={(event) => draft.onSelectionChange(event.nativeEvent.selection)}
                    {...(draft.selection ? { selection: draft.selection } : {})}
                    maxLength={MAX_LENGTH}
                    multiline
                    autoFocus
                    textAlignVertical="top"
                    placeholder={pdfMode ? 'Conte por que este documento importa…' : media ? 'Conte o contexto desta mídia…' : 'Conte para a comuna o que está acontecendo…'}
                    placeholderTextColor={Colors.placeholder}
                    accessibilityLabel="Texto da publicação"
                    style={styles.input}
                  />
                </View>
                <AppText style={styles.counter} color={text.length >= MAX_LENGTH ? Colors.red : Colors.muted}>
                  {text.length}/{MAX_LENGTH}
                </AppText>
              </View>
            )}
          </View>

          <View>
            <AppText variant="label" style={styles.sectionLabel}>
              Adicionar mídia (opcional)
            </AppText>
            <View style={styles.mediaGrid}>
              <MediaButton icon="document" label="PDF" caption="Até 25 MB" onPress={() => { setPdfMode(true); setMedia(null); }} />
              <MediaButton icon="image" label="Imagem" caption="Até 10 MB" onPress={() => selectMedia('image')} />
              <MediaButton icon="camera" label="Vídeo" caption="Até 100 MB · 30 s" onPress={() => selectMedia('video')} />
            </View>
          </View>

          {media ? <View style={styles.pdfSection}>
            <View style={styles.sectionHeading}><AppText variant="label" style={styles.sectionLabel}>{media.kind === 'image' ? 'Imagem anexada' : 'Vídeo anexado'}</AppText>{media.kind === 'video' ? <AppText variant="caption">{durationLabel(media.durationMs)}</AppText> : null}</View>
            <PostAttachment media={{ id: media.uploaded?.id ?? 'local', type: media.kind, mimeType: media.mimeType, byteSize: media.size, width: media.width, height: media.height, durationMs: media.durationMs, url: media.uri }} localUri={media.uri} />
            {publishing && !media.uploaded ? <View><AppText variant="caption">Enviando mídia · {uploadProgress}%</AppText><EditorialAction label="Interromper envio" icon="close" onPress={() => uploadController.current?.abort()} /></View> : null}
            <EditorialAction label={`Trocar ${media.kind === 'image' ? 'imagem' : 'vídeo'}`} icon="edit" onPress={() => selectMedia(media.kind)} />
            <EditorialAction label="Remover mídia da publicação" icon="trash" onPress={() => setMedia(null)} />
          </View> : null}

          {poll ? <View style={styles.pdfSection}>
            <AppText variant="label" style={styles.sectionLabel}>Enquete</AppText>
            <TextField appearance="editorial" label="Pergunta" labelAside={`${poll.question.length}/${POLL_QUESTION_MAX}`} value={poll.question} onChangeText={(question) => setPoll((current) => current ? { ...current, question } : current)} maxLength={POLL_QUESTION_MAX} placeholder="Ex.: Qual livro vamos ler?" editable={!publishing} />
            {poll.options.map((option, index) => <View key={option.key} style={styles.pollOption}>
              <View style={styles.flex}><TextField appearance="editorial" label={`Opção ${index + 1}`} value={option.label} onChangeText={(label) => setPoll((current) => current ? { ...current, options: current.options.map((item) => item.key === option.key ? { ...item, label } : item) } : current)} maxLength={POLL_OPTION_MAX} placeholder={index === 0 ? 'Ex.: O cortiço' : index === 1 ? 'Ex.: Capitães da Areia' : 'Ex.: Uma outra opção'} editable={!publishing} /></View>
              {poll.options.length > 2 ? <IconButton icon="close" size={18} accessibilityLabel={`Remover opção ${index + 1}`} onPress={() => setPoll((current) => current ? { ...current, options: current.options.filter((item) => item.key !== option.key) } : current)} style={styles.pollRemove} /> : null}
            </View>)}
            {poll.options.length < POLL_MAX_OPTIONS ? <EditorialAction label="Adicionar opção" icon="plus" onPress={() => { optionSeq.current += 1; const key = `option-${optionSeq.current}`; setPoll((current) => current && current.options.length < POLL_MAX_OPTIONS ? { ...current, options: [...current.options, { key, label: '' }] } : current); }} /> : <AppText variant="caption">Máximo de 6 opções.</AppText>}
            <EditorialAction label="Remover enquete" icon="trash" onPress={() => setPoll(null)} />
          </View> : null}

          {pdfMode ? <View style={styles.pdfSection}>
            <AppText variant="label" style={styles.sectionLabel}>PDF anexado</AppText>
            {attachmentError ? <AppText color={Colors.error}>{attachmentError}</AppText> : null}
            <AppText variant="caption">Use um documento da sua biblioteca ou envie um novo. O PDF não é duplicado e mantém o acesso que já tem.</AppText>
            {document ? <DocumentCard document={document} appearance="editorial" /> : null}
            {document && !document.isPublic ? <View style={styles.verify}>
              <AppText>{document.access === 'private' && !document.distributions?.length ? 'Só você pode abrir este PDF.' : 'Este PDF tem acesso restrito.'}</AppText>
              <AppText variant="caption">Publicar não concede acesso ao PDF.</AppText>
              {document.viewer.canEdit ? <EditorialAction label="Ajustar acesso do PDF" icon="edit" onPress={() => router.push({ pathname: '/biblioteca/enviar', params: { edit: document.id, composerKey } })} /> : null}
            </View> : null}
            <EditorialAction label="Escolher da biblioteca" icon="library" onPress={() => setPickingDocument(true)} />
            <EditorialAction label="Enviar novo PDF" icon="plus" onPress={() => router.push({ pathname: '/biblioteca/enviar', params: { composerKey } })} />
            <EditorialAction label="Remover PDF da publicação" icon="trash" onPress={() => { setDocument(null); setPdfMode(false); }} />
          </View> : null}
        </ScrollView>
      </KeyboardView>

      <BottomSheet scrollable={false} virtualized visible={pickingDocument} onClose={() => setPickingDocument(false)} title="Sua biblioteca">
        <View style={{ height: 480, flexShrink: 1 }}><LibraryPane scope="personal" owner={me.id} onSelect={(attachment) => { setDocument(attachment); setPdfMode(true); setMedia(null); setPickingDocument(false); }} /></View>
      </BottomSheet>
      <BottomSheet visible={picking} onClose={() => setPicking(false)} title="Publicar em">
        <DestinationOption
          selected={destination.kind === 'perfil'}
          mark={<Avatar initials={me.initials} tone={me.tone} size={42} userId={me.id} imageUrl={me.avatarUrl} />}
          name="Meu perfil"
          subtitle={DEMO_MODE ? `${MY_FOLLOWERS} seguidores` : 'Visível no seu perfil e no feed'}
          onPress={() => {
            setChosenId('perfil');
            setPicking(false);
          }}
        />
        {joined.map((c) => (
          <DestinationOption
            key={c.id}
            selected={destination.kind === 'comuna' && destination.comuna.id === c.id}
            mark={<ComunaMark initials={c.initials} tone={c.tone} size={42} />}
            name={`c/ ${c.name}`}
            subtitle={`${formatPeople(c.memberCount)} membros`}
            onPress={() => {
              setChosenId(c.id);
              setPicking(false);
            }}
          />
        ))}
        {comunas.status === 'loading' ? (
          <AppText variant="caption" style={styles.sheetNote}>
            Carregando suas comunas…
          </AppText>
        ) : null}
        {comunas.status === 'error' ? (
          <Pressable onPress={comunas.reload} accessibilityRole="button" style={styles.sheetNote}>
            <AppText variant="caption">
              Não foi possível carregar suas comunas. <AppText style={styles.findMoreLabel} color={Colors.red}>Tentar de novo</AppText>
            </AppText>
          </Pressable>
        ) : null}
        {comunas.status === 'success' && joined.length === 0 ? (
          <AppText variant="caption" style={styles.sheetNote}>
            Você ainda não participa de nenhuma comuna. Entre em uma pelo Explorar para publicar nela.
          </AppText>
        ) : null}
        <Pressable
          onPress={() => {
            setPicking(false);
            if (router.canGoBack()) router.back();
            router.navigate('/explorar');
          }}
          accessibilityRole="button"
          accessibilityHint="Fecha a publicação e abre o Explorar"
          style={styles.findMore}>
          <AppText style={styles.findMoreLabel} color={Colors.red}>
            Procurar outras comunas
          </AppText>
        </Pressable>
      </BottomSheet>
    </Screen>
  );
}

function DestinationMark({ destination, me }: { destination: Destination; me: FeedItem['author'] }) {
  if (destination.kind === 'perfil') return <Avatar initials={me.initials} tone={me.tone} size={44} userId={me.id} imageUrl={me.avatarUrl} />;
  const { comuna } = destination;
  return <ComunaMark initials={comuna.initials} tone={comuna.tone} size={44} />;
}

function TypeButton({ icon, label, active = false, onPress }: { icon: IconName; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.typeButton, active && styles.typeButtonActive, pressed && styles.pressed]}>
      <Icon name={icon} size={22} color={active ? Colors.paper : Colors.ink} />
      <AppText style={styles.typeButtonLabel} color={active ? Colors.paper : Colors.ink} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

function MediaButton({ icon, label, caption, onPress }: { icon: IconName; label: string; caption: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${caption}`}
      style={({ pressed }) => [styles.mediaButton, pressed && styles.pressed]}>
      <Icon name={icon} size={25} />
      <AppText style={styles.mediaButtonLabel} numberOfLines={1}>{label}</AppText>
      <AppText style={styles.mediaButtonCaption} color={Colors.muted} numberOfLines={1}>{caption}</AppText>
    </Pressable>
  );
}

type OptionProps = {
  selected: boolean;
  mark: ReactNode;
  name: string;
  subtitle: string;
  onPress: () => void;
};

function DestinationOption({ selected, mark, name, subtitle, onPress }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${subtitle}`}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      {mark}
      <View style={styles.optionText}>
        <AppText style={styles.optionName} numberOfLines={1}>
          {name}
        </AppText>
        <AppText style={styles.destSub} color={Colors.muted}>
          {subtitle}
        </AppText>
      </View>
      {selected ? <Icon name="check" size={20} color={Colors.red} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  barDivider: {
    width: 1.5,
    height: 28,
    marginLeft: Spacing.one,
    marginRight: Spacing.three,
    backgroundColor: Colors.ink,
  },
  barTitle: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 16,
  },
  publish: {
    minWidth: 104,
    height: 50,
    paddingHorizontal: Spacing.four,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verify: {
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: Colors.red,
    backgroundColor: Colors.paper,
  },
  verifyText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  verifyLink: {
    fontFamily: Fonts.extrabold,
  },
  publishIdle: {
    backgroundColor: Colors.straw,
  },
  publishLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 17,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.six,
  },
  fieldLabel: {
    marginBottom: Spacing.two,
  },
  sectionLabel: {
    marginBottom: Spacing.two,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  dest: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  destText: {
    flex: 1,
    minWidth: 0,
  },
  destName: {
    fontFamily: Fonts.extrabold,
    fontSize: 17,
    lineHeight: 22,
  },
  destSub: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 1,
  },
  typeGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.paper,
  },
  typeButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    marginRight: -1.5,
    paddingHorizontal: Spacing.one,
  },
  typeButtonActive: {
    backgroundColor: Colors.ink,
  },
  typeButtonLabel: {
    flexShrink: 1,
    fontFamily: Fonts.condensed,
    fontSize: 14,
    lineHeight: 17,
  },
  contentBox: {
    minHeight: 270,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    justifyContent: 'space-between',
  },
  writeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  input: {
    flex: 1,
    minHeight: 220,
    paddingTop: Spacing.one,
    paddingBottom: 0,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.ink,
    outlineWidth: 0,
  },
  counter: {
    textAlign: 'right',
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  previewToggle: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  previewBox: {
    borderWidth: 1.5,
    borderColor: Colors.ink,
    overflow: 'hidden',
    backgroundColor: Colors.paper,
  },
  mediaGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.paper,
  },
  mediaButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 98,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    marginRight: -1.5,
    paddingHorizontal: Spacing.half,
  },
  mediaButtonLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 16,
    lineHeight: 19,
  },
  mediaButtonCaption: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    lineHeight: 13,
  },
  pdfSection: {
    gap: Spacing.three,
  },
  pollOption: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  pollRemove: {
    marginBottom: 2,
  },
  option: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    fontFamily: Fonts.bold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  sheetNote: {
    paddingVertical: Spacing.three,
  },
  findMore: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  findMoreLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
});
