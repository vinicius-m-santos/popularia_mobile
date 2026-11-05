import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, clamp, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';

import { clampPan, panLimit, pinchZoom, type ViewerGeometry } from './photo-viewer-geometry';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
/** Distância e velocidade a partir das quais arrastar sem zoom descarta a foto. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;
// Assentar e duplo toque são transições automáticas: com movimento reduzido no
// sistema, o Reanimated aplica o valor final sem animar.
const SETTLE = { duration: 180, reduceMotion: ReduceMotion.System };
const DOUBLE_TAP_SETTLE = { duration: 220, reduceMotion: ReduceMotion.System };

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

  const ratio = width && height ? width / height : 3 / 2;

  // Sair zera o zoom: a próxima foto sempre abre inteira.
  const close = () => {
    scale.value = 1;
    translateX.value = 0; translateY.value = 0;
    baseX.value = 0; baseY.value = 0;
    pinchFocalX.value = -1; pinchFocalY.value = -1;
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
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    },
    // O foco é o ponto entre os dedos no começo da pinça. Ele fica parado na
    // tela; a translação compensa cada mudança de escala em volta dele.
    onActivate: (event) => {
      'worklet';
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
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onBegin: () => { 'worklet'; baseX.value = translateX.value; baseY.value = translateY.value; },
    onUpdate: (event) => {
      'worklet';
      lastMoveAt.value = Date.now();
      const view = geometry.value;
      if (scale.value <= 1.02) {
        // Sem zoom, a foto acompanha o dedo: arrastar é o gesto de descartar.
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
      lastMoveAt.value = Date.now();
      if (scale.value > 1.02) {
        baseX.value = translateX.value; baseY.value = translateY.value;
        return;
      }
      const pulled = Math.abs(translateY.value);
      const flung = pulled > 48 && Math.abs(event.velocityY) > DISMISS_VELOCITY;
      if (pulled > DISMISS_DISTANCE || flung) {
        runOnJS(close)();
        return;
      }
      translateX.value = withTiming(0, SETTLE);
      translateY.value = withTiming(0, SETTLE);
      baseX.value = 0; baseY.value = 0;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 280,
    onDeactivate: (event) => {
      'worklet';
      // Puxar forte na beirada solta e recoloca o dedo rápido: se houve movimento agora,
      // esses dois contatos não são um toque duplo.
      if (Date.now() - lastMoveAt.value < 450) return;
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

  return <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={close}>
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
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
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
          <AppText variant="label" color={Colors.paper}>Foto</AppText>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Fechar foto"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <AppText variant="label" color={Colors.paper}>Fechar</AppText>
            <Icon name="close" size={18} color={Colors.paper} />
          </Pressable>
        </View>
      </View>
    </GestureHandlerRootView>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ink },
  screen: { flex: 1, backgroundColor: Colors.ink },
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
