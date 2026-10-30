import type { SharedRefType } from 'expo';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import type { VideoPlayer, VideoThumbnail } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { StripedPlaceholder } from '@/components/striped-placeholder';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { durationLabel, type PostMediaDto } from '@/features/posts/post-media';

import { PhotoViewer } from './photo-viewer';

/* O player do expo-video é um objeto imperativo: `muted`, `playbackRate` e `currentTime` são
   propriedades nativas, mudadas fora do estado do React de propósito. A análise de imutabilidade
   do React Compiler não se aplica a ele. */
/* eslint-disable react-hooks/immutability */

let activePlayer: VideoPlayer | null = null;
/** Som é preferência da sessão, como nos apps de vídeo: vale para o próximo vídeo também. */
let soundEnabled = false;
/** Primeiro quadro já gerado, por mídia: volta na hora quando o vídeo sai e entra da tela. */
const posterCache = new Map<string, VideoThumbnail>();

function mediaRatio(media: Pick<PostMediaDto, 'width' | 'height'>) {
  return Math.max(0.8, Math.min(16 / 9, media.width / media.height || 16 / 10));
}

export function PostAttachment({ media, localUri, visible = true }: {
  media: PostMediaDto;
  localUri?: string;
  visible?: boolean;
  /** Mantido por compatibilidade: sem controles nativos, o vídeo não precisa bloquear gestos. */
  blockGesture?: PanGesture | null;
}) {
  const uri = localUri ?? media.url;
  if (!uri) return <View style={styles.error}><AppText variant="caption">Mídia indisponível.</AppText></View>;
  if (media.type === 'video') return visible
    ? <PostVideo key={uri} media={media} uri={uri} />
    : <VideoPoster media={media} />;
  return <PostPhoto key={uri} media={media} uri={uri} />;
}

/**
 * Foto do feed: quadro próprio com corte deliberado e tela cheia ao tocar.
 * Enquanto carrega, mostra a listra da casa; o corte nunca deixa faixa morta.
 */
function PostPhoto({ media, uri }: { media: PostMediaDto; uri: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [open, setOpen] = useState(false);
  return <>
    <Pressable
      onPress={() => setOpen(true)}
      accessibilityRole="button"
      accessibilityLabel="Abrir foto em tela cheia"
      style={({ pressed }) => [styles.photoFrame, { aspectRatio: mediaRatio(media) }, pressed && styles.pressed]}>
      {status === 'loading' ? <View style={styles.skeleton} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <StripedPlaceholder label="Foto da publicação" showLabel={false} style={styles.skeletonFill} />
      </View> : null}
      <Image
        source={{ uri }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={media.id}
        transition={180}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
      {status === 'error' ? <View style={[StyleSheet.absoluteFill, styles.photoError]}><AppText variant="caption">Não foi possível carregar a imagem.</AppText></View> : null}
    </Pressable>
    <PhotoViewer uri={uri} visible={open} onClose={() => setOpen(false)} width={media.width} height={media.height} />
  </>;
}

/** Fora da tela o vídeo não carrega: fica o primeiro quadro já gerado, ou a listra escura. */
function VideoPoster({ media }: { media: PostMediaDto }) {
  const poster = posterCache.get(media.id) ?? null;
  return <View style={[styles.videoFrame, { aspectRatio: mediaRatio(media) }]}>
    {poster
      ? <Image source={poster} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} />
      : <StripedPlaceholder label="Vídeo da publicação" showLabel={false} style={styles.skeletonFill} />}
    <View style={styles.duration}><AppText variant="label" color={Colors.paper}>{durationLabel(media.durationMs)}</AppText></View>
  </View>;
}

function PostVideo({ media, uri }: { media: PostMediaDto; uri: string }) {
  let videoModule: typeof import('expo-video');
  try {
    // Evita derrubar a inicialização em development builds feitos antes da inclusão do módulo nativo.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    videoModule = require('expo-video') as typeof import('expo-video');
  } catch {
    return <View style={styles.error}><AppText variant="caption">Atualize o app para reproduzir este vídeo.</AppText></View>;
  }
  return <LoadedPostVideo media={media} uri={uri} videoModule={videoModule} />;
}

function LoadedPostVideo({ media, uri, videoModule }: { media: PostMediaDto; uri: string; videoModule: typeof import('expo-video') }) {
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
  const [poster, setPoster] = useState<SharedRefType<'image'> | null>(() => posterCache.get(media.id) ?? null);
  // Um toque que veio de um "segurar para acelerar" não deve pausar o vídeo.
  const heldAt = useRef(0);

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    setPlaying(isPlaying);
    if (!isPlaying) return;
    setEnded(false);
    if (activePlayer && activePlayer !== player) activePlayer.pause();
    activePlayer = player;
  });

  useEventListener(player, 'playToEnd', () => {
    setEnded(true);
    setPlaying(false);
  });

  useEffect(() => {
    player.muted = muted;
    if (muted) { soundEnabled = false; } else { soundEnabled = true; }
  }, [muted, player]);

  useEffect(() => { player.playbackRate = speed; }, [player, speed]);

  useEffect(() => {
    if (activePlayer && activePlayer !== player) activePlayer.pause();
    activePlayer = player;
    // `currentState` começa nulo antes das constantes nativas: só não toca em segundo plano.
    if (AppState.currentState !== 'background') player.play();
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
  useEffect(() => {
    if (posterCache.has(media.id)) return;
    let alive = true;
    void player.generateThumbnailsAsync(0).then(([thumbnail]) => {
      if (!thumbnail) return;
      posterCache.set(media.id, thumbnail);
      if (alive) setPoster(thumbnail);
    }, () => undefined);
    return () => { alive = false; };
  }, [media.id, player]);

  const toggle = () => {
    if (ended) {
      setEnded(false);
      player.currentTime = 0;
      player.play();
      return;
    }
    if (player.playing) player.pause(); else player.play();
  };

  const frameRatio = { aspectRatio: mediaRatio(media) };
  const label = `Vídeo da publicação, ${durationLabel(media.durationMs)}`;

  return <View style={[styles.videoFrame, frameRatio]}>
    {poster ? <Image source={poster} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} /> : null}
    {status === 'loading' && !poster ? <View style={styles.skeleton} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <StripedPlaceholder label="Vídeo da publicação" showLabel={false} variant="dark" style={styles.skeletonFill} />
    </View> : null}
    <VideoView player={player} nativeControls={false} contentFit="cover" pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityLabel={label} />
    <Pressable
      onPress={() => { if (Date.now() - heldAt.current < 350) return; toggle(); }}
      onLongPress={() => { heldAt.current = Date.now(); setSpeed(2); }}
      delayLongPress={220}
      onPressOut={() => setSpeed(1)}
      accessibilityRole="button"
      accessibilityLabel={ended ? `${label}. Ver de novo` : playing ? `${label}. Pausar` : `${label}. Reproduzir`}
      style={styles.videoTap}>
      {ended ? (
        <View style={styles.endedDim}>
          <View style={styles.replay}>
            <Icon name="replay" size={20} color={Colors.ink} />
            <AppText variant="button">Ver de novo</AppText>
          </View>
        </View>
      ) : !playing && status !== 'loading' ? (
        <Icon name="play" size={44} color={Colors.paper} />
      ) : null}
    </Pressable>
    {speed === 2 ? (
      <View style={styles.speed} pointerEvents="none">
        <AppText variant="label" color={Colors.paper}>2×</AppText>
      </View>
    ) : null}
    <View style={styles.duration} pointerEvents="none">
      <AppText variant="label" color={Colors.paper}>{durationLabel(media.durationMs)}</AppText>
    </View>
    <Pressable
      onPress={() => setMuted(!muted)}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Ativar som' : 'Silenciar vídeo'}
      accessibilityState={{ selected: !muted }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={({ pressed }) => [styles.sound, pressed && styles.soundPressed]}>
      <Icon name={muted ? 'soundOff' : 'soundOn'} size={20} color={Colors.paper} />
    </Pressable>
    {status === 'error' ? <View style={[StyleSheet.absoluteFill, styles.error]}><AppText variant="caption">Não foi possível carregar o vídeo.</AppText></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  photoFrame: { width: '100%', minHeight: 180, maxHeight: 520, backgroundColor: Colors.ink, overflow: 'hidden' },
  skeleton: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  skeletonFill: { flex: 1, borderRadius: 0 },
  photoError: { alignItems: 'center', justifyContent: 'center', padding: Spacing.three, backgroundColor: Colors.straw },
  pressed: { opacity: 0.9 },
  videoFrame: { width: '100%', minHeight: 180, maxHeight: 520, backgroundColor: Colors.ink, overflow: 'hidden' },
  videoTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  error: { minHeight: 80, padding: Spacing.three, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.straw },
  duration: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 7, paddingVertical: 4 },
  speed: { position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 7, paddingVertical: 4 },
  sound: { position: 'absolute', right: 10, bottom: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)' },
  soundPressed: { opacity: 0.6 },
  endedDim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,18,15,0.55)' },
  replay: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Radius.sm, backgroundColor: Colors.paper },
});
