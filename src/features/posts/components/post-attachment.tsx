import { useEvent, useEventListener } from 'expo';
import { Image, type ImageLoadEventData, type ImageRef } from 'expo-image';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { AppState, Dimensions, Platform, Pressable, PixelRatio, StyleSheet, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { StripedPlaceholder } from '@/components/striped-placeholder';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { durationLabel, remainingLabel, type PostMediaDto } from '@/features/posts/post-media';
import { haptic } from '@/lib/haptics';
import {
  performanceInstrumentationEnabled,
  performanceNow,
  recordFeedPhotoError,
  recordFeedPhotoLoaded,
  recordVideoError,
  recordVideoFirstFrame,
  recordVideoFullscreen,
  recordVideoMount,
  recordVideoPause,
  recordVideoPlay,
  recordVideoSurfaceFirstFrame,
  recordVideoUnmount,
} from '@/lib/performance';

import { posterCache } from '../poster-cache';
import { PhotoViewer } from './photo-viewer';
import { measurePhotoOrigin, type WindowRect } from './photo-viewer-transition';
import { photoRenderMetrics } from './photo-render-metrics';
import { VideoViewer, type VideoChrome } from './video-viewer';
import { VIDEO_SURFACE_COVER_TIMEOUT_MS } from './video-surface';

/* O player do expo-video é um objeto imperativo: `muted`, `playbackRate` e `currentTime` são
   propriedades nativas, mudadas fora do estado do React de propósito. A análise de imutabilidade
   do React Compiler não se aplica a ele. */
/* eslint-disable react-hooks/immutability */

/**
 * Tempo da transição nativa de saída do `Modal` (`animationType="fade"`).
 * O visualizador só é montado ao abrir; ao fechar, fica mais este instante
 * montado para a janela nativa terminar o fade antes de seus hooks e gestos
 * serem liberados. Fora desse intervalo, um cartão fechado não paga o custo
 * de nenhum `PhotoViewer`.
 */
const PHOTO_VIEWER_EXIT_MS = 300;

let activePlayer: VideoPlayer | null = null;
/** Som é preferência da sessão, como nos apps de vídeo: vale para o próximo vídeo também. */
let soundEnabled = false;

function mediaRatio(media: Pick<PostMediaDto, 'width' | 'height'>) {
  return Math.max(0.8, Math.min(16 / 9, media.width / media.height || 16 / 10));
}

/**
 * Tamanho da variante usada só na transição para a tela cheia. O limite é o
 * quadro em pixels físicos, não a original: em Android/iOS o `loadAsync`
 * decodifica nesse tamanho e evita reter um segundo bitmap de 2048 × 2048.
 * A imagem final do visualizador continua sendo a original.
 */
function previewSize(media: Pick<PostMediaDto, 'width' | 'height'>) {
  const window = Dimensions.get('window');
  const ratio = media.width / media.height || 16 / 10;
  const windowRatio = window.width / window.height;
  const fitWidth = ratio > windowRatio ? window.width : window.height * ratio;
  const fitHeight = fitWidth / ratio;
  const scale = PixelRatio.get();
  return {
    maxWidth: Math.max(1, Math.round(fitWidth * scale)),
    maxHeight: Math.max(1, Math.round(fitHeight * scale)),
  };
}

/**
 * Lê o pôster do cache enquanto o componente está montado.
 *
 * `useSyncExternalStore` relê o cache quando outra instância publica o primeiro
 * quadro ou quando o componente é reaproveitado com outra mídia. A reserva
 * impede que a evicção remova o quadro em uso; o `onStoreChange` imediato cobre
 * um pôster que tenha chegado entre o render e a assinatura.
 */
function usePoster(mediaId: string) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const release = posterCache.retain(mediaId);
    const unsubscribe = posterCache.subscribe(mediaId, onStoreChange);
    onStoreChange();
    return () => {
      unsubscribe();
      release();
    };
  }, [mediaId]);
  const getSnapshot = useCallback(() => posterCache.peek(mediaId), [mediaId]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function PostAttachment({ media, localUri, visible = true, chrome, framed = false, viewportEnteredAt = null }: {
  media: PostMediaDto;
  localUri?: string;
  visible?: boolean;
  /** Autoria, contexto e ações para a tela cheia do vídeo. */
  chrome?: VideoChrome;
  /** Mantido por compatibilidade: sem controles nativos, o vídeo não precisa bloquear gestos. */
  blockGesture?: PanGesture | null;
  /** No cartão a mídia é emoldurada como um quadro; na prévia do compositor, não. */
  framed?: boolean;
  /**
   * Instante em que o cartão entrou na viewport confirmada da lista. Só a lista
   * conhece esse marco; a prévia do compositor e o harness passam `null` e não
   * entram na métrica de viewport (POP-25).
   */
  viewportEnteredAt?: number | null;
}) {
  const uri = localUri ?? media.url;
  if (!uri) return <View style={styles.error}><AppText variant="caption">Mídia indisponível.</AppText></View>;
  if (media.type === 'video') return visible
    ? <PostVideo key={uri} media={media} uri={uri} chrome={chrome} framed={framed} viewportEnteredAt={viewportEnteredAt} />
    : <VideoPoster key={media.id} media={media} framed={framed} />;
  return <PostPhoto key={uri} media={media} uri={uri} framed={framed} />;
}

/**
 * Foto do feed: quadro próprio com corte deliberado e tela cheia ao tocar.
 * Enquanto carrega, mostra a listra da casa; o corte nunca deixa faixa morta.
 */
function PostPhoto({ media, uri, framed = false }: { media: PostMediaDto; uri: string; framed?: boolean }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [open, setOpen] = useState(false);
  // Monta o visualizador só depois do toque. Os hooks, os gestos e a janela
  // nativa ficam fora de todos os cartões que ninguém abriu. Ao fechar, a
  // montagem sobrevive por `PHOTO_VIEWER_EXIT_MS` para o fade nativo terminar.
  const [viewerMounted, setViewerMounted] = useState(false);
  // Variante reduzida para cobrir a primeira decodificação da original em tela
  // cheia. Só é lida no toque e liberada ao fechar, para não reter uma foto por
  // cartão da lista.
  const [preview, setPreview] = useState<ImageRef | null>(null);
  // Origem do thumbnail para a continuação visual. A medida é tirada no
  // `pressIn` e vira um snapshot ao abrir; o ref da célula não é guardado,
  // porque a lista pode reciclá-la para outra foto.
  const [transitionOrigin, setTransitionOrigin] = useState<WindowRect | null>(null);
  const frame = useRef<ComponentRef<typeof Pressable>>(null);
  const measuredOrigin = useRef<WindowRect | null>(null);
  const originRequest = useRef(0);
  const previewRequest = useRef(0);
  const previewLoading = useRef(false);
  const viewerCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Medição do tamanho efetivo do feed (POP-65). O layout fica em DIP; a
  // conversão para pixels físicos acontece no onLoad, quando a fonte também é
  // conhecida. Um cartão reciclado não reaproveita o quadro do anterior.
  const frameSize = useRef<{ width: number; height: number } | null>(null);
  const loadStartedAt = useRef(performanceNow());
  const feedLoadRecordedFor = useRef<string | null>(null);

  useEffect(() => {
    loadStartedAt.current = performanceNow();
    feedLoadRecordedFor.current = null;
  }, [media.id]);

  useEffect(() => () => {
    // Uma leitura em voo não pode atualizar estado depois do unmount.
    previewRequest.current += 1;
    originRequest.current += 1;
    if (viewerCloseTimer.current !== null) clearTimeout(viewerCloseTimer.current);
  }, []);

  const measureOrigin = () => {
    // A web mantém o fade: `measureInWindow` e o Reanimated não têm o mesmo
    // contrato de janela do nativo.
    if (Platform.OS === 'web') {
      measuredOrigin.current = null;
      return;
    }
    const request = originRequest.current + 1;
    originRequest.current = request;
    measuredOrigin.current = null;
    const window = Dimensions.get('window');
    measurePhotoOrigin(frame.current, window.width, window.height, (next) => {
      // Um callback atrasado de um toque anterior não pode contaminar a
      // próxima abertura.
      if (request === originRequest.current) measuredOrigin.current = next;
    });
  };

  const loadPreview = () => {
    if (preview || previewLoading.current) return;
    // Só busca a variante depois que o feed já carregou: assim é cache hit e
    // não disputa rede com a original em cache frio.
    if (status !== 'ready') return;
    if (Platform.OS === 'web' || typeof Image.loadAsync !== 'function') return;
    const request = previewRequest.current + 1;
    previewRequest.current = request;
    previewLoading.current = true;
    const size = previewSize(media);
    void Image.loadAsync({ uri }, size)
      .then((cached) => {
        if (request === previewRequest.current && cached) setPreview(cached);
      })
      .catch(() => {
        // Sem bitmap em cache, a listra do visualizador continua sendo o fallback.
      })
      .finally(() => {
        if (request === previewRequest.current) previewLoading.current = false;
      });
  };

  const openViewer = () => {
    // Reabrir durante o fade de saída cancela a liberação agendada: o mesmo
    // visualizador volta a ficar visível sem remontar no meio da transição.
    if (viewerCloseTimer.current !== null) {
      clearTimeout(viewerCloseTimer.current);
      viewerCloseTimer.current = null;
    }
    loadPreview();
    // Cache frio ou feed ainda carregando: sem bitmap decodificado não há
    // continuação visual; o visualizador abre com a listra e o fade. A medida é
    // consumida aqui para uma abertura sem `pressIn` (leitor de tela) nunca
    // reutilizar o retângulo de um toque anterior; a requisição em voo é
    // invalidada para não recolocar uma medida depois da abertura.
    originRequest.current += 1;
    const origin = status === 'ready' ? measuredOrigin.current : null;
    measuredOrigin.current = null;
    setTransitionOrigin(origin);
    setViewerMounted(true);
    setOpen(true);
  };

  const onPhotoLayout = (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    frameSize.current = width > 0 && height > 0 ? { width, height } : null;
  };

  const onPhotoLoad = (event: ImageLoadEventData) => {
    setStatus('ready');
    if (!performanceInstrumentationEnabled() || feedLoadRecordedFor.current === media.id) return;
    const source = event?.source;
    if (!source || source.width <= 0 || source.height <= 0) return;
    feedLoadRecordedFor.current = media.id;
    const layout = frameSize.current;
    const pixelRatio = PixelRatio.get();
    const metrics = layout
      ? photoRenderMetrics({
        sourceWidth: source.width,
        sourceHeight: source.height,
        layoutWidth: layout.width,
        layoutHeight: layout.height,
        pixelRatio,
      })
      : null;
    // A API conhece as dimensões do upload; o evento pode reportar o bitmap já
    // reduzido pelo decoder. Guardar os dois separa "quanto a fonte tinha" de
    // "quanto o nativo realmente decodificou".
    const uploadMetrics = layout && media.width > 0 && media.height > 0
      ? photoRenderMetrics({
        sourceWidth: media.width,
        sourceHeight: media.height,
        layoutWidth: layout.width,
        layoutHeight: layout.height,
        pixelRatio,
      })
      : null;
    recordFeedPhotoLoaded(media.id, {
      elapsedMs: performanceNow() - loadStartedAt.current,
      cacheType: event.cacheType ?? 'none',
      sourceWidth: source.width,
      sourceHeight: source.height,
      ...(uploadMetrics ? {
        uploadWidth: media.width,
        uploadHeight: media.height,
        uploadBytes: uploadMetrics.decodedBytes,
        uploadCoverRatio: uploadMetrics.sourceCoverRatio,
      } : {}),
      ...(metrics ? {
        renderedWidthPx: metrics.renderedWidthPx,
        renderedHeightPx: metrics.renderedHeightPx,
        neededWidthPx: metrics.neededWidthPx,
        neededHeightPx: metrics.neededHeightPx,
        decodedBytes: metrics.decodedBytes,
        neededBytes: metrics.neededBytes,
        sourceCoverRatio: metrics.sourceCoverRatio,
      } : {}),
    });
  };

  const closeViewer = () => {
    previewRequest.current += 1;
    previewLoading.current = false;
    setPreview(null);
    setTransitionOrigin(null);
    setOpen(false);
    if (viewerCloseTimer.current !== null) clearTimeout(viewerCloseTimer.current);
    viewerCloseTimer.current = setTimeout(() => {
      viewerCloseTimer.current = null;
      setViewerMounted(false);
    }, PHOTO_VIEWER_EXIT_MS);
  };

  return <>
    <Pressable
      ref={frame}
      onPressIn={measureOrigin}
      onPress={openViewer}
      onLayout={onPhotoLayout}
      accessibilityRole="button"
      accessibilityLabel="Abrir foto em tela cheia"
      style={({ pressed }) => [styles.photoFrame, framed && styles.framed, { aspectRatio: mediaRatio(media) }, pressed && styles.pressed]}>
      {status === 'loading' ? <View style={styles.skeleton} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <StripedPlaceholder label="Foto da publicação" showLabel={false} style={styles.skeletonFill} />
      </View> : null}
      <Image
        testID="post-photo-image"
        source={{ uri }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={media.id}
        transition={180}
        onLoad={onPhotoLoad}
        onError={() => { setStatus('error'); recordFeedPhotoError(media.id); }}
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
      {status === 'error' ? <View style={[StyleSheet.absoluteFill, styles.photoError]}><AppText variant="caption">Não foi possível carregar a imagem.</AppText></View> : null}
    </Pressable>
    {viewerMounted ? <PhotoViewer
      uri={uri}
      preview={preview}
      mediaId={media.id}
      visible={open}
      onClose={closeViewer}
      width={media.width}
      height={media.height}
      origin={transitionOrigin}
    /> : null}
  </>;
}

/** Fora da tela o vídeo não carrega: fica o primeiro quadro já gerado, ou a listra escura. */
function VideoPoster({ media, framed = false }: { media: PostMediaDto; framed?: boolean }) {
  const poster = usePoster(media.id);
  return <View style={[styles.videoFrame, framed && styles.framed, { aspectRatio: mediaRatio(media) }]}>
    {poster
      ? <Image source={poster} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} />
      : <StripedPlaceholder label="Vídeo da publicação" showLabel={false} style={styles.skeletonFill} />}
    <View style={styles.duration}><AppText variant="label" color={Colors.paper}>{durationLabel(media.durationMs)}</AppText></View>
  </View>;
}

function PostVideo({ media, uri, chrome, framed = false, viewportEnteredAt = null }: { media: PostMediaDto; uri: string; chrome?: VideoChrome; framed?: boolean; viewportEnteredAt?: number | null }) {
  let videoModule: typeof import('expo-video');
  try {
    // Evita derrubar a inicialização em development builds feitos antes da inclusão do módulo nativo.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    videoModule = require('expo-video') as typeof import('expo-video');
  } catch {
    return <View style={styles.error}><AppText variant="caption">Atualize o app para reproduzir este vídeo.</AppText></View>;
  }
  return <LoadedPostVideo media={media} uri={uri} videoModule={videoModule} chrome={chrome} framed={framed} viewportEnteredAt={viewportEnteredAt} />;
}

function LoadedPostVideo({ media, uri, videoModule, chrome, framed = false, viewportEnteredAt = null }: { media: PostMediaDto; uri: string; videoModule: typeof import('expo-video'); chrome?: VideoChrome; framed?: boolean; viewportEnteredAt?: number | null }) {
  const useVideoPlayer = videoModule.useVideoPlayer;
  const VideoView = videoModule.VideoView;
  const player = useVideoPlayer({ uri, useCaching: false }, (instance) => {
    instance.muted = !soundEnabled;
    instance.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(!soundEnabled);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const poster = usePoster(media.id);
  const [position, setPosition] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Muda só na abertura: a cobertura da tela cheia reinicia sem remontar a
  // surface durante o fade de fechamento.
  const [fullscreenSession, setFullscreenSession] = useState(0);
  // O feed fica coberto pelo pôster só na volta da tela cheia, até a surface
  // remontada receber o quadro atual.
  const [feedCoverVisible, setFeedCoverVisible] = useState(false);
  // Um toque que veio de um "segurar para acelerar" não deve pausar o vídeo.
  const heldAt = useRef(0);
  // TTFF: do pedido de reprodução ao primeiro quadro, uma vez por instância montada.
  const playIntentAt = useRef<number | null>(null);
  // POP-25: separa o custo de montagem/commit (viewport → player) do custo de
  // rede/decodificação (play → primeiro quadro).
  const mountedAt = useRef<number | null>(null);
  const firstFrameRecorded = useRef(false);
  const errorRecorded = useRef(false);
  // Transição feed → tela cheia → feed: cada surface remontada tem seu primeiro quadro.
  const fullscreenStartedAt = useRef<number | null>(null);
  const feedReturnStartedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = performanceNow();
    recordVideoMount(media.id);
    return () => recordVideoUnmount(media.id);
  }, [media.id]);

  useEffect(() => {
    if (status === 'error' && !errorRecorded.current) {
      errorRecorded.current = true;
      recordVideoError(media.id);
    }
  }, [media.id, status]);

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    setPlaying(isPlaying);
    if (isPlaying) {
      recordVideoPlay(media.id);
    } else {
      recordVideoPause(media.id);
    }
    if (!isPlaying) return;
    setEnded(false);
    if (activePlayer && activePlayer !== player) activePlayer.pause();
    activePlayer = player;
  });

  useEventListener(player, 'playToEnd', () => {
    setEnded(true);
    setPlaying(false);
  });

  // Contador regressivo: o texto do chip acompanha a reprodução, não o arquivo.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => setPosition(currentTime));

  useEffect(() => {
    player.muted = muted;
    if (muted) { soundEnabled = false; } else { soundEnabled = true; }
  }, [muted, player]);

  useEffect(() => { player.playbackRate = speed; }, [player, speed]);

  useEffect(() => {
    player.timeUpdateEventInterval = 0.5;
    return () => { player.timeUpdateEventInterval = 0; };
  }, [player]);

  useEffect(() => {
    if (activePlayer && activePlayer !== player) activePlayer.pause();
    activePlayer = player;
    // `currentState` começa nulo antes das constantes nativas. Bloqueia os estados
    // conhecidos sem primeiro plano; o listener abaixo pausa qualquer mudança.
    const appInBackground = AppState.currentState === 'background'
      || AppState.currentState === 'inactive'
      || AppState.currentState === 'extension';
    if (!appInBackground) {
      playIntentAt.current ??= performanceNow();
      player.play();
    }
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => {
      listener.remove();
      if (activePlayer === player) activePlayer = null;
      // useVideoPlayer libera o player no unmount.
    };
  }, [player]);

  // O primeiro quadro vira pôster: cobre o vídeo antes de carregar e fica quando ele sai da tela.
  // `loadWithOutcome` deduplica duas instâncias da mesma mídia. Se a geração veio de
  // outra instância e falhou, esta tenta uma única vez com o próprio player.
  useEffect(() => {
    // Gerar miniatura ainda não existe no player web; o pôster é opcional.
    if (Platform.OS === 'web') return;
    let alive = true;
    let retried = false;
    const generate = async () => {
      const [thumbnail] = await player.generateThumbnailsAsync(0);
      return thumbnail ?? null;
    };
    const attempt = () => {
      void posterCache.loadWithOutcome(media.id, generate).then(({ poster, shared }) => {
        if (!alive || poster || !shared || retried) return;
        retried = true;
        attempt();
      });
    };
    attempt();
    return () => { alive = false; };
  }, [media.id, player]);

  // A cobertura da volta é pública: se a plataforma não emitir o primeiro
  // quadro na remontagem, o pôster sai sozinho em vez de ficar preso.
  useEffect(() => {
    if (!feedCoverVisible) return;
    const timer = setTimeout(() => setFeedCoverVisible(false), VIDEO_SURFACE_COVER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [feedCoverVisible]);

  const toggle = () => {
    if (ended) {
      setEnded(false);
      player.currentTime = 0;
      playIntentAt.current ??= performanceNow();
      player.play();
      return;
    }
    if (player.playing) {
      player.pause();
    } else {
      playIntentAt.current ??= performanceNow();
      player.play();
    }
  };

  // TTFF da instância de player. Pode chegar no feed ou já na tela cheia; uma
  // remontagem de surface não reinicia a medição.
  const recordInitialFirstFrame = () => {
    if (firstFrameRecorded.current) return;
    firstFrameRecorded.current = true;
    const frameAt = performanceNow();
    const startedAt = playIntentAt.current;
    const mountStartedAt = mountedAt.current;
    const viewport = viewportEnteredAt !== null && mountStartedAt !== null
      ? {
          totalMs: frameAt - viewportEnteredAt,
          toMountMs: mountStartedAt - viewportEnteredAt,
        }
      : undefined;
    if (startedAt !== null) recordVideoFirstFrame(media.id, frameAt - startedAt, viewport);
  };

  const openFullscreen = () => {
    fullscreenStartedAt.current = performanceNow();
    recordVideoFullscreen(media.id, 'enter');
    setFullscreenSession((session) => session + 1);
    setExpanded(true);
  };

  const closeFullscreen = () => {
    feedReturnStartedAt.current = performanceNow();
    recordVideoFullscreen(media.id, 'exit');
    setFeedCoverVisible(true);
    setExpanded(false);
  };

  const onFullscreenFirstFrame = () => {
    recordInitialFirstFrame();
    const startedAt = fullscreenStartedAt.current;
    if (startedAt === null) return;
    fullscreenStartedAt.current = null;
    recordVideoSurfaceFirstFrame(media.id, 'fullscreen', performanceNow() - startedAt);
  };

  // O primeiro quadro chega pelo VideoView do feed. Na volta da tela cheia, a
  // surface é remontada e a espera até este evento mede a transição de saída.
  const onFirstFrameRender = () => {
    recordInitialFirstFrame();
    const startedAt = feedReturnStartedAt.current;
    if (startedAt === null) return;
    feedReturnStartedAt.current = null;
    setFeedCoverVisible(false);
    recordVideoSurfaceFirstFrame(media.id, 'feed', performanceNow() - startedAt);
  };

  const frameRatio = { aspectRatio: mediaRatio(media) };
  const label = `Vídeo da publicação, ${durationLabel(media.durationMs)}`;
  const totalMs = player.duration > 0 ? player.duration * 1000 : (media.durationMs ?? 0);
  const countdown = totalMs > 0 ? remainingLabel(totalMs - position * 1000) : durationLabel(media.durationMs);
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, (position * 1000) / totalMs)) : 0;

  return <View style={[styles.videoFrame, framed && styles.framed, frameRatio]}>
    {poster ? <Image source={poster} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} /> : null}
    {status === 'loading' && !poster ? <View style={styles.skeleton} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <StripedPlaceholder label="Vídeo da publicação" showLabel={false} variant="dark" style={styles.skeletonFill} />
    </View> : null}
    {expanded ? null : <VideoView player={player} nativeControls={false} contentFit="cover" pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityLabel={label} onFirstFrameRender={onFirstFrameRender} />}
    {feedCoverVisible && poster ? (
      <Image
        testID="video-feed-transition-cover"
        source={poster}
        contentFit="cover"
        pointerEvents="none"
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
    ) : null}
    <Pressable
      onPress={() => {
        if (Date.now() - heldAt.current < 350) return;
        // Parado, o toque é "tocar": pausado retoma, encerrado repete. Só quem está
        // rodando abre a tela cheia — assim sair da tela cheia pausado continua natural.
        if (!player.playing) { toggle(); return; }
        openFullscreen();
      }}
      onLongPress={() => { haptic('light'); heldAt.current = Date.now(); setSpeed(2); }}
      delayLongPress={220}
      onPressOut={() => setSpeed(1)}
      accessibilityRole="button"
      accessibilityLabel={ended ? `${label}. Ver de novo` : playing ? `${label}. Abrir em tela cheia` : `${label}. Reproduzir`}
      accessibilityHint={playing ? 'Abre o vídeo com as ações da publicação' : undefined}
      style={styles.videoTap}>
      {!playing && !expanded && status !== 'loading' ? (
        <View style={styles.playBadge}><Icon name="play" size={26} color={Colors.paper} /></View>
      ) : null}
    </Pressable>
    {speed === 2 ? (
      <View style={styles.speed} pointerEvents="none">
        <AppText variant="label" color={Colors.paper}>2×</AppText>
      </View>
    ) : null}
    <View style={styles.duration} pointerEvents="none">
      <AppText style={styles.durationText} color={Colors.paper}>{countdown}</AppText>
    </View>
    {ended && !expanded ? (
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel="Ver de novo"
        style={styles.endedDim}>
        <View style={styles.replay}>
          <Icon name="replay" size={20} color={Colors.ink} />
          <AppText variant="button">Ver de novo</AppText>
        </View>
      </Pressable>
    ) : null}
    <View style={styles.controls}>
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityLabel="Progresso do vídeo"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Pressable
        onPress={() => setMuted(!muted)}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Ativar som' : 'Silenciar vídeo'}
        accessibilityState={{ selected: !muted }}
        style={({ pressed }) => [styles.sound, pressed && styles.soundPressed]}>
        <Icon name={muted ? 'soundOff' : 'soundOn'} size={20} color={Colors.paper} />
      </Pressable>
    </View>
    {status === 'error' ? <View style={[StyleSheet.absoluteFill, styles.error]}><AppText variant="caption">Não foi possível carregar o vídeo.</AppText></View> : null}
    <VideoViewer
      visible={expanded}
      surfaceKey={fullscreenSession}
      player={player}
      VideoView={VideoView}
      label={label}
      remaining={countdown}
      playing={playing}
      ended={ended}
      muted={muted}
      poster={poster}
      chrome={chrome ? { ...chrome, onComment: () => { closeFullscreen(); chrome.onComment(); } } : undefined}
      onSurfaceFirstFrame={onFullscreenFirstFrame}
      onClose={closeFullscreen}
      onTogglePlay={toggle}
      onToggleMute={() => setMuted(!muted)}
      onHoldStart={() => { haptic('light'); setSpeed(2); }}
      onHoldEnd={() => setSpeed(1)}
    />
  </View>;
}

const styles = StyleSheet.create({
  photoFrame: { width: '100%', minHeight: 180, maxHeight: 520, backgroundColor: Colors.ink, overflow: 'hidden' },
  framed: { borderRadius: 4, borderWidth: 2, borderColor: Colors.ink },
  skeleton: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  skeletonFill: { flex: 1, borderRadius: 0 },
  photoError: { alignItems: 'center', justifyContent: 'center', padding: Spacing.three, backgroundColor: Colors.straw },
  pressed: { opacity: 0.9 },
  videoFrame: { width: '100%', minHeight: 180, maxHeight: 520, backgroundColor: Colors.ink, overflow: 'hidden' },
  videoTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  error: { minHeight: 80, padding: Spacing.three, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.straw },
  duration: { position: 'absolute', right: 10, top: 10, backgroundColor: Colors.ink, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 4 },
  durationText: { fontFamily: Fonts.monoSemibold, fontSize: 12, lineHeight: 15, letterSpacing: 0.8 },
  speed: { position: 'absolute', left: 10, top: 10, backgroundColor: Colors.ink, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 4 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.ink,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.red,
  },
  sound: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.paper,
    borderRadius: 4,
  },
  soundPressed: { opacity: 0.6 },
  playBadge: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.red,
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  endedDim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,18,15,0.55)' },
  replay: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, backgroundColor: Colors.paper },
});
