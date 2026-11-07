import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, clamp, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';
import { haptic } from '@/lib/haptics';

import {
  clampPan,
  dismissTarget,
  dragBackdropOpacity,
  panLimit,
  pinchZoom,
  shouldDismiss,
  type ViewerGeometry,
} from './photo-viewer-geometry';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
// Assentar, duplo toque e descarte são transições automáticas: com movimento
// reduzido no sistema, o Reanimated aplica o valor final sem animar.
const SETTLE = { duration: 180, reduceMotion: ReduceMotion.System };
const DOUBLE_TAP_SETTLE = { duration: 220, reduceMotion: ReduceMotion.System };
const DISMISS_SETTLE = { duration: 220, reduceMotion: ReduceMotion.System };
/** Volta ao centro com mola: acompanha a velocidade da soltura sem travar. */
const RETURN_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
  reduceMotion: ReduceMotion.System,
};

/**
 * Foto em tela cheia sobre tinta, dentro da área útil (nunca sob o recorte),
 * com pincel para ampliar, arrasto para percorrer e toque duplo para alternar o zoom.
 * O chrome fica embaixo, sempre alcançável: é a saída garantida da tela.
 */
export function PhotoViewer({ uri, visible, onClose, width, height }: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  width?: number;
  height?: number;
}) {
  const insets = useSafeAreaInsets();
  const [fold, setFold] = useState<ViewerGeometry>({ viewportWidth: 0, viewportHeight: 0, fitWidth: 0, fitHeight: 0 });
  const geometry = useSharedValue<ViewerGeometry>({ viewportWidth: 0, viewportHeight: 0, fitWidth: 0, fitHeight: 0 });
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  // Foco dos dedos capturado no início da pinça, relativo à área útil.
  const pinchFocalX = useSharedValue(-1);
  const pinchFocalY = useSharedValue(-1);
  // Instante do último movimento (pinça ou arrasto): gesto de movimento nunca vira toque duplo.
  const lastMoveAt = useSharedValue(0);
  // O fechamento animado termina na UI thread e só então devolve o callback.
  const closing = useSharedValue(false);
  // Uma pinça no mesmo contato nunca pode ser confundida com arrasto de descarte.
  const pinchActive = useSharedValue(false);
  const pinchTouched = useSharedValue(false);
  // Só um arrasto que realmente deslocou a foto precisa de retorno ao centro.
  const dismissDragged = useSharedValue(false);

  const ratio = width && height ? width / height : 3 / 2;

  // Sair zera zoom e deslocamento: a próxima foto sempre abre inteira e o
  // backdrop volta opaco, sem herdar o estado do descarte anterior.
  const reset = () => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    scale.value = 1;
    translateX.value = 0; translateY.value = 0;
    baseX.value = 0; baseY.value = 0;
    pinchFocalX.value = -1; pinchFocalY.value = -1;
    pinchActive.value = false;
    pinchTouched.value = false;
    dismissDragged.value = false;
    closing.value = false;
  };

  const finishDismiss = () => {
    // O callback é a conclusão do fluxo: o backdrop já está transparente e a
    // foto saiu da área útil. A limpeza acontece na próxima abertura.
    onClose();
  };

  const requestClose = () => {
    // Fechar pelo botão/back cancela uma animação em voo para o callback de
    // descarte não fechar a tela duas vezes e não deixa o gesto bloqueado.
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    closing.value = false;
    onClose();
  };

  const measure = (next: ViewerGeometry) => {
    geometry.value = next;
    setFold((previous) => (
      previous.viewportWidth === next.viewportWidth
      && previous.viewportHeight === next.viewportHeight
      && previous.fitWidth === next.fitWidth
      && previous.fitHeight === next.fitHeight
        ? previous
        : next
    ));
  };

  const onLayout = (layoutWidth: number, layoutHeight: number) => {
    if (layoutWidth <= 0 || layoutHeight <= 0) return;
    const viewportRatio = layoutWidth / layoutHeight;
    const fitWidth = ratio > viewportRatio ? layoutWidth : layoutHeight * ratio;
    const fitHeight = fitWidth / ratio;
    measure({ viewportWidth: layoutWidth, viewportHeight: layoutHeight, fitWidth, fitHeight });
    // Girar o aparelho muda a área útil e pode encolher o limite: recoloca a
    // imagem dentro das bordas sem animar junto com a rotação.
    const nextX = clampPan(translateX.value, scale.value, fitWidth, layoutWidth);
    const nextY = clampPan(translateY.value, scale.value, fitHeight, layoutHeight);
    if (nextX !== translateX.value || nextY !== translateY.value) {
      translateX.value = nextX; translateY.value = nextY;
      baseX.value = nextX; baseY.value = nextY;
    }
  };

  const pinch = usePinchGesture({
    // O zoom parte do valor que está na tela e anda com o delta de cada evento
    // (`scaleChange`). Antes, uma base fixa multiplicada pelo `scale` acumulado do
    // gesto fazia o recolhimento rápido "bater" no mínimo e voltar.
    onBegin: () => {
      'worklet';
      // Zera o foco: se a plataforma não entregar o ponto no `onActivate`, a
      // pinça cai no centro em vez de reaproveitar o foco do gesto anterior.
      pinchFocalX.value = -1;
      pinchFocalY.value = -1;
      pinchActive.value = true;
      pinchTouched.value = true;
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    },
    // O foco é o ponto entre os dedos no começo da pinça. Ele fica parado na
    // tela; a translação compensa cada mudança de escala em volta dele.
    onActivate: (event) => {
      'worklet';
      pinchActive.value = true;
      pinchTouched.value = true;
      pinchFocalX.value = event.focalX;
      pinchFocalY.value = event.focalY;
    },
    onUpdate: (event) => {
      'worklet';
      lastMoveAt.value = Date.now();
      const view = geometry.value;
      const focalX = pinchFocalX.value >= 0 ? pinchFocalX.value : view.viewportWidth / 2;
      const focalY = pinchFocalY.value >= 0 ? pinchFocalY.value : view.viewportHeight / 2;
      const next = pinchZoom(
        scale.value,
        translateX.value,
        translateY.value,
        focalX,
        focalY,
        event.scaleChange,
        view,
        MAX_ZOOM,
      );
      scale.value = next.scale;
      translateX.value = next.translateX;
      translateY.value = next.translateY;
    },
    onDeactivate: () => {
      'worklet';
      lastMoveAt.value = Date.now();
      pinchActive.value = false;
      // Sempre assenta: abaixo do mínimo volta a 1, acima mantém o quadro dentro dos limites.
      if (scale.value <= 1.02) {
        scale.value = withTiming(1, SETTLE);
        translateX.value = withTiming(0, SETTLE);
        translateY.value = withTiming(0, SETTLE);
        baseX.value = 0; baseY.value = 0;
      } else {
        const view = geometry.value;
        const nextX = clampPan(translateX.value, scale.value, view.fitWidth, view.viewportWidth);
        const nextY = clampPan(translateY.value, scale.value, view.fitHeight, view.viewportHeight);
        translateX.value = withTiming(nextX, SETTLE);
        translateY.value = withTiming(nextY, SETTLE);
        baseX.value = nextX; baseY.value = nextY;
      }
    },
    onFinalize: () => {
      'worklet';
      // `onDeactivate` não dispara quando a pinça é cancelada; soltar a flag
      // evita bloquear o próximo arrasto.
      pinchActive.value = false;
    },
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onBegin: () => {
      'worklet';
      if (closing.value) return;
      // Um arrasto novo começa limpo. Se uma pinça ainda está ativa, preserva a
      // marca para este contato não virar descarte ao soltar.
      if (!pinchActive.value) pinchTouched.value = false;
      dismissDragged.value = false;
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      baseX.value = translateX.value;
      baseY.value = translateY.value;
      lastMoveAt.value = Date.now();
    },
    onUpdate: (event) => {
      'worklet';
      if (closing.value || pinchActive.value || pinchTouched.value) return;
      lastMoveAt.value = Date.now();
      const view = geometry.value;
      if (scale.value <= 1.02) {
        // Sem zoom, a foto acompanha o dedo: arrastar é o gesto de descartar.
        dismissDragged.value = true;
        translateX.value = event.translationX * 0.5;
        translateY.value = event.translationY;
        return;
      }
      const limitX = panLimit(scale.value, view.fitWidth, view.viewportWidth);
      const limitY = panLimit(scale.value, view.fitHeight, view.viewportHeight);
      translateX.value = clamp(baseX.value + event.translationX, -limitX, limitX);
      translateY.value = clamp(baseY.value + event.translationY, -limitY, limitY);
    },
    onDeactivate: (event) => {
      'worklet';
      if (closing.value) return;
      lastMoveAt.value = Date.now();
      // A pinça é dona do enquadramento: mesmo que ela volte a 1×, soltar o
      // segundo dedo não pode ser lido como arrasto de descarte.
      if (pinchActive.value || pinchTouched.value) return;
      if (scale.value > 1.02) {
        baseX.value = translateX.value; baseY.value = translateY.value;
        return;
      }
      if (shouldDismiss(translateY.value, event.velocityY)) {
        closing.value = true;
        const target = dismissTarget(translateY.value, geometry.value.viewportHeight);
        translateY.value = withTiming(target, DISMISS_SETTLE, (finished) => {
          'worklet';
          if (!finished) {
            // Outro fechamento/abertura cancelou a animação: libera o gesto sem
            // chamar o callback de um descarte que não terminou.
            closing.value = false;
            return;
          }
          runOnJS(finishDismiss)();
        });
        return;
      }
      translateX.value = withSpring(0, RETURN_SPRING);
      translateY.value = withSpring(0, { ...RETURN_SPRING, velocity: event.velocityY });
      baseX.value = 0; baseY.value = 0;
      dismissDragged.value = false;
    },
    onFinalize: (event) => {
      'worklet';
      if (!event.canceled || !dismissDragged.value || closing.value || pinchActive.value || pinchTouched.value) return;
      // Gesture cancelado (ex.: perdeu a disputa para outro handler) não pode
      // deixar a foto parada no meio do arrasto.
      if (scale.value <= 1.02) {
        translateX.value = withSpring(0, RETURN_SPRING);
        translateY.value = withSpring(0, RETURN_SPRING);
        baseX.value = 0; baseY.value = 0;
        dismissDragged.value = false;
      }
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 280,
    onDeactivate: (event) => {
      'worklet';
      if (closing.value) return;
      // Puxar forte na beirada solta e recoloca o dedo rápido: se houve movimento agora,
      // esses dois contatos não são um toque duplo.
      if (Date.now() - lastMoveAt.value < 450) return;
      // O zoom assenta num nível inteiro (1× ou 2,5×): um tique de seleção confirma o snap.
      runOnJS(haptic)('selection');
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      const view = geometry.value;
      const next = scale.value > 1 ? 1 : DOUBLE_TAP_ZOOM;
      const limitX = panLimit(next, view.fitWidth, view.viewportWidth);
      const limitY = panLimit(next, view.fitHeight, view.viewportHeight);
      const targetX = next === 1 ? 0 : clamp(-(next - 1) * (event.x - view.viewportWidth / 2), -limitX, limitX);
      const targetY = next === 1 ? 0 : clamp(-(next - 1) * (event.y - view.viewportHeight / 2), -limitY, limitY);
      scale.value = withTiming(next, DOUBLE_TAP_SETTLE);
      translateX.value = withTiming(targetX, DOUBLE_TAP_SETTLE);
      translateY.value = withTiming(targetY, DOUBLE_TAP_SETTLE);
      baseX.value = targetX; baseY.value = targetY;
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const zoomed = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }] }));
  // O fundo e o chrome somem juntos enquanto a foto acompanha o dedo. O
  // backdrop transparente revela o feed por baixo sem desmontar o Modal.
  const overlay = useAnimatedStyle(() => ({ opacity: dragBackdropOpacity(translateY.value, scale.value) }));

  return <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={requestClose} onShow={reset} testID="photo-viewer-modal">
    <GestureHandlerRootView style={styles.root}>
      <ResetOnOpen onOpen={reset} />
      <StatusBar hidden />
      <Animated.View testID="photo-viewer-backdrop" pointerEvents="none" style={[styles.backdrop, overlay]} />
      <View style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <View
          style={styles.viewport}
          collapsable={false}
          testID="photo-viewer-viewport"
          onLayout={(event) => onLayout(event.nativeEvent.layout.width, event.nativeEvent.layout.height)}>
          <GestureDetector gesture={gesture}>
            <View style={styles.fill} collapsable={false}>
              {fold.fitWidth > 0 && uri ? <Animated.View style={[styles.fit, { width: fold.fitWidth, height: fold.fitHeight }, zoomed]}>
                <Image
                  source={{ uri }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={120}
                  accessibilityLabel="Foto da publicação"
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View> : null}
            </View>
          </GestureDetector>
        </View>
        <Animated.View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.four) }, overlay]}>
          <AppText variant="label" color={Colors.paper}>Foto</AppText>
          <Pressable
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar foto"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <AppText variant="label" color={Colors.paper}>Fechar</AppText>
            <Icon name="close" size={18} color={Colors.paper} />
          </Pressable>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  </Modal>;
}

/**
 * O estado do gesto vive no PhotoViewer, que continua montado entre aberturas.
 * O Modal desmonta os filhos ao fechar; ao remontar, este marcador limpa zoom,
 * deslocamento e flags no mesmo commit, antes de a foto reaparecer.
 */
function ResetOnOpen({ onOpen }: { onOpen: () => void }) {
  const open = useRef(onOpen);
  useLayoutEffect(() => {
    open.current();
  }, []);
  return null;
}

const styles = StyleSheet.create({
  // O Modal é transparente: quem pinta a tela é o backdrop animado, que some
  // junto com o arrasto e deixa o feed aparecer por baixo.
  root: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: Colors.ink, opacity: 1 },
  screen: { flex: 1 },
  viewport: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fit: { backgroundColor: Colors.ink },
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.inkRule,
  },
  close: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    marginRight: -Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
