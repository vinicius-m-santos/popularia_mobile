import { useFocusEffect } from 'expo-router';
import { Icon } from '@/components/icon';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, useNativeGesture, type PanGesture } from 'react-native-gesture-handler';

import { AppText } from '@/components/app-text';
import { Colors, Spacing } from '@/constants/theme';
import { durationLabel, type PostMediaDto } from '@/features/posts/post-media';

let activePlayer: VideoPlayer | null = null;

function mediaRatio(media: Pick<PostMediaDto, 'width' | 'height'>) {
  return Math.max(0.8, Math.min(16 / 9, media.width / media.height || 16 / 10));
}

export function PostAttachment({ media, localUri, visible = true, blockGesture }: { media: PostMediaDto; localUri?: string; visible?: boolean; blockGesture?: PanGesture | null }) {
  const [requestedUri, setRequestedUri] = useState<string | null>(null);
  const uri = localUri ?? media.url;
  useFocusEffect(useCallback(() => () => setRequestedUri(null), []));
  // A intenção vale só para esta mídia enquanto permanece visível.
  if (requestedUri && (!visible || requestedUri !== uri)) setRequestedUri(null);
  if (!uri) return <View style={styles.error}><AppText variant="caption">Mídia indisponível.</AppText></View>;
  if (media.type === 'video') return visible && requestedUri === uri ? <PostVideo key={uri} media={media} uri={uri} blockGesture={blockGesture} /> : (
    <Pressable onPress={() => setRequestedUri(uri)} accessibilityRole="button" accessibilityLabel={`Reproduzir vídeo, ${durationLabel(media.durationMs)}`} style={[styles.videoFrame, styles.preview, { aspectRatio: mediaRatio(media) }]}>
      <Icon name="play" size={40} color={Colors.paper} />
      <View style={styles.duration}><AppText variant="label" color={Colors.paper}>{durationLabel(media.durationMs)}</AppText></View>
    </Pressable>
  );
  return <PostImage key={uri} media={media} uri={uri} />;
}

function PostImage({ media, uri }: { media: PostMediaDto; uri: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return <View style={[styles.visual, { aspectRatio: mediaRatio(media) }]}>
    <Image source={{ uri }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={media.id} transition={150} accessibilityLabel="Imagem da publicação" onLoad={() => setStatus('ready')} onError={() => setStatus('error')} style={StyleSheet.absoluteFill} />
    {status === 'loading' ? <ActivityIndicator color={Colors.red} style={styles.center} /> : null}
    {status === 'error' ? <View style={[StyleSheet.absoluteFill, styles.error]}><AppText variant="caption">Não foi possível carregar a imagem.</AppText></View> : null}
  </View>;
}

function PostVideo({ media, uri, blockGesture }: { media: PostMediaDto; uri: string; blockGesture?: PanGesture | null }) {
  let videoModule: typeof import('expo-video');
  try {
    // Evita derrubar a inicialização em development builds feitos antes da inclusão do módulo nativo.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    videoModule = require('expo-video') as typeof import('expo-video');
  } catch {
    return <View style={styles.error}><AppText variant="caption">Atualize o app para reproduzir este vídeo.</AppText></View>;
  }
  return <LoadedPostVideo media={media} uri={uri} videoModule={videoModule} blockGesture={blockGesture} />;
}

function LoadedPostVideo({ media, uri, videoModule, blockGesture }: { media: PostMediaDto; uri: string; videoModule: typeof import('expo-video'); blockGesture?: PanGesture | null }) {
  const useVideoPlayer = videoModule.useVideoPlayer;
  const VideoView = videoModule.VideoView;
  const player = useVideoPlayer({ uri, useCaching: false });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (!isPlaying) return;
    if (activePlayer && activePlayer !== player) activePlayer.pause();
    activePlayer = player;
  });
  useEffect(() => {
    // A reprodução inicial pode emitir playingChange antes da inscrição do listener.
    if (activePlayer && activePlayer !== player) activePlayer.pause();
    activePlayer = player;
    if (AppState.currentState === 'active') player.play();
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => {
      listener.remove();
      if (activePlayer === player) activePlayer = null;
      // useVideoPlayer libera o player no unmount.
    };
  }, [player]);
  const video = <VideoView player={player} nativeControls contentFit="contain" style={StyleSheet.absoluteFill} accessibilityLabel={`Vídeo da publicação, ${durationLabel(media.durationMs)}`} />;
  return <View style={[styles.videoFrame, { aspectRatio: mediaRatio(media) }]}>
    {blockGesture ? <NativeMediaGesture blockGesture={blockGesture}>{video}</NativeMediaGesture> : video}
    {status === 'loading' ? <ActivityIndicator color={Colors.red} style={styles.center} /> : null}
    {status === 'error' ? <View style={[styles.center, styles.error]}><AppText variant="caption">Não foi possível carregar o vídeo.</AppText></View> : null}
    <View style={styles.duration}><AppText variant="label" color={Colors.paper}>{durationLabel(media.durationMs)}</AppText></View>
  </View>;
}

function NativeMediaGesture({ blockGesture, children }: { blockGesture: PanGesture; children: ReactElement }) {
  const gesture = useNativeGesture({ block: blockGesture });
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', justifyContent: 'center' },
  visual: { width: '100%', minHeight: 180, maxHeight: 520, backgroundColor: Colors.inkSoft },
  videoFrame: { width: '100%', minHeight: 180, maxHeight: 520, backgroundColor: Colors.ink, overflow: 'hidden' },
  center: { position: 'absolute', alignSelf: 'center', top: '45%' },
  error: { minHeight: 80, padding: Spacing.three, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.straw },
  duration: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 7, paddingVertical: 4 },
});
