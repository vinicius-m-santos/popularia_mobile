import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { BottomSheet, PopulariaBottomSheetTextInput } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { Icon, type IconName } from '@/components/icon';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Motion, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { getComunas, getMyComunas } from '@/features/comunas/api';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { useInteractions } from '@/features/interactions/interactions-context';
import { getDocument } from '@/features/library/api';
import { subscribeAttachment } from '@/features/library/composer-attachment';
import { DocumentCard } from '@/features/library/document-card';
import { LibraryPane } from '@/features/library/library-screen';
import type { LibraryDocument } from '@/features/library/types';
import { MentionSuggestions } from '@/features/mentions/mention-suggestions';
import { createPost } from '@/features/posts/api';
import { POLL_MAX_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX, draftToPoll, pollDraftError, type PollDraft } from '@/features/posts/poll';
import { PostCard } from '@/features/posts/components/post-card';
import { PostAttachment } from '@/features/posts/components/post-attachment';
import { durationLabel, pickPostImage, pickPostVideo, uploadPostMedia, type LocalPostMedia } from '@/features/posts/post-media';
import { createEvent, createProfileEvent, listEvents } from '@/features/events/api';
import { deviceTimeZone, formatPoster, parseWall, zonedWallToIso } from '@/features/events/format';
import { wallStringsToPickerDate } from '@/features/events/date-picker-field';
import { comunaEventsKey, type ComunaEvent } from '@/features/events/types';
import { CallSchedulePicker } from './call-schedule-picker';
import { callBlockedComunaNames } from './call-permissions';
import { searchPlaces, type PlaceSuggestion } from './place-search';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAsyncData } from '@/hooks/use-async-data';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { ApiError, describeError } from '@/lib/errors';
import { formatPeople } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { queryClient } from '@/lib/query/client';
import { topicGroups } from '@/mocks/topics';
import { withPerformanceProfiler } from '@/lib/performance/profiler';
import { setLastPublication } from './last-publication';
import { createWriteDraftStore, type WriteDraftStore } from './write-draft';
import type { Comuna, FeedItem, TopicId } from '@/types/models';

const nowMs = () => Date.now();
const MAX_LENGTH = 1000;
const MAX_TITLE = 120;
const MAX_COMUNAS = 3;
/** Seguidores do perfil de demonstração, para "Visível para…". */
const MY_FOLLOWERS = 312;

/** Destino da publicação: o próprio perfil ou uma comuna de que a pessoa participa. */
type Destination = { kind: 'perfil' } | { kind: 'comuna'; comuna: Comuna };

/** Texto para as recusas conhecidas de POST /posts. */
function publishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.type === '/errors/not-a-member') return 'Entre na comuna para publicar nela.';
    if (error.type === '/errors/event-link') return error.title;
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
  const [mode, setMode] = useState<'write' | 'call' | 'poll'>('write');
  const [call, setCall] = useState({ title: '', details: '', date: '', time: '', place: '' });
  const [callPicker, setCallPicker] = useState(false);
  const [capacityMode, setCapacityMode] = useState<'none' | 'spots' | 'minimum'>('spots');
  const [capacity, setCapacity] = useState(8);
  const [bring, setBring] = useState<string[]>([]);
  const [customBring, setCustomBring] = useState('');
  const [addingBring, setAddingBring] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeFocused, setPlaceFocused] = useState(false);
  const placePicked = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const editorSectionY = useRef(0);
  useEffect(() => {
    if (mode !== 'call' || call.place.trim().length < 3 || placePicked.current) { placePicked.current = false; return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchPlaces(call.place, controller.signal).then((places) => { if (!controller.signal.aborted) { setPlaceSuggestions(places); setPlaceSearching(false); } });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [call.place, mode]);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationTab, setDestinationTab] = useState<'mine' | 'near'>('mine');
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
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const { membershipOf, addPost, notifyPostCreated } = useInteractions();
  // Na API, só as comunas de que a pessoa participa, segundo o servidor.
  const loadComunas = useCallback(() => (DEMO_MODE ? getComunas() : getMyComunas()), []);
  const comunas = useAsyncData(loadComunas);

  // O texto e o título vivem numa store externa: teclar atualiza o editor, não a
  // tela inteira. A tela assina só a presença de conteúdo, que muda o rascunho e
  // o estado habilitado do botão publicar.
  const [writeDraft] = useState(() => createWriteDraftStore());
  const hasWriteContent = useSyncExternalStore(writeDraft.subscribeContent, writeDraft.getHasContent, writeDraft.getHasContent);
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const optionSeq = useRef(2);
  const [topics, setTopics] = useState<TopicId[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ComunaEvent | null>(null);
  const [pickingEvent, setPickingEvent] = useState(false);
  const [topicSheet, setTopicSheet] = useState(false);
  const [preview, setPreview] = useState(false);
  const [picking, setPicking] = useState(false);
  // Só busca a lista completa quando a pessoa pede "Perto de mim".
  const allComunas = useAsyncData(useCallback(() => (picking && destinationTab === 'near' ? getComunas() : Promise.resolve([] as Comuna[])), [picking, destinationTab]));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [publishPhase, setPublishPhase] = useState<'idle' | 'publishing' | 'published'>('idle');
  const publishing = publishPhase === 'publishing';
  const published = publishPhase === 'published';
  const publishingRef = useRef(false);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { style: publishFeedbackStyle, pulse: pulsePublish } = useActionFeedback();
  const [leaving, setLeaving] = useState(false);
  useEffect(() => () => {
    if (publishTimer.current) clearTimeout(publishTimer.current);
  }, []);
  const needsVerification = !DEMO_MODE && account !== null && !account.emailVerified;

  const joined = useMemo(
    () => (comunas.data ?? []).filter((c) => c.status !== 'archived' && (membershipOf(c.id) ?? c.viewerIsMember ?? false)),
    [comunas.data, membershipOf],
  );

  // O perfil pode ser combinado com até 3 comunas. Sem escolha explícita, a primeira comuna.
  const selectedDestinationIds = selectedIds.length ? selectedIds : [joined[0]?.id ?? 'perfil'];
  const selectedDestinations = useMemo(() => {
    const ids = selectedIds.length ? selectedIds : [joined[0]?.id ?? 'perfil'];
    const destinations = ids.map((id): Destination => {
      if (id === 'perfil') return { kind: 'perfil' };
      const comuna = joined.find((c) => c.id === id);
      return comuna ? { kind: 'comuna', comuna } : { kind: 'perfil' };
    }).filter((value, index, list) => value.kind === 'perfil' ? list.findIndex((item) => item.kind === 'perfil') === index : true);
    return destinations.sort((a, b) => a.kind === 'perfil' ? -1 : b.kind === 'perfil' ? 1 : 0);
  }, [selectedIds, joined]);
  const destination: Destination = selectedDestinations[0] ?? { kind: 'perfil' };
  const publishTargets = selectedDestinations.length ? selectedDestinations : [destination];
  const toggleDestination = (id: string) => setSelectedIds((current) => {
    const base = current.length ? current : [joined[0]?.id ?? 'perfil'];
    if (id === 'perfil') {
      const next = base.includes('perfil') ? base.filter((value) => value !== 'perfil') : [...base, 'perfil'];
      return next.length ? next : ['perfil'];
    }
    const comunas = base.filter((value) => value !== 'perfil');
    if (comunas.includes(id)) {
      const next = base.filter((value) => value !== id);
      return next.length ? next : ['perfil'];
    }
    if (comunas.length >= MAX_COMUNAS) { toast.show('Escolha até 3 comunas, além do perfil.'); return base; }
    return [...base, id];
  });

  const comunaSlugForEvents = !DEMO_MODE && pickingEvent && destination.kind === 'comuna' ? destination.comuna.id : null;
  const eventsQuery = useQuery({
    queryKey: comunaEventsKey(comunaSlugForEvents ?? '', 'upcoming'),
    queryFn: ({ signal }) => listEvents(comunaSlugForEvents!, 'upcoming', null, 20, signal),
    enabled: comunaSlugForEvents !== null,
  }, queryClient);

  // Derive effective event: only valid when destination matches the event's commune.
  const effectiveEvent = selectedEvent && selectedEvent.comuna && destination.kind === 'comuna' && selectedEvent.comuna.slug === destination.comuna.id
    ? selectedEvent
    : null;

  // Leitura pontual para prévia e publicação; não é uma assinatura. A tela não
  // re-renderiza por tecla, então o snapshot só é lido quando ela já vai renderizar.
  const writeSnapshot = writeDraft.getSnapshot();
  const destinationsReady = selectedIds.length ? (selectedIds.includes('perfil') || comunas.data !== null) : comunas.data !== null;
  const callWall = parseWall(call.date, call.time);
  const callMissing = [
    call.title.trim().length === 0 ? 'título' : null,
    !callWall ? 'data e hora' : null,
    call.place.trim().length === 0 ? 'local' : null,
  ].filter((value): value is string => value !== null);
  const callReady = callMissing.length === 0;
  const modeReady = mode === 'write'
    ? (!!document || !!media || hasWriteContent)
    : mode === 'poll'
      ? poll !== null
      : callReady;
  const callBlockedNames = mode === 'call' ? callBlockedComunaNames(publishTargets) : [];
  const callBlocked = callBlockedNames.length > 0;
  const canPublish = modeReady && !publishing && !published && destinationsReady && !callBlocked;
  const comunaTargetCount = publishTargets.filter((target) => target.kind === 'comuna').length;
  const includesProfile = publishTargets.some((target) => target.kind === 'perfil');
  const where = comunaTargetCount === 0
    ? 'seu perfil'
    : includesProfile
      ? `seu perfil + ${comunaTargetCount} ${comunaTargetCount === 1 ? 'comuna' : 'comunas'}`
      : comunaTargetCount === 1 ? `c/ ${publishTargets[0]?.kind === 'comuna' ? publishTargets[0].comuna.name : 'comuna'}` : `${comunaTargetCount} comunas`;
  const draftTime = useMemo(() => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), []);
  const dirty = publishing || published || hasWriteContent || !!document || !!media || poll !== null || call.title.length > 0 || call.details.length > 0 || call.date.length > 0 || call.time.length > 0 || call.place.length > 0 || bring.length > 0;
  const disablePrevention = usePreventRemove(!leaving && dirty, ({ repeat }) => {
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

  /**
   * Confirmação única de publicação: o estado "Publicado" permanece legível por
   * um movimento curto antes de voltar ao feed. O anúncio só é feito aqui quando
   * não há toast, para o leitor de tela não receber o mesmo aviso duas vezes.
   */
  const completePublish = (toastMessage?: string) => {
    setPublishPhase('published');
    pulsePublish();
    if (toastMessage) toast.show(toastMessage);
    else AccessibilityInfo.announceForAccessibility('Publicação publicada.');
    setLeaving(true);
    disablePrevention();
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(() => {
      publishTimer.current = null;
      router.replace('/');
    }, Motion.duration.confirmation);
  };

  const publish = async () => {
    if (publishingRef.current) return;
    // Lê a store no clique: o texto pode ter mudado desde o último render da tela.
    const composed = writeDraft.getSnapshot().composed;
    const trimmed = composed.body;
    const trimmedTitle = writeDraft.getSnapshot().title.trim();
    if (!destinationsReady) {
      toast.show('Aguarde carregar os destinos ou selecione seu perfil em Publicar em.');
      return;
    }
    if (mode === 'poll') {
      const pollIssue = pollDraftError(poll);
      if (pollIssue) { toast.show(pollIssue); return; }
    }
    if (mode === 'call') {
      if (!call.title.trim()) { toast.show('Dê um nome ao chamado.'); return; }
      if (!callWall) { toast.show('Use a data como 05/11/2026 e a hora como 19:00.'); return; }
      if (!call.place.trim()) { toast.show('Informe onde o chamado vai acontecer.'); return; }
      const start = zonedWallToIso(callWall, deviceTimeZone() ?? 'America/Sao_Paulo');
      if (Date.parse(start) <= nowMs()) { toast.show('O chamado precisa acontecer no futuro.'); return; }
    }
    if (mode === 'write') {
      if (pdfMode && !document) { toast.show('Escolha um PDF da biblioteca ou envie um novo.'); return; }
      if (!trimmed && !trimmedTitle && !document && !media) {
        toast.show('Escreva algo antes de publicar.');
        return;
      }
    }
    if (publishTargets.length > 1 && media) {
      toast.show('Para publicar em mais de um local, remova a foto ou o vídeo. Cada arquivo só pode ser anexado a uma publicação.');
      return;
    }

    if (DEMO_MODE) {
      publishingRef.current = true;
      for (const target of publishTargets) {
        const comunaId = target.kind === 'comuna' ? target.comuna.id : null;
        if (mode === 'call') addPost({ comunaId, text: target.kind === 'perfil' ? callProfileText() : call.details, title: call.title });
        else addPost({ comunaId, text: trimmed, ...(trimmedTitle ? { title: trimmedTitle } : {}), ...(composed.mentions.length > 0 ? { mentions: composed.mentions } : {}), ...(poll ? { poll: { ...draftToPoll(poll), id: `local-poll-${nowMs()}` } } : {}) });
      }
      haptic('success');
      setLastPublication(null);
      completePublish(publishTargets.length > 1 ? `Publicado em ${publishTargets.length} locais só neste aparelho. Nada foi enviado.` : `Publicado em ${where} só neste aparelho. Nada foi enviado.`);
      return;
    }

    if (needsVerification) return askToVerify();
    publishingRef.current = true;
    setPublishPhase('publishing');
    try {
      const posts: FeedItem[] = [];
      let mediaId = media?.uploaded?.id;
      if (media && !mediaId) {
        const controller = new AbortController();
        uploadController.current = controller;
        setUploadProgress(0);
        const uploaded = await uploadPostMedia(media, setUploadProgress, controller.signal);
        setMedia({ ...media, uploaded });
        mediaId = uploaded.id;
      }
      if (mode === 'call') {
        const timeZone = deviceTimeZone() ?? 'America/Sao_Paulo';
        const wall = parseWall(call.date, call.time);
        if (!wall) throw new Error('Data inválida.');
        const callCapacity = capacityMode === 'spots'
          ? { capacityMode: 'spots' as const, capacity }
          : capacityMode === 'minimum'
            ? { capacityMode: 'goal' as const, capacity }
            : { capacityMode: null, capacity: null };
        for (const target of publishTargets) {
          if (target.kind === 'comuna') {
            if (target.comuna.serverId === undefined) throw new Error('Comuna sem identificador.');
            const event = await createEvent(target.comuna.id, {
              title: call.title.trim(),
              description: callDetails(),
              format: 'in_person',
              placeName: call.place.trim(),
              address: null,
              onlineUrl: null,
              timeZone,
              startsAt: zonedWallToIso(wall, timeZone),
              endsAt: null,
              ...callCapacity,
            });
            posts.push(await createPost({ comunaServerId: target.comuna.serverId, text: callDetails(), title: call.title.trim(), eventId: event.id, ...(mediaId ? { mediaId } : {}) }));
          } else {
            const event = await createProfileEvent({
              title: call.title.trim(),
              description: callDetails(),
              format: 'in_person',
              placeName: call.place.trim(),
              address: null,
              onlineUrl: null,
              timeZone,
              startsAt: zonedWallToIso(wall, timeZone),
              endsAt: null,
              ...callCapacity,
            });
            posts.push(await createPost({ comunaServerId: null, text: callDetails(), title: call.title.trim(), eventId: event.id, ...(mediaId ? { mediaId } : {}) }));
          }
        }
      } else {
        for (const target of publishTargets) {
          if (target.kind === 'comuna' && target.comuna.serverId === undefined) throw new Error('Comuna sem identificador.');
          posts.push(await createPost({
            comunaServerId: target.kind === 'comuna' ? target.comuna.serverId ?? null : null,
            text: trimmed,
            ...(trimmedTitle ? { title: trimmedTitle } : {}),
            ...(composed.mentions.length > 0 ? { mentions: composed.mentions } : {}),
            ...(pdfMode && document ? { documentId: document.id } : {}),
            ...(mediaId ? { mediaId } : {}),
            ...(target.kind === 'perfil' && topics.length ? (topics.length === 1 ? { topic: topics[0] } : { topics }) : {}),
            ...(poll ? { poll: { question: poll.question.trim(), options: poll.options.map((option) => ({ label: option.label.trim() })), ...(poll.durationDays ? { durationDays: poll.durationDays } : {}) } } : {}),
            ...(effectiveEvent && target.kind === 'comuna' && effectiveEvent.comuna?.slug === target.comuna.id ? { eventId: effectiveEvent.id } : {}),
          }));
        }
      }
      const post = posts[0];
      if (!post) throw new Error('Nenhum destino selecionado.');
      haptic('success');
      setLastPublication(post);
      notifyPostCreated({
        author: account?.handle ?? null,
        comunaIds: posts.map((item) => item.comunaId),
      });
      completePublish(posts.length > 1 ? `Publicado em ${posts.length} locais.` : undefined);
      return;
    } catch (error) {
      publishingRef.current = false;
      setPublishPhase('idle');
      if (error instanceof ApiError && error.type === '/errors/email-not-verified') {
        // A conta no aparelho estava desatualizada: recarrega para os avisos ficarem certos.
        reloadAccount().catch(() => {});
        return askToVerify();
      }
      toast.show(mode === 'call' ? `Não foi possível convocar. ${describeError(error)}` : publishErrorMessage(error));
      return;
    } finally {
      uploadController.current = null;
    }
  };

  const selectMedia = useCallback(async (kind: 'image' | 'video') => {
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
  }, [pickingMedia, publishing, toast]);

  const focusEditor = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, editorSectionY.current - 8), animated: true });
    }, 60);
  }, []);
  const pickEditorImage = useCallback(() => { void selectMedia('image'); }, [selectMedia]);
  const removeMedia = useCallback(() => setMedia(null), []);

  const previewTitle = writeSnapshot.title.trim();
  const previewBody = writeSnapshot.composed.body;
  const previewItem: FeedItem = {
    id: 'preview',
    document: pdfMode ? document : null,
    attachment: media ? { id: media.uploaded?.id ?? 'preview-media', type: media.kind, mimeType: media.mimeType, byteSize: media.size, width: media.width, height: media.height, durationMs: media.durationMs, url: media.uri } : null,
    authorId: me.id,
    comunaId: destination.kind === 'comuna' ? destination.comuna.id : null,
    createdAt: new Date().toISOString(),
    title: previewTitle || null,
    text: previewBody || (pdfMode || previewTitle ? '' : 'Seu texto aparece aqui.'),
    ...(writeSnapshot.composed.mentions.length > 0 ? { mentions: writeSnapshot.composed.mentions } : {}),
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    viewer: { isAuthor: true, canComment: true, canDelete: true },
    author: me,
    comuna: destination.kind === 'comuna' ? destination.comuna : null,
    event: null,
    linkedEvent: effectiveEvent ? {
      id: effectiveEvent.id,
      title: effectiveEvent.title,
      format: effectiveEvent.format,
      status: effectiveEvent.status,
      startsAt: effectiveEvent.startsAt,
      timeZone: effectiveEvent.timeZone,
      placeName: effectiveEvent.placeName,
      goingCount: effectiveEvent.goingCount,
      maybeCount: effectiveEvent.maybeCount,
      past: effectiveEvent.past,
    } : null,
    topCommentAuthor: null,
    poll: poll ? draftToPoll(poll) : null,
  };

  const topicLabels = new Map(topicGroups.flatMap((group) => group.topics).map((topicItem) => [topicItem.id, topicItem.shortLabel]));
  const visibilityText = destination.kind === 'perfil'
    ? DEMO_MODE ? `Visível para seus ${MY_FOLLOWERS} seguidores` : 'Visível no seu perfil e no feed'
    : mode === 'poll'
      ? destination.comuna.visibility === 'private' ? 'Só membros votam' : 'Pública · qualquer pessoa vota'
      : destination.comuna.visibility === 'private' ? 'Só membros veem' : 'Pública · qualquer pessoa vê';
  const destinationSubtitle = callBlocked ? 'só a moderação pode convocar' : mode === 'call' && capacityMode === 'spots' ? `em ${where} · ${capacity >= 1000 ? '+1000' : capacity} vagas` : `em ${where}`;
  const publishLabel = mode === 'call' ? 'Convocar' : mode === 'poll' ? 'Publicar enquete' : 'Publicar';
  const mineIds = new Set(joined.map((c) => c.id));
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matchesDestination = (c: Comuna) => {
    const term = normalize(destinationQuery.trim());
    if (!term) return true;
    const topicIds = (c.topics ?? []).map((id) => topicLabels.get(id) ?? id).join(' ');
    return normalize(`${c.name} ${c.place} ${topicIds}`).includes(term);
  };
  const myOptions = joined.filter(matchesDestination);
  const nearOptions = (allComunas.data ?? []).filter((c) => c.status !== 'archived' && !mineIds.has(c.id) && matchesDestination(c) && (
    account?.city ? normalize(c.place).includes(normalize(account.city)) : false
  ));
  const destinationRows = destinationTab === 'mine' ? myOptions : nearOptions;
  const quickDate = (daysAhead: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toLocaleDateString('pt-BR');
  };
  const nextFriday = (() => {
    const date = new Date();
    const delta = (5 - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + delta);
    return date.toLocaleDateString('pt-BR');
  })();
  const setQuickDate = (value: string) => setCall((current) => ({ ...current, date: value, time: current.time || '19:00' }));
  const callDetails = () => {
    const extras = [
      bring.length ? `Cada um leva: ${bring.join(', ')}` : null,
    ].filter(Boolean);
    return [call.details.trim(), ...extras].filter(Boolean).join('\n\n');
  };
  const callProfileText = () => [callDetails(), `Quando: ${call.date.trim()} às ${call.time.trim()}`, `Onde: ${call.place.trim()}`].filter(Boolean).join('\n\n');
  const toggleBring = (item: string) => setBring((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const addCustomBring = () => { const value = customBring.trim(); if (!value) return; setBring((current) => current.includes(value) ? current : [...current, value]); setCustomBring(''); setAddingBring(false); };
  const callDate = wallStringsToPickerDate(call.date, call.time) ?? wallStringsToPickerDate(nextFriday, '19:00') ?? wallStringsToPickerDate(quickDate(0), '19:00')!;
  const callWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(callDate).replace('.', '').toUpperCase();
  const callMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(callDate).replace('.', '').toUpperCase();
  const callDay = String(callDate.getDate()).padStart(2, '0');
  const callHour = `${String(callDate.getHours()).padStart(2, '0')}${callDate.getMinutes() ? `:${String(callDate.getMinutes()).padStart(2, '0')}` : 'H'}`;

  const chooseWrite = useCallback(() => {
    setMode('write');
    setPreview(false);
  }, []);
  const chooseCall = () => {
    setMode('call');
    setPreview(false);
    setDocument(null);
    setPdfMode(false);
    setSelectedEvent(null);
    if (media?.kind === 'video') {
      setMedia(null);
      toast.show('O chamado aceita só imagem de capa.');
    }
    setCall((current) => current.date ? current : { ...current, date: nextFriday, time: current.time || '19:00' });
  };
  const choosePoll = useCallback(() => {
    setMode('poll');
    setPreview(false);
    setMedia(null);
    setDocument(null);
    setPdfMode(false);
    setSelectedEvent(null);
    setPoll((current) => current ?? { question: '', options: [{ key: 'option-1', label: '' }, { key: 'option-2', label: '' }], durationDays: 7 });
  }, []);
  const openDestinations = useCallback(() => setPicking(true), []);

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardView style={styles.flex}>
        <EditorialHeader
          title="Nova publicação"
          subtitle={`Rascunho local · ${draftTime}`}
          onBack={close}
          backLabel="Fechar"
          right={<Pressable
            accessibilityRole="button"
            accessibilityLabel="Prévia da publicação"
            accessibilityState={{ selected: preview }}
            onPress={() => {
              if (mode === 'call') { toast.show('A prévia do chamado aparece depois de publicado.'); return; }
              setPreview((value) => !value);
            }}
            style={({ pressed }) => [styles.previewButton, preview && styles.previewButtonActive, pressed && styles.pressed]}>
            <Icon name="eye" size={20} color={preview ? Colors.paper : Colors.ink} />
            <AppText style={styles.previewButtonLabel} color={preview ? Colors.paper : Colors.ink}>Prévia</AppText>
          </Pressable>}
        />

        <ScrollView ref={scrollRef} style={styles.flex} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
          {needsVerification ? (
            <Pressable onPress={() => router.push('/verificar-email')} accessibilityRole="button" accessibilityHint="Abre a confirmação de e-mail" style={({ pressed }) => [styles.verify, pressed && styles.pressed]}>
              <AppText style={styles.verifyText} color={Colors.ink}>
                Confirme seu e-mail para publicar. Você pode escrever agora e publicar depois de confirmar.{' '}
                <AppText style={[styles.verifyText, styles.verifyLink]} color={Colors.red}>Confirmar e-mail</AppText>
              </AppText>
            </Pressable>
          ) : null}

          <DestinationStep
            me={me}
            destination={destination}
            targetCount={publishTargets.length}
            where={where}
            visibilityText={visibilityText}
            callBlocked={callBlocked}
            onOpen={openDestinations}
          />

          <PostTypeStep mode={mode} narrow={narrow} onWrite={chooseWrite} onCall={chooseCall} onPoll={choosePoll} />

          <View style={styles.step} onLayout={(event) => { editorSectionY.current = event.nativeEvent.layout.y; }}>
            <StepHeading number="03" label={mode === 'call' ? 'O chamado' : mode === 'poll' ? 'A enquete' : 'Seu post'} />

            {preview ? (
              <PreviewPanel item={previewItem} />
            ) : mode === 'write' ? (
              <WriteEditor
                store={writeDraft}
                publishing={publishing}
                media={media}
                onFocusField={focusEditor}
                onPickImage={pickEditorImage}
                onRemoveMedia={removeMedia}
              />
            ) : mode === 'poll' && poll ? (
              <View style={styles.pollShadow}>
              <View style={styles.pollCard}>
                <View style={styles.pollHeader}>
                  <AppText variant="label" color={Colors.paper}>Enquete</AppText>
                  <AppText style={styles.pollCount} color={Colors.onInkMuted}>{poll.options.length}/{POLL_MAX_OPTIONS} opções</AppText>
                </View>
                <View style={styles.pollBody}>
                  <TextInput
                    value={poll.question}
                    onChangeText={(question) => setPoll((current) => current ? { ...current, question } : current)}
                    maxLength={POLL_QUESTION_MAX}
                    placeholder="Qual a pergunta?"
                    placeholderTextColor={Colors.placeholder}
                    accessibilityLabel="Pergunta da enquete"
                    style={styles.pollQuestion}
                    multiline
                    editable={!publishing}
                  />
                  <View style={styles.dashedRule} />
                  <AppText variant="label" color={Colors.muted}>Opções</AppText>
                  {poll.options.map((option, index) => (
                    <View key={option.key} style={styles.pollOptionRow}>
                      <View style={styles.pollLetter}><AppText style={styles.pollLetterText} color={Colors.paper}>{String.fromCharCode(65 + index)}</AppText></View>
                      <TextInput
                        value={option.label}
                        onChangeText={(label) => setPoll((current) => current ? { ...current, options: current.options.map((item) => item.key === option.key ? { ...item, label } : item) } : current)}
                        maxLength={POLL_OPTION_MAX}
                        placeholder={`Opção ${String.fromCharCode(65 + index)}`}
                        placeholderTextColor={Colors.placeholder}
                        accessibilityLabel={`Opção ${String.fromCharCode(65 + index)}`}
                        style={styles.pollOptionInput}
                        editable={!publishing}
                      />
                      {poll.options.length > 2 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover opção ${String.fromCharCode(65 + index)}`} onPress={() => setPoll((current) => current ? { ...current, options: current.options.filter((item) => item.key !== option.key) } : current)} style={styles.pollRemove}><Icon name="close" size={18} /></Pressable> : null}
                    </View>
                  ))}
                  {poll.options.length < POLL_MAX_OPTIONS ? <Pressable accessibilityRole="button" accessibilityLabel="Adicionar opção" onPress={() => { optionSeq.current += 1; const key = `option-${optionSeq.current}`; setPoll((current) => current && current.options.length < POLL_MAX_OPTIONS ? { ...current, options: [...current.options, { key, label: '' }] } : current); }} style={({ pressed }) => [styles.addOption, pressed && styles.pressed]}>
                    <AppText style={styles.addOptionLabel}>+ Adicionar opção</AppText>
                  </Pressable> : null}
                </View>
              </View>
              </View>
            ) : (
              <View style={styles.callShadow}>
              <View style={styles.callCard}>
                <View style={styles.callHeader}>
                  <AppText variant="label" color={Colors.paper}>Chamado</AppText>
                  <AppText style={styles.pollCount} color={Colors.cream}>Rascunho</AppText>
                </View>
                {media?.kind === 'image' ? <View style={styles.callCover}><Image source={{ uri: media.uri }} contentFit="cover" style={styles.callCoverImage} /><Pressable accessibilityRole="button" accessibilityLabel="Remover imagem de capa" onPress={() => setMedia(null)} style={styles.callCoverRemove}><Icon name="trash" size={16} color={Colors.paper} /></Pressable></View> : null}
                <View style={styles.callBody}>
                  {callMissing.length > 0 ? <AppText variant="caption" color={Colors.red} style={styles.callMissing} accessibilityLiveRegion="polite">Falta informar: {callMissing.join(', ')}.</AppText> : null}
                  <AppText variant="label" color={Colors.muted}>O que vai rolar?</AppText>
                  <TextInput value={call.title} onChangeText={(title) => setCall((current) => ({ ...current, title: title.toLocaleUpperCase('pt-BR') }))} maxLength={120} placeholder="Noite de jogos de tabuleiro" placeholderTextColor={Colors.placeholder} accessibilityLabel="Título do chamado" style={styles.callTitle} editable={!publishing} autoCapitalize="characters" />
                  <View style={styles.dashedRule} />
                  <TextInput value={call.details} onChangeText={(details) => setCall((current) => ({ ...current, details }))} maxLength={500} multiline placeholder="Detalhes (opcional): o que rola, pra quem é…" placeholderTextColor={Colors.placeholder} accessibilityLabel="Detalhes do chamado" style={styles.callDetails} editable={!publishing} />
                  <View style={styles.dashedRule} />
                  <AppText variant="label" color={Colors.muted}>Quando</AppText>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Alterar data e hora do chamado. ${callWeekday} ${callDay} ${callMonth}, ${callHour}`} onPress={() => setCallPicker(true)} style={({ pressed }) => [styles.whenGrid, pressed && styles.pressed]}>
                    <View style={styles.whenCell}><AppText style={styles.whenLabel}>Dia</AppText><AppText style={styles.whenValue}>{callWeekday}</AppText></View>
                    <View style={[styles.whenCell, styles.whenCellActive]}><AppText style={[styles.whenLabel, { color: Colors.cream }]}>Nº</AppText><AppText style={[styles.whenValue, { color: Colors.cream }]}>{callDay}</AppText></View>
                    <View style={styles.whenCell}><AppText style={styles.whenLabel}>Mês</AppText><AppText style={styles.whenValue}>{callMonth}</AppText></View>
                    <View style={[styles.whenCell, styles.whenCellLast]}><AppText style={styles.whenLabel}>Hora</AppText><AppText style={styles.whenValue}>{callHour}</AppText></View>
                  </Pressable>
                  <View style={styles.quickDates}>
                    <QuickChip label="Hoje" active={call.date === quickDate(0)} onPress={() => setQuickDate(quickDate(0))} />
                    <QuickChip label="Amanhã" active={call.date === quickDate(1)} onPress={() => setQuickDate(quickDate(1))} />
                    <QuickChip label={`Sex ${nextFriday.slice(0, 2)}`} active={call.date === nextFriday} onPress={() => setQuickDate(nextFriday)} />
                    <QuickChip label="Outra" onPress={() => setCallPicker(true)} />
                  </View>
                  <AppText variant="label" color={Colors.muted} style={styles.callLabel}>Onde</AppText>
                  <View style={styles.callPlace}>
                    <Icon name="pin" size={20} />
                    <TextInput value={call.place} onChangeText={(place) => { setCall((current) => ({ ...current, place })); setPlaceSuggestions([]); setPlaceSearching(place.trim().length >= 3); }} onFocus={() => setPlaceFocused(true)} onBlur={() => setTimeout(() => setPlaceFocused(false), 120)} maxLength={120} placeholder="Casa da Lu — Santa Tereza" placeholderTextColor={Colors.placeholder} accessibilityLabel="Local do chamado" style={styles.callPlaceInput} editable={!publishing} />
                  </View>
                  {placeSearching ? <AppText variant="caption" style={styles.placeHint}>Buscando lugares…</AppText> : null}
                  {placeFocused && placeSuggestions.length > 0 ? <View style={styles.placeSuggestions}>
                    {placeSuggestions.map((suggestion) => <Pressable key={suggestion.id} accessibilityRole="button" accessibilityLabel={suggestion.label} onPress={() => { placePicked.current = true; setPlaceFocused(false); setCall((current) => ({ ...current, place: suggestion.label })); setPlaceSuggestions([]); }} style={({ pressed }) => [styles.placeSuggestion, pressed && styles.pressed]}>
                      <Icon name="pin" size={15} color={Colors.muted} />
                      <AppText variant="caption" numberOfLines={2} style={styles.flex}>{suggestion.label}</AppText>
                    </Pressable>)}
                  </View> : null}
                  <AppText variant="label" color={Colors.muted} style={styles.callLabel}>Quantas pessoas</AppText>
                  <View style={styles.capacityTabs}>
                    {([['none', 'Sem limite'], ['spots', 'Vagas'], ['minimum', 'Meta mínima']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: capacityMode === value }} onPress={() => setCapacityMode(value)} style={[styles.capacityTab, value === 'minimum' && styles.capacityTabLast, capacityMode === value && styles.capacityTabActive]}>
                      <AppText style={styles.capacityTabLabel} color={capacityMode === value ? Colors.paper : Colors.ink}>{label}</AppText>
                    </Pressable>)}
                  </View>
                  {capacityMode !== 'none' ? <>
                    <View style={styles.counterRow}>
                      <View style={styles.counterCopy}><AppText style={styles.counterNumber}>{capacity >= 1000 ? '+1000' : capacity}</AppText><AppText style={styles.counterPeople}>pessoas</AppText></View>
                      <View style={styles.counterActions}>
                        <CounterButton icon="minus" label="Diminuir pessoas" onStep={(amount = 1) => setCapacity((value) => Math.max(1, value - amount))} />
                        <CounterButton icon="plus" label="Aumentar pessoas" dark onStep={(amount = 1) => setCapacity((value) => Math.min(1000, value + amount))} />
                      </View>
                    </View>
                    <View style={styles.capacityMarks}>{Array.from({ length: 7 }, (_, index) => <View key={index} style={[styles.capacityMark, index < Math.min(7, Math.ceil(capacity / 4)) && styles.capacityMarkFilled]} />)}</View>
                  </> : null}
                  <View style={styles.bringHeader}><AppText variant="label" color={Colors.muted}>Cada um leva</AppText><AppText variant="caption">opcional</AppText></View>
                  <View style={styles.bringChips}>
                    {['Um jogo', 'Bebida', 'Petisco'].map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: bring.includes(item) }} onPress={() => toggleBring(item)} style={[styles.bringChip, bring.includes(item) && styles.bringChipActive]}><AppText style={styles.bringChipLabel} color={bring.includes(item) ? Colors.paper : Colors.ink}>{item}</AppText></Pressable>)}
                    {bring.filter((item) => !['Um jogo', 'Bebida', 'Petisco'].includes(item)).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: true }} onPress={() => toggleBring(item)} style={[styles.bringChip, styles.bringChipActive]}><AppText style={styles.bringChipLabel} color={Colors.paper}>{item}</AppText></Pressable>)}
                    {addingBring ? <View style={styles.bringAddRow}><TextInput value={customBring} onChangeText={setCustomBring} onSubmitEditing={addCustomBring} autoFocus placeholder="Ex.: cadeira" placeholderTextColor={Colors.placeholder} accessibilityLabel="Outro item para levar" style={styles.bringInput} /><Pressable accessibilityRole="button" accessibilityLabel="Adicionar item" onPress={addCustomBring} style={styles.bringConfirm}><Icon name="check" size={18} color={Colors.paper} /></Pressable></View> : <Pressable accessibilityRole="button" accessibilityLabel="Adicionar outro item" onPress={() => setAddingBring(true)} style={styles.bringAdd}><AppText style={styles.bringAddLabel}>+ Outro</AppText></Pressable>}
                  </View>
                  <AppText variant="caption" style={styles.callFootnote}>{destination.kind === 'perfil' ? 'O chamado será publicado no seu perfil.' : 'O chamado cria uma atividade na comuna e uma publicação no mural.'}</AppText>
                </View>
              </View>
              </View>
            )}
          </View>

          {mode === 'poll' && poll ? <View style={styles.step}>
            <StepHeading number="04" label="Regras" />
            <View style={styles.rulesCard}>
              <AppText style={styles.rulesTitle}>Encerra em</AppText>
              <View style={styles.durationRow}>
                {[1, 3, 7].map((days) => {
                  const selected = (poll.durationDays ?? null) === days;
                  return <Pressable key={days} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={days === 7 ? '1 semana' : `${days} dias`} onPress={() => setPoll((current) => current ? { ...current, durationDays: days } : current)} style={({ pressed }) => [styles.durationChip, selected && styles.durationChipActive, pressed && styles.pressed]}>
                    <AppText style={styles.durationLabel} color={selected ? Colors.paper : Colors.ink}>{days === 7 ? '1 semana' : days === 1 ? '1 dia' : `${days} dias`}</AppText>
                  </Pressable>;
                })}
              </View>
              <View style={styles.ruleDivider} />
              <AppText variant="caption">Votos anônimos, resultado depois do voto e modo assembleia ainda não fazem parte desta enquete.</AppText>
            </View>
          </View> : mode === 'write' ? <View style={styles.step}>
            <StepHeading number="04" label={destination.kind === 'perfil' ? 'Sobre o quê?' : 'Assunto'} aside={destination.kind === 'perfil' ? 'até 3' : undefined} />
            {destination.kind === 'perfil' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Assuntos: ${topics.length ? topics.map((id) => topicLabels.get(id) ?? id).join(', ') : 'Escolher assuntos'}`}
                onPress={() => setTopicSheet(true)}
                style={({ pressed }) => [styles.topicPicker, pressed && styles.pressed]}>
                <View style={styles.topicTriggerCopy}>
                  {topics.length === 0 ? <AppText style={styles.topicPickerLabel}>Escolher assuntos</AppText> : topics.map((id) => <View key={id} style={styles.topicSelected}><AppText style={styles.topicSelectedLabel}>{topicLabels.get(id) ?? id}</AppText></View>)}
                </View>
                <Icon name="chevronDown" size={18} />
              </Pressable>
            ) : (
              <AppText variant="caption">O assunto é herdado da comuna: {destination.kind === 'comuna' ? (destination.comuna.topics ?? []).map((id) => topicLabels.get(id) ?? id).slice(0, 2).join(' · ') || 'sem assunto' : 'sem assunto'}.</AppText>
            )}
          </View> : null}

          {media?.kind === 'video' ? <View style={styles.attachmentSection}>
            <View style={styles.attachmentHeading}><AppText variant="label">Vídeo anexado</AppText><AppText variant="caption">{durationLabel(media.durationMs)}</AppText></View>
            <PostAttachment media={{ id: media.uploaded?.id ?? 'local', type: media.kind, mimeType: media.mimeType, byteSize: media.size, width: media.width, height: media.height, durationMs: media.durationMs, url: media.uri }} localUri={media.uri} />
            {publishing && !media.uploaded ? <View><AppText variant="caption">Enviando mídia · {uploadProgress}%</AppText><EditorialAction label="Interromper envio" icon="close" onPress={() => uploadController.current?.abort()} /></View> : null}
            <EditorialAction label="Trocar vídeo" icon="edit" onPress={() => selectMedia('video')} />
            <EditorialAction label="Remover vídeo da publicação" icon="trash" onPress={() => setMedia(null)} />
          </View> : null}

          {effectiveEvent ? <View style={styles.attachmentSection}>
            <View style={styles.attachmentHeading}><AppText variant="label">Evento vinculado</AppText><AppText variant="caption">{(() => { const w = formatPoster(effectiveEvent.startsAt, effectiveEvent.timeZone); return `${w.weekday} ${w.day} ${w.month} · ${w.time}`; })()}</AppText></View>
            <View style={styles.eventPreview}><AppText style={styles.eventTitle}>{effectiveEvent.title}</AppText><AppText variant="caption">{effectiveEvent.placeName ?? 'Sem local'}</AppText></View>
            <EditorialAction label="Trocar evento" icon="edit" onPress={() => setPickingEvent(true)} />
            <EditorialAction label="Remover evento da publicação" icon="trash" onPress={() => setSelectedEvent(null)} />
          </View> : null}

          {pdfMode ? <View style={styles.attachmentSection}>
            <View style={styles.attachmentHeading}><AppText variant="label">PDF anexado</AppText>{document?.viewer.canEdit ? <AppText variant="caption" onPress={() => router.push({ pathname: '/biblioteca/enviar', params: { edit: document.id, composerKey } })} style={styles.inlineLink}>Ajustar acesso</AppText> : null}</View>
            {attachmentError ? <AppText color={Colors.error}>{attachmentError}</AppText> : null}
            {document ? <DocumentCard document={document} appearance="editorial" /> : <AppText variant="caption">Escolha um documento da sua biblioteca ou envie um novo.</AppText>}
            {document && !document.isPublic ? <View style={styles.pdfNotice}>
              <AppText variant="caption">Publicar não concede acesso ao PDF.</AppText>
              <AppText variant="caption">{document.access === 'private' && !document.distributions?.length ? 'Só você pode abrir este PDF.' : 'Este PDF tem acesso restrito.'}</AppText>
            </View> : null}
            <View style={styles.attachmentActions}>
              <EditorialAction label="Escolher da biblioteca" icon="library" onPress={() => setPickingDocument(true)} style={styles.flexAction} />
              <EditorialAction label="Enviar novo PDF" icon="plus" onPress={() => router.push({ pathname: '/biblioteca/enviar', params: { composerKey } })} style={styles.flexAction} />
            </View>
            <EditorialAction label="Remover PDF da publicação" icon="trash" onPress={() => { setDocument(null); setPdfMode(false); }} />
          </View> : null}

          {mode !== 'poll' ? <>
            <View style={styles.attachmentToolbar}>
              <ToolbarButton icon="image" label={mode === 'call' ? 'Capa' : 'Foto'} caption={media?.kind === 'image' ? '1' : undefined} active={media?.kind === 'image'} last={mode === 'call'} onPress={() => selectMedia('image')} />
              {mode !== 'call' ? <>
                <ToolbarButton icon="camera" label="Vídeo" caption={media?.kind === 'video' ? '1' : undefined} active={media?.kind === 'video'} onPress={() => selectMedia('video')} />
                <ToolbarButton icon="document" label="PDF" active={pdfMode} last onPress={() => setPdfMode(true)} />
              </> : null}
            </View>
            <AppText variant="caption" style={styles.toolbarHint}>{mode === 'call' ? 'Capa até 10 MB. O chamado não aceita vídeo.' : 'Foto até 10 MB · vídeo até 100 MB e 30 s · PDF até 25 MB'}</AppText>
          </> : null}
        </ScrollView>

        {mode === 'call' && callBlocked ? (
          <View style={styles.callBlockedBanner} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Icon name="shield" size={18} color={Colors.red} />
            <AppText style={styles.callBlockedText}>Só a moderação de {callBlockedNames.map((name) => `c/ ${name}`).join(', ')} pode convocar. Escolha outra comuna ou publique no seu perfil.</AppText>
          </View>
        ) : null}

        {!keyboardVisible ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={published ? `Publicado ${destinationSubtitle}` : publishing ? 'Publicando' : publishLabel}
            accessibilityState={{ disabled: !canPublish, busy: publishing }}
            disabled={!canPublish}
            onPress={() => { void publish(); }}
            style={({ pressed }) => [styles.publishBar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }, !canPublish && !published && styles.publishBarDisabled, pressed && styles.pressed]}>
            <View style={styles.publishCopy}>
              <AppText style={styles.publishTitle}>{published ? 'Publicado' : publishing ? 'Publicando…' : publishLabel}</AppText>
              <AppText style={styles.publishSubtitle}>{destinationSubtitle}</AppText>
            </View>
            <Animated.View style={[styles.publishButton, publishFeedbackStyle, published && styles.publishButtonConfirmed]}>
              {published ? (
                <Icon name="check" size={26} color={Colors.paper} />
              ) : publishing ? (
                <ActivityIndicator color={Colors.ink} />
              ) : (
                <Icon name={mode === 'call' ? 'megaphone' : 'arrowRight'} size={26} color={Colors.ink} />
              )}
            </Animated.View>
          </Pressable>
        ) : null}
      </KeyboardView>

      <BottomSheet scrollable={false} virtualized visible={pickingDocument} onClose={() => setPickingDocument(false)} title="Sua biblioteca">
        <View style={{ height: 480, flexShrink: 1 }}><LibraryPane scope="personal" owner={me.id} onSelect={(attachment) => { setDocument(attachment); setPdfMode(true); setMedia(null); setPickingDocument(false); }} /></View>
      </BottomSheet>

      <BottomSheet visible={pickingEvent} onClose={() => setPickingEvent(false)} title="Vincular evento">
        {eventsQuery.isPending ? <ActivityIndicator color={Colors.red} style={styles.sheetNote} accessibilityLabel="Carregando eventos" /> : eventsQuery.isError ? <Pressable onPress={() => { void eventsQuery.refetch(); }} accessibilityRole="button" style={styles.sheetNote}><AppText variant="caption">Não foi possível carregar os eventos. <AppText style={styles.inlineLink} color={Colors.red}>Tentar de novo</AppText></AppText></Pressable> : eventsQuery.data && eventsQuery.data.items.length > 0 ? eventsQuery.data.items.filter((e) => e.status === 'scheduled').map((e) => {
          const w = formatPoster(e.startsAt, e.timeZone);
          return <Pressable key={e.id} onPress={() => { setSelectedEvent(e); setPickingEvent(false); }} role="radio" accessibilityState={{ checked: effectiveEvent?.id === e.id }} accessibilityLabel={`${e.title}, ${w.day} ${w.month}, ${w.time}`} style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}>
            <View style={styles.flex}><AppText style={styles.optionName} numberOfLines={1}>{e.title}</AppText><AppText variant="caption">{w.weekday} {w.day} {w.month} · {w.time}</AppText></View>
            {effectiveEvent?.id === e.id ? <Icon name="check" size={20} color={Colors.red} /> : null}
          </Pressable>;
        }) : <AppText variant="caption" style={styles.sheetNote}>Nenhum evento disponível para vincular.</AppText>}
      </BottomSheet>

      <BottomSheet visible={picking} surface="cream" onClose={() => { setPicking(false); setDestinationQuery(''); setDestinationTab('mine'); }} title={undefined}>
        <View style={styles.sheetHeading}>
          <AppText accessibilityRole="header" style={styles.sheetTitle}>Onde publicar?</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => { setPicking(false); setDestinationQuery(''); setDestinationTab('mine'); }} style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}><Icon name="close" size={22} /></Pressable>
        </View>
        <AppText variant="caption" style={styles.sheetSubtitle}>Escolha até 3 comunas, além do perfil.</AppText>
        <View style={styles.sheetSearch}>
          <Icon name="search" size={20} />
          <PopulariaBottomSheetTextInput value={destinationQuery} onChangeText={setDestinationQuery} placeholder="Buscar por nome, bairro ou assunto" placeholderTextColor={Colors.placeholder} accessibilityLabel="Buscar comuna" returnKeyType="search" style={styles.sheetInput} />
        </View>

        {destinationTab === 'mine' ? <DestinationChoice
          selected={selectedDestinationIds.includes('perfil')}
          mark={<Avatar initials={me.initials} tone={me.tone} size={44} shape="square" outline userId={me.id} imageUrl={me.avatarUrl} />}
          name="Meu perfil"
          subtitle={DEMO_MODE ? `${MY_FOLLOWERS} seguidores` : 'Visível no seu perfil e no feed'}
          onPress={() => toggleDestination('perfil')}
        /> : null}
        {destinationRows.map((c) => <DestinationChoice
          key={c.id}
          selected={selectedDestinationIds.includes(c.id)}
          disabled={selectedDestinationIds.filter((value) => value !== 'perfil').length >= MAX_COMUNAS && !selectedDestinationIds.includes(c.id)}
          mark={<ComunaMark initials={c.initials} tone={c.tone} size={44} style={styles.choiceMark} />}
          name={`c/ ${c.name}`}
          subtitle={`${formatPeople(c.memberCount)} ${c.memberCount === 1 ? 'membro' : 'membros'} · ${c.visibility === 'private' ? 'Só membros' : 'Pública'}`}
          onPress={() => toggleDestination(c.id)}
        />)}
        {destinationTab === 'near' && !account?.city ? <AppText variant="caption" style={styles.sheetNote}>Defina sua cidade em Meus dados para ver comunas perto de você.</AppText> : null}
        {destinationTab === 'near' && account?.city && nearOptions.length === 0 ? <AppText variant="caption" style={styles.sheetNote}>Nenhuma outra comuna encontrada perto de {account.city}.</AppText> : null}
        {destinationTab === 'mine' && myOptions.length === 0 ? <AppText variant="caption" style={styles.sheetNote}>Você ainda não participa de nenhuma comuna. Entre em uma pelo Explorar.</AppText> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Criar uma comuna" onPress={() => { setPicking(false); router.push('/criar-comuna'); }} style={({ pressed }) => [styles.createComuna, pressed && styles.pressed]}>
          <AppText style={styles.createComunaLabel}>+ Criar uma comuna</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Confirmar publicação em ${where}`} onPress={() => { setPicking(false); setDestinationQuery(''); setDestinationTab('mine'); }} style={({ pressed }) => [styles.sheetConfirm, { paddingBottom: Math.max(insets.bottom, Spacing.three), marginBottom: -(Math.max(insets.bottom, Spacing.four) + Spacing.four) }, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <AppText variant="label" color={Colors.cream}>Publicar em</AppText>
            <AppText style={styles.sheetConfirmName} color={Colors.paper}>{publishTargets.length > 1 ? `${publishTargets.length} locais` : destination.kind === 'perfil' ? 'Meu perfil' : `c/ ${destination.comuna.name}`}</AppText>
          </View>
          <View style={styles.sheetConfirmCheck}><Icon name="check" size={24} color={Colors.ink} /></View>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={topicSheet} onClose={() => setTopicSheet(false)} title="Escolher assuntos">
        <AppText variant="caption">Escolha até 3. Nenhum assunto é obrigatório.</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Sem assunto" onPress={() => { setTopics([]); setTopicSheet(false); }} style={({ pressed }) => [styles.topicOption, pressed && styles.pressed]}>
          <AppText style={styles.topicPickerLabel}>Sem assunto</AppText>
          {topics.length === 0 ? <Icon name="check" size={20} color={Colors.red} /> : null}
        </Pressable>
        {topicGroups.map((group) => <View key={group.title}>
          <AppText variant="label" color={Colors.red} style={styles.topicGroup}>{group.title}</AppText>
          {group.topics.map((item) => {
            const selected = topics.includes(item.id);
            const disabled = !selected && topics.length >= 3;
            return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} accessibilityLabel={item.label} disabled={disabled} onPress={() => setTopics((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length >= 3 ? current : [...current, item.id])} style={({ pressed }) => [styles.topicOption, disabled && styles.topicOptionDisabled, pressed && styles.pressed]}>
              <AppText style={styles.topicPickerLabel}>{item.label}</AppText>
              {selected ? <Icon name="check" size={20} color={Colors.red} /> : null}
            </Pressable>;
          })}
        </View>)}
        <EditorialAction label="Concluir" icon="check" tone="paper" labelVariant="button" onPress={() => setTopicSheet(false)} style={styles.topicDone} />
      </BottomSheet>
      {callPicker ? <CallSchedulePicker visible date={call.date} time={call.time} onClose={() => setCallPicker(false)} onConfirm={(date, time) => setCall((current) => ({ ...current, date, time }))} /> : null}
    </Screen>
  );
}

function DestinationStepView({ me, destination, targetCount, where, visibilityText, callBlocked, onOpen }: {
  me: FeedItem['author'];
  destination: Destination;
  targetCount: number;
  where: string;
  visibilityText: string;
  callBlocked: boolean;
  onOpen: () => void;
}) {
  return <View style={styles.step}>
    <StepHeading number="01" label="Publicar em" />
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Publicar em ${where}. Trocar destino`}
      style={({ pressed }) => [styles.destinationCard, pressed && styles.pressed]}>
      <Tape />
      <DestinationMark destination={destination} me={me} />
      <View style={styles.destinationCopy}>
        <AppText style={styles.destinationName} numberOfLines={1}>{targetCount > 1 ? `${targetCount} locais` : destination.kind === 'perfil' ? 'Meu perfil' : `c/ ${destination.comuna.name}`}</AppText>
        <View style={styles.visibilityRow}>
          <Icon name={destination.kind === 'comuna' && destination.comuna.visibility === 'private' ? 'lock' : 'globe'} size={15} color={Colors.inkSoft} />
          <AppText variant="caption" numberOfLines={1} style={[styles.visibilityText, callBlocked && styles.visibilityBlocked]}>{callBlocked ? 'Só a moderação convoca' : targetCount > 1 ? `${targetCount} comunas` : visibilityText}</AppText>
        </View>
      </View>
      <View style={styles.changeDestination}>
        <AppText style={styles.changeLabel}>Trocar</AppText>
        <Icon name="chevronRight" size={16} />
      </View>
    </Pressable>
  </View>;
}

const DestinationStep = withPerformanceProfiler('ComposerDestinationStep', DestinationStepView);

function PostTypeStepView({ mode, narrow, onWrite, onCall, onPoll }: {
  mode: 'write' | 'call' | 'poll';
  narrow: boolean;
  onWrite: () => void;
  onCall: () => void;
  onPoll: () => void;
}) {
  return <View style={styles.step}>
    <StepHeading number="02" label="O que você quer fazer?" />
    <View style={styles.typeGrid} role="tablist">
      <TypeTile icon="document" label="Escrever" caption="papo, meme, foto, opinião" active={mode === 'write'} narrow={narrow} onPress={onWrite} />
      <TypeTile icon="megaphone" label="Chamado" caption="juntar a galera" active={mode === 'call'} narrow={narrow} onPress={onCall} />
      <TypeTile icon="poll" label="Enquete" caption="perguntar pra galera" active={mode === 'poll'} narrow={narrow} last onPress={onPoll} />
    </View>
  </View>;
}

const PostTypeStep = withPerformanceProfiler('ComposerPostTypeStep', PostTypeStepView);

function PreviewPanelView({ item }: { item: FeedItem }) {
  return <View style={styles.previewBox} pointerEvents="none" accessible accessibilityLabel={`Pré-visualização: ${[item.title, item.text].filter(Boolean).join('. ')}`} importantForAccessibility="no-hide-descendants">
    {/* Prévia de um cartão único, não uma lista reciclada: mantém o vídeo como no feed. */}
    <PostCard item={item} mediaVisible />
  </View>;
}

const PreviewPanel = withPerformanceProfiler('ComposerPreview', PreviewPanelView);

function WritePhotoFrameView({ media, onPickImage, onRemoveMedia }: {
  media: LocalPostMedia | null;
  onPickImage: () => void;
  onRemoveMedia: () => void;
}) {
  return <View style={styles.photoFrame}>
    <View style={styles.photoZone}>
      {media?.kind === 'image' ? <>
        <Image source={{ uri: media.uri }} contentFit="cover" style={styles.photoPreview} />
        <View style={styles.photoActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Trocar foto" onPress={onPickImage} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}><Icon name="edit" size={18} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Remover foto" onPress={onRemoveMedia} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}><Icon name="trash" size={18} /></Pressable>
        </View>
      </> : <Pressable accessibilityRole="button" accessibilityLabel="Adicionar foto" onPress={onPickImage} style={({ pressed }) => [styles.photoEmpty, pressed && styles.pressed]}>
        <Icon name="image" size={30} color={Colors.muted} />
        <AppText style={styles.photoEmptyTitle}>Sua foto</AppText>
        <AppText variant="caption">Toque para escolher uma imagem</AppText>
      </Pressable>}
    </View>
    <Tape photo />
  </View>;
}

const WritePhotoFrame = memo(withPerformanceProfiler('ComposerWritePhotoFrame', WritePhotoFrameView));

function WriteEditorView({ store, publishing, media, onFocusField, onPickImage, onRemoveMedia }: {
  store: WriteDraftStore;
  publishing: boolean;
  media: LocalPostMedia | null;
  onFocusField: () => void;
  onPickImage: () => void;
  onRemoveMedia: () => void;
}) {
  // O editor assina o rascunho inteiro; a tela do composer não.
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <View style={styles.editorShadow}>
    <View style={styles.editorCard}>
      <View style={styles.editorHeader}>
        <AppText variant="label" color={Colors.paper}>Rascunho</AppText>
        <AppText style={styles.editorCounter} color={Colors.onInkMuted}>{draft.text.length}/{MAX_LENGTH}</AppText>
      </View>
      <View style={styles.editorBody}>
        {draft.query ? <MentionSuggestions query={draft.query.query} onSelect={store.insert} /> : null}
        {draft.titleEnabled || draft.title.length > 0 ? (
          <View style={styles.titleField}>
            <View style={styles.titleFieldHeader}>
              <AppText variant="label">Título</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Remover título" onPress={store.clearTitle} hitSlop={10}>
                <Icon name="close" size={16} />
              </Pressable>
            </View>
            <TextInput editable={!publishing} onFocus={onFocusField} value={draft.title} onChangeText={store.setTitle} maxLength={MAX_TITLE} placeholder="Ex.: Quinta tem ato contra o aumento da passagem" placeholderTextColor={Colors.placeholder} accessibilityLabel="Título da publicação" style={styles.titleInput} />
          </View>
        ) : null}
        <TextInput
          editable={!publishing}
          onFocus={onFocusField}
          scrollEnabled={false}
          value={draft.text}
          onChangeText={store.onChangeText}
          onSelectionChange={(event) => store.onSelectionChange(event.nativeEvent.selection)}
          {...(draft.selection ? { selection: draft.selection } : {})}
          maxLength={MAX_LENGTH}
          multiline
          textAlignVertical="top"
          placeholder="Conte para a comuna o que está acontecendo…"
          placeholderTextColor={Colors.placeholder}
          accessibilityLabel="Texto da publicação"
          style={styles.input}
        />
        <View style={styles.editorTools}>
          <Pressable accessibilityRole="button" accessibilityLabel="Adicionar título" onPress={() => store.setTitleEnabled(true)} style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}>
            <AppText style={styles.toolLabel}>+ Título</AppText>
          </Pressable>
        </View>
        <WritePhotoFrame media={media} onPickImage={onPickImage} onRemoveMedia={onRemoveMedia} />
      </View>
    </View>
  </View>;
}

const WriteEditor = memo(withPerformanceProfiler('ComposerWriteEditor', WriteEditorView));

function DestinationMark({ destination, me }: { destination: Destination; me: FeedItem['author'] }) {
  if (destination.kind === 'perfil') return <Avatar initials={me.initials} tone={me.tone} size={42} shape="square" outline userId={me.id} imageUrl={me.avatarUrl} />;
  const { comuna } = destination;
  return <ComunaMark initials={comuna.initials} tone={comuna.tone} size={42} style={styles.destinationMark} />;
}

function Tape({ photo = false }: { photo?: boolean }) {
  return <View pointerEvents="none" style={[styles.tape, photo && styles.tapePhoto]} />;
}

function StepHeading({ number, label, aside }: { number: string; label: string; aside?: string }) {
  return <View style={styles.stepHeading}>
    <View style={styles.stepNumber}><AppText variant="label" color={Colors.paper} style={styles.stepNumberText}>{number}</AppText></View>
    <AppText variant="label" style={styles.stepLabel}>{label}</AppText>
    {aside ? <AppText variant="caption" style={styles.stepAside}>{aside}</AppText> : null}
  </View>;
}

function TypeTile({ icon, label, caption, active, narrow = false, last = false, onPress }: { icon: IconName; label: string; caption: string; active: boolean; narrow?: boolean; last?: boolean; onPress: () => void }) {
  return <Pressable
    onPress={onPress}
    role="tab"
    accessibilityState={{ selected: active }}
    accessibilityLabel={label}
    accessibilityHint={caption}
    style={({ pressed }) => [styles.typeTile, last && styles.typeTileLast, active && styles.typeTileActive, pressed && styles.pressed]}>
    {active ? <View style={styles.typeTileMarker} /> : null}
    <Icon name={icon} size={24} color={active ? Colors.paper : Colors.ink} />
    <View style={styles.typeTileCopy}>
      <AppText style={[styles.typeTileTitle, narrow && styles.typeTileTitleNarrow]} color={active ? Colors.paper : Colors.ink} numberOfLines={1}>{label}</AppText>
      <AppText style={styles.typeTileCaption} color={active ? Colors.onInkMuted : Colors.muted}>{caption}</AppText>
    </View>
  </Pressable>;
}

function QuickChip({ label, active = false, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quickChip, active && styles.quickChipActive, pressed && styles.pressed]}>
    <AppText style={styles.quickChipLabel} color={active ? Colors.paper : Colors.ink}>{label}</AppText>
  </Pressable>;
}

function CounterButton({ icon, label, dark = false, onStep }: { icon: IconName; label: string; dark?: boolean; onStep: (amount?: number) => void }) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const stop = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
  }, []);
  useEffect(() => () => stop(), [stop]);
  const start = () => {
    stop();
    startedAt.current = Date.now();
    // Um toque curto continua sendo exatamente +1: a repetição só começa depois de 500 ms.
    onStep(1);
    const tick = () => {
      const elapsed = Date.now() - startedAt.current;
      // Curva de sensação: primeiro repetição lenta, depois passos cada vez maiores e mais rápidos.
      const amount = elapsed < 1500 ? 1 : elapsed < 2500 ? 2 : elapsed < 3500 ? 5 : elapsed < 4500 ? 15 : elapsed < 5500 ? 40 : 100;
      const delay = elapsed < 700 ? 350 : elapsed < 1500 ? 220 : elapsed < 2500 ? 120 : elapsed < 3500 ? 55 : elapsed < 4500 ? 25 : elapsed < 5500 ? 10 : 4;
      onStep(amount);
      timeout.current = setTimeout(tick, delay);
    };
    timeout.current = setTimeout(tick, 500);
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPressIn={start} onPressOut={stop} style={({ pressed }) => [styles.counterButton, dark && styles.counterButtonDark, pressed && styles.pressed]}>
    <Icon name={icon} size={22} color={dark ? Colors.paper : Colors.ink} />
  </Pressable>;
}

function ToolbarButton({ icon, label, caption, active, last = false, onPress }: { icon: IconName; label: string; caption?: string; active?: boolean; last?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress} style={({ pressed }) => [styles.toolbarButton, last && styles.toolbarButtonLast, active && styles.toolbarButtonActive, pressed && styles.pressed]}>
    <Icon name={icon} size={22} color={active ? Colors.paper : Colors.ink} />
    <AppText style={styles.toolbarLabel} color={active ? Colors.paper : Colors.ink}>{label}{caption ? ` · ${caption}` : ''}</AppText>
  </Pressable>;
}

function DestinationChoice({ selected, disabled = false, mark, name, subtitle, onPress }: { selected: boolean; disabled?: boolean; mark: ReactNode; name: string; subtitle: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} accessibilityLabel={`${name}. ${subtitle}`} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choiceRow, selected && styles.choiceRowSelected, disabled && styles.choiceRowDisabled, pressed && styles.pressed]}>
    {mark}
    <View style={styles.choiceCopy}>
      <AppText style={styles.choiceName} numberOfLines={1}>{name}</AppText>
      <AppText variant="caption" numberOfLines={1}>{subtitle}</AppText>
    </View>
    <View style={[styles.choiceCheck, selected && styles.choiceCheckOn]}>{selected ? <Icon name="check" size={18} color={Colors.paper} /> : null}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.68 },
  content: { paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.six },
  step: { paddingHorizontal: Spacing.five, gap: Spacing.three },
  stepHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepNumber: { minWidth: 30, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, backgroundColor: Colors.red },
  stepNumberText: { fontFamily: Fonts.extrabold, fontSize: 12.5, lineHeight: 21, letterSpacing: 0.6 },
  stepLabel: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 21 },
  stepAside: { textAlign: 'right' },
  previewButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  previewButtonActive: { backgroundColor: Colors.ink },
  previewButtonLabel: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22 },
  destinationCard: { position: 'relative', minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two + 2, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, ...Shadows.offsetSmall },
  destinationMark: { borderWidth: 2, borderColor: Colors.ink },
  tape: { position: 'absolute', top: -9, left: -8, width: 68, height: 20, zIndex: 2, backgroundColor: Colors.straw, opacity: 0.96, borderWidth: 1, borderColor: Colors.strawDark, boxShadow: '2px 2px 0 rgba(22,18,15,0.12)', transform: [{ rotate: '-20deg' }] },
  tapePhoto: { width: 56, height: 16 },
  photoFrame: { position: 'relative', marginTop: Spacing.four },
  destinationCopy: { flex: 1, minWidth: 0, gap: 3 },
  destinationName: { fontFamily: Fonts.extrabold, fontSize: 17, lineHeight: 25 },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  visibilityText: { flexShrink: 1, fontSize: 12.5, lineHeight: 21 },
  visibilityBlocked: { color: Colors.red, fontFamily: Fonts.bold },
  callBlockedBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, marginHorizontal: Spacing.five, marginBottom: Spacing.two, padding: Spacing.three, borderWidth: 1.5, borderColor: Colors.red, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  callBlockedText: { flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 20, color: Colors.ink },
  changeDestination: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: Spacing.one },
  changeLabel: { fontFamily: Fonts.bold, fontSize: 13.5, lineHeight: 21, textDecorationLine: 'underline' },
  typeGrid: { flexDirection: 'row', borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.paper },
  typeTile: { flex: 1, minHeight: 112, padding: 6, gap: Spacing.two, borderRightWidth: 2, borderRightColor: Colors.ink },
  typeTileLast: { borderRightWidth: 0 },
  typeTileActive: { backgroundColor: Colors.ink },
  typeTileMarker: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, backgroundColor: Colors.red },
  typeTileCopy: { gap: 1 },
  typeTileTitle: { fontFamily: Fonts.extrabold, fontSize: 15.5, lineHeight: 24 },
  typeTileTitleNarrow: { fontSize: 14.5, lineHeight: 23 },
  typeTileCaption: { fontSize: 12.5, lineHeight: 21 },
  previewBox: { gap: Spacing.two },
  editorShadow: { borderRadius: 8, ...Shadows.offset, boxShadow: '3px 3px 0 #16120F' },
  editorCard: { borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper, overflow: 'hidden' },
  editorHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, backgroundColor: Colors.ink },
  editorCounter: { fontFamily: Fonts.mono, fontSize: 10.5, lineHeight: 19 },
  editorBody: { padding: Spacing.three, gap: Spacing.two },
  titleField: { gap: Spacing.one, paddingBottom: Spacing.two, borderBottomWidth: 2, borderBottomColor: Colors.ink },
  titleFieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleInput: { fontFamily: Fonts.extrabold, fontSize: 20, lineHeight: 28, color: Colors.ink, paddingVertical: 4 },
  input: { minHeight: 132, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 23, color: Colors.ink, paddingVertical: Spacing.one },
  editorTools: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  toolButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.cream },
  toolLabel: { fontFamily: Fonts.extrabold, fontSize: 13.5, lineHeight: 21 },
  photoZone: { position: 'relative', minHeight: 178, overflow: 'hidden', borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.strawLight, transform: [{ rotate: '-1.2deg' }] },
  photoPreview: { width: '100%', height: 220 },
  photoActions: { position: 'absolute', right: Spacing.two, bottom: Spacing.two, flexDirection: 'row', gap: Spacing.two },
  photoAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  photoEmpty: { flex: 1, minHeight: 178, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  photoEmptyTitle: { fontFamily: Fonts.extrabold, fontSize: 15, lineHeight: 23, color: Colors.muted },
  pollShadow: { borderRadius: 8, ...Shadows.offset, boxShadow: '3px 3px 0 #16120F' },
  pollCard: { borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper, overflow: 'hidden' },
  pollHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, backgroundColor: Colors.ink },
  pollCount: { fontFamily: Fonts.mono, fontSize: 10.5, lineHeight: 19 },
  pollBody: { padding: Spacing.three, gap: Spacing.three },
  pollQuestion: { fontFamily: Fonts.anton, fontSize: 27, lineHeight: 35, letterSpacing: -0.2, textTransform: 'uppercase', color: Colors.ink, minHeight: 60, paddingTop: Spacing.one },
  dashedRule: { borderBottomWidth: 2, borderStyle: 'dashed', borderBottomColor: Colors.ink },
  pollOptionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'stretch', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.cream, overflow: 'hidden' },
  pollLetter: { width: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.red },
  pollLetterText: { fontFamily: Fonts.anton, fontSize: 22, lineHeight: 30 },
  pollOptionInput: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.three, fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 21, color: Colors.ink },
  pollRemove: { width: 40, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 2, borderLeftColor: Colors.ink },
  addOption: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.ink, borderRadius: Radius.sm },
  addOptionLabel: { fontFamily: Fonts.extrabold, fontSize: 14, lineHeight: 22 },
  callCard: { borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper, overflow: 'hidden' },
  callHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, backgroundColor: Colors.red },
  callMissing: { paddingTop: Spacing.two },
  callBody: { padding: Spacing.three, gap: Spacing.two },
  callCover: { height: 160, marginHorizontal: Spacing.three, marginTop: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, overflow: 'hidden' },
  callCoverImage: { width: '100%', height: '100%' },
  callCoverRemove: { position: 'absolute', right: 8, bottom: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.ink },
  callTitle: { fontFamily: Fonts.anton, fontSize: 28, lineHeight: 36, letterSpacing: -0.2, textTransform: 'uppercase', color: Colors.ink, paddingVertical: 0 },
  callDetails: { minHeight: 56, fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 22, color: Colors.ink },
  callLabel: { paddingTop: Spacing.two },
  dateRow: { flexDirection: 'row', gap: Spacing.two },
  dateField: { flex: 1.5 },
  timeField: { flex: 0.9 },
  quickDates: { flexDirection: 'row', gap: Spacing.two },
  quickChip: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.cream },
  quickChipActive: { backgroundColor: Colors.ink },
  quickChipLabel: { fontFamily: Fonts.extrabold, fontSize: 13.5, lineHeight: 21 },
  callPlace: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.cream, paddingHorizontal: Spacing.three },
  callPlaceInput: { flex: 1, minWidth: 0, fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 21, color: Colors.ink, paddingVertical: Spacing.two },
  rulesCard: { padding: Spacing.three, gap: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  rulesTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  durationRow: { flexDirection: 'row', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, overflow: 'hidden' },
  durationChip: { flex: 1, minHeight: 47, alignItems: 'center', justifyContent: 'center', borderRightWidth: 2, borderRightColor: Colors.ink, backgroundColor: Colors.paper },
  durationChipActive: { backgroundColor: Colors.ink },
  durationLabel: { fontFamily: Fonts.bold, fontSize: 13.5, lineHeight: 21 },
  ruleDivider: { height: 1, backgroundColor: Colors.strawDark },
  topicPicker: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  topicPickerLabel: { flex: 1, minWidth: 0, fontFamily: Fonts.bold, fontSize: 15.5, lineHeight: 24 },
  topicTriggerCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.one },
  topicSelected: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: Radius.sm, backgroundColor: Colors.strawLight },
  topicSelectedLabel: { fontFamily: Fonts.bold, fontSize: 12.5, lineHeight: 21 }, 
  topicOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  topicOptionDisabled: { opacity: 0.45 },
  topicDone: { marginTop: Spacing.three },
  topicGroup: { paddingTop: Spacing.four, paddingBottom: Spacing.one },
  attachmentSection: { paddingHorizontal: Spacing.five, gap: Spacing.two },
  attachmentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  eventPreview: { padding: Spacing.three, gap: 2, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  eventTitle: { fontFamily: Fonts.extrabold, fontSize: 15.5, lineHeight: 24 },
  inlineLink: { fontFamily: Fonts.bold, textDecorationLine: 'underline' },
  pdfNotice: { padding: Spacing.two, backgroundColor: Colors.strawLight, borderRadius: Radius.sm },
  attachmentActions: { flexDirection: 'row', gap: Spacing.two },
  flexAction: { flex: 1 },
  attachmentToolbar: { flexDirection: 'row', marginHorizontal: Spacing.five, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: Colors.paper },
  toolbarHint: { paddingHorizontal: Spacing.five, marginTop: -Spacing.three },
  callShadow: { borderRadius: 8, ...Shadows.offset, boxShadow: '3px 3px 0 #16120F' },
  whenGrid: { flexDirection: 'row', minHeight: 64, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: Colors.paper },
  whenCell: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 6, borderRightWidth: 2, borderRightColor: Colors.ink },
  whenCellActive: { backgroundColor: Colors.ink },
  whenCellLast: { borderRightWidth: 0 },
  whenLabel: { fontFamily: Fonts.monoSemibold, fontSize: 9.5, lineHeight: 18, letterSpacing: 0.35, textTransform: 'uppercase', color: Colors.muted },
  whenValue: { fontFamily: Fonts.anton, fontSize: 25, lineHeight: 33, letterSpacing: -0.2, textTransform: 'uppercase', color: Colors.ink },
  placeHint: { marginTop: -Spacing.one },
  placeSuggestions: { marginTop: -Spacing.one, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, overflow: 'hidden' },
  placeSuggestion: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  capacityTabs: { flexDirection: 'row', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, overflow: 'hidden' },
  capacityTab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRightWidth: 2, borderRightColor: Colors.ink, paddingHorizontal: 2 },
  capacityTabLast: { borderRightWidth: 0 },
  capacityTabActive: { backgroundColor: Colors.ink },
  capacityTabLabel: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 21 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.one },
  counterCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  counterNumber: { fontFamily: Fonts.anton, fontSize: 42, lineHeight: 50, color: Colors.red, letterSpacing: -0.6 },
  counterPeople: { fontFamily: Fonts.extrabold, fontSize: 15, lineHeight: 23 },
  counterActions: { flexDirection: 'row', gap: Spacing.two },
  counterButton: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  counterButtonDark: { backgroundColor: Colors.ink },
  capacityMarks: { flexDirection: 'row', gap: Spacing.one },
  capacityMark: { flex: 1, height: 20, borderWidth: 2, borderColor: Colors.ink, borderRadius: 2, backgroundColor: Colors.paper },
  capacityMarkFilled: { backgroundColor: Colors.ink },
  bringHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.two },
  bringChips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  bringChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  bringChipActive: { backgroundColor: Colors.ink },
  bringChipLabel: { fontFamily: Fonts.extrabold, fontSize: 13.5, lineHeight: 21 },
  bringAdd: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.ink, borderRadius: Radius.sm },
  bringAddLabel: { fontFamily: Fonts.extrabold, fontSize: 13.5, lineHeight: 21 },
  bringAddRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  bringInput: { width: 112, minHeight: 44, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, paddingHorizontal: Spacing.two, fontFamily: Fonts.regular, fontSize: 14, color: Colors.ink },
  bringConfirm: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.ink },
  callFootnote: { paddingTop: Spacing.two },
  toolbarButton: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 3, borderRightWidth: 2, borderRightColor: Colors.ink, paddingHorizontal: 2 },
  toolbarButtonLast: { borderRightWidth: 0 },
  toolbarButtonActive: { backgroundColor: Colors.ink },
  toolbarLabel: { fontFamily: Fonts.bold, fontSize: 11.5, lineHeight: 20 },
  publishBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: 2, borderTopColor: Colors.ink, backgroundColor: Colors.red, paddingHorizontal: Spacing.five, paddingTop: Spacing.three },
  publishBarDisabled: { opacity: 0.55 },
  publishCopy: { flex: 1, minWidth: 0, gap: 1 },
  publishTitle: { fontFamily: Fonts.anton, fontSize: 31, lineHeight: 39, letterSpacing: 0.2, textTransform: 'uppercase', color: Colors.paper },
  publishSubtitle: { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 21, color: Colors.cream },
  publishButton: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper, ...Shadows.offsetSmall },
  publishButtonConfirmed: { backgroundColor: Colors.ink },
  sheetNote: { paddingVertical: Spacing.two },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sheetTitle: { flex: 1, minWidth: 0, fontFamily: Fonts.anton, fontSize: 38, lineHeight: 46, letterSpacing: -0.4, textTransform: 'uppercase' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper },
  sheetSubtitle: { marginTop: -Spacing.one },
  sheetSearch: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three },
  sheetInput: { flex: 1, minWidth: 0, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22, color: Colors.ink, paddingVertical: Spacing.two },
  sheetTabs: { flexDirection: 'row', borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, overflow: 'hidden' },
  sheetTab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.paper, borderRightWidth: 2, borderRightColor: Colors.ink },
  sheetTabLast: { borderRightWidth: 0 },
  sheetTabActive: { backgroundColor: Colors.ink },
  sheetTabLabel: { fontFamily: Fonts.extrabold, fontSize: 14, lineHeight: 22 },
  choiceRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two + 2, borderWidth: 2, borderColor: Colors.inkSoft, borderRadius: 8, backgroundColor: Colors.paper },
  choiceMark: { borderWidth: 2, borderColor: Colors.ink, borderRadius: 8 },
  choiceRowDisabled: { opacity: 0.45 },
  choiceRowSelected: { borderColor: Colors.ink, borderWidth: 2, backgroundColor: Colors.paper, shadowColor: Colors.red, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3, boxShadow: '3px 3px 0 #D62718' },
  choiceCopy: { flex: 1, minWidth: 0, gap: 1 },
  choiceName: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  choiceCheck: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: 6, backgroundColor: Colors.paper },
  choiceCheckOn: { backgroundColor: Colors.ink },
  createComuna: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.ink, borderRadius: 8 },
  createComunaLabel: { fontFamily: Fonts.extrabold, fontSize: 15, lineHeight: 23 },
  sheetConfirm: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: Colors.red, borderRadius: 0, paddingHorizontal: Spacing.five, paddingVertical: Spacing.three, marginTop: Spacing.two, marginHorizontal: -Spacing.five },
  sheetConfirmName: { fontFamily: Fonts.anton, fontSize: 26, lineHeight: 34, letterSpacing: 0.2, textTransform: 'uppercase' },
  sheetConfirmCheck: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper },
  optionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  optionName: { fontFamily: Fonts.bold, fontSize: 15.5, lineHeight: 24 },
  verify: { marginHorizontal: Spacing.five, padding: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  verifyText: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 22 },
  verifyLink: { fontFamily: Fonts.bold, textDecorationLine: 'underline' },
});
