import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import type { VideoPlayer, VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Kicker } from '@/components/kicker';
import { SocialAction } from '@/components/social-action';
import { Motion } from '@/constants/motion';
import { Colors, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { FeedItem } from '@/types/models';

import { VIDEO_SURFACE_COVER_TIMEOUT_MS } from './video-surface';

/** O que a tela cheia mostra do post: autoria, contexto e as ações. */
export type VideoChrome = {
  author: FeedItem['author'];
  comuna: FeedItem['comuna'];
  text: string;
  supportCount: number;
  supported: boolean;
  onSupport: () => void;
  commentCount: number;
  onComment: () => void;
  echoCount: number;
  echoed: boolean;
  onEcho: () => void;
  saved: boolean;
  onSave: () => void;
};

type VideoViewerProps = {
  visible: boolean;
  /** Muda só na abertura: reinicia a cobertura sem remontar a surface no fechamento. */
  surfaceKey: number;
  player: VideoPlayer;
  VideoView: typeof import('expo-video').VideoView;
  label: string;
  remaining: string;
  playing: boolean;
  ended: boolean;
  muted: boolean;
  /** Primeiro quadro já conhecido: cobre a nova surface até ela receber o quadro atual. */
  poster?: VideoThumbnail | null;
  chrome?: VideoChrome;
  onSurfaceFirstFrame?: () => void;
  onClose: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
};

const DISMISS_DISTANCE = 120;

/** Volta ao centro depois de soltar o dedo: transição automática, não o arrasto. */
export const VIDEO_VIEWER_RETURN_TIMING = {
  duration: 180,
  reduceMotion: ReduceMotion.System,
} as const;

/**
 * Vídeo em tela cheia: o quadro ocupa toda a área útil e o chrome flutua por cima —
 * topo com tempo e controles, base com autoria e as ações do post na coluna da direita.
 * O player é o mesmo da célula, então a reprodução continua de onde estava.
 * Arrastar para baixo devolve ao feed.
 */
export function VideoViewer({
  visible, surfaceKey, player, VideoView, label, remaining, playing, ended, muted, poster, chrome,
  onSurfaceFirstFrame, onClose, onTogglePlay, onToggleMute, onHoldStart, onHoldEnd,
}: VideoViewerProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const dragY = useSharedValue(0);
  const close = () => {
    dragY.value = 0;
    onClose();
  };
  const pan = usePanGesture({
    onUpdate: (event) => { 'worklet'; dragY.value = Math.max(0, event.translationY); },
    onDeactivate: (event) => {
      'worklet';
      if (dragY.value > DISMISS_DISTANCE || event.velocityY > 900) {
        runOnJS(close)();
        return;
      }
      dragY.value = withTiming(0, VIDEO_VIEWER_RETURN_TIMING);
    },
  });
  const drag = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  return <Modal testID="video-viewer-modal" visible={visible} animationType={reducedMotion ? 'none' : 'fade'} statusBarTranslucent onRequestClose={close}>
    <GestureHandlerRootView
      testID="video-viewer-root"
      style={styles.root}
      accessibilityViewIsModal
      onAccessibilityEscape={close}>
      <StatusBar hidden />
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.screen, drag]}>
          <View style={[styles.stage, { top: insets.top, bottom: Math.max(insets.bottom, Spacing.two) }]} pointerEvents="none">
            <FullscreenSurface
              key={surfaceKey}
              player={player}
              VideoView={VideoView}
              label={label}
              poster={poster}
              onFirstFrameRender={onSurfaceFirstFrame}
            />
          </View>

          <Pressable
            onPress={onTogglePlay}
            onLongPress={onHoldStart}
            delayLongPress={220}
            onPressOut={onHoldEnd}
            accessibilityRole="button"
            accessibilityLabel={ended ? `${label}. Ver de novo` : playing ? `${label}. Pausar` : `${label}. Reproduzir`}
            style={styles.tap}>
            {ended ? (
              <View style={styles.replay}>
                <Icon name="replay" size={20} color={Colors.ink} />
                <AppText variant="button">Ver de novo</AppText>
              </View>
            ) : !playing ? <Icon name="play" size={56} color={Colors.paper} /> : null}
          </Pressable>

          <View style={[styles.top, { top: insets.top }]}>
            <View style={styles.counter}><AppText variant="label" color={Colors.paper}>{remaining}</AppText></View>
            <View style={styles.topActions}>
              <Pressable
                onPress={onToggleMute}
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Ativar som' : 'Silenciar vídeo'}
                accessibilityState={{ selected: !muted }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
                <Icon name={muted ? 'soundOff' : 'soundOn'} size={20} color={Colors.paper} />
              </Pressable>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Fechar vídeo"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
                <Icon name="close" size={20} color={Colors.paper} />
              </Pressable>
            </View>
          </View>

          {chrome ? (
            <View style={[styles.bottom, { bottom: Math.max(insets.bottom, Spacing.two) }]}>
              <View style={styles.info}>
                {chrome.comuna ? <Kicker label={`c/ ${chrome.comuna.name}`} color={Colors.red} /> : null}
                <View style={styles.author}>
                  <Avatar initials={chrome.author.initials} tone={chrome.author.tone} size={36} shape="square" outline font="anton" userId={chrome.author.id} imageUrl={chrome.author.avatarUrl} />
                  <View style={styles.identity}>
                    <AppText variant="bodyStrong" color={Colors.paper} numberOfLines={1}>{chrome.author.name}</AppText>
                    <AppText variant="caption" color={Colors.onInkSoft} numberOfLines={1}>@{chrome.author.handle}</AppText>
                  </View>
                </View>
                <AppText style={styles.text} color={Colors.onInkSoft} numberOfLines={3}>{chrome.text}</AppText>
              </View>
              <View style={styles.rail}>
                <SocialAction variant="rail" icon="support" count={chrome.supportCount} label="Apoiar" active={chrome.supported} onPress={chrome.onSupport} />
                <SocialAction variant="rail" icon="comment" count={chrome.commentCount} label="Comentar" onPress={chrome.onComment} />
                <SocialAction variant="rail" icon="echo" count={chrome.echoCount} label="Ecoar" active={chrome.echoed} onPress={chrome.onEcho} />
                {/* Salvar mantém o tique no handler compartilhado, usado também fora do rail. */}
                <SocialAction variant="rail" icon="bookmark" label={chrome.saved ? 'Remover dos salvos' : 'Salvar'} active={chrome.saved} filled hapticFeedback={null} showCount={false} onPress={chrome.onSave} />
              </View>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  </Modal>;
}

/**
 * A nova surface pode ficar preta por alguns frames ao receber o player.
 * O pôster cobre exatamente essa janela e some no primeiro quadro. A chave de
 * abertura reinicia a cobertura sem setState síncrono em efeito; o limite evita
 * que ela fique presa quando a plataforma não emite `onFirstFrameRender` na
 * remontagem.
 */
function FullscreenSurface({ player, VideoView, label, poster, onFirstFrameRender }: {
  player: VideoPlayer;
  VideoView: typeof import('expo-video').VideoView;
  label: string;
  poster?: VideoThumbnail | null;
  onFirstFrameRender?: () => void;
}) {
  const [coverVisible, setCoverVisible] = useState(true);

  useEffect(() => {
    if (!coverVisible) return;
    const timer = setTimeout(() => setCoverVisible(false), VIDEO_SURFACE_COVER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [coverVisible]);

  return <>
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="contain"
      style={StyleSheet.absoluteFill}
      accessibilityLabel={label}
      onFirstFrameRender={() => {
        setCoverVisible(false);
        onFirstFrameRender?.();
      }}
    />
    {coverVisible && poster ? (
      <Image
        testID="video-fullscreen-cover"
        source={poster}
        contentFit="contain"
        pointerEvents="none"
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
    ) : null}
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ink },
  screen: { flex: 1, backgroundColor: Colors.ink },
  // O vídeo ocupa a área útil inteira; o chrome flutua por cima, sem empurrar o quadro.
  stage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: Spacing.five, paddingRight: Spacing.three },
  counter: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 5 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  round: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  replay: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, backgroundColor: Colors.paper },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three, paddingHorizontal: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.one, backgroundColor: 'rgba(22,18,15,0.72)' },
  info: { flex: 1, minWidth: 0, gap: Spacing.two },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  identity: { flex: 1, minWidth: 0 },
  text: { fontSize: 14.5, lineHeight: 20 },
  rail: { width: 52, alignItems: 'center', gap: Spacing.three },
  railAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  railContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { opacity: Motion.feedback.pressed.opacity },
});
