import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, clamp, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
/** Distância e velocidade a partir das quais arrastar sem zoom descarta a foto. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

type Fold = { viewportWidth: number; viewportHeight: number; fitWidth: number; fitHeight: number };

/** Limite de deslocamento para a imagem já ampliada não sair do quadro. */
function panLimit(scale: number, fit: number, viewport: number): number {
  'worklet';
  return Math.max(0, (fit * scale - viewport) / 2);
}

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
  const [fold, setFold] = useState<Fold>({ viewportWidth: 0, viewportHeight: 0, fitWidth: 0, fitHeight: 0 });
  const geometry = useSharedValue<Fold>({ viewportWidth: 0, viewportHeight: 0, fitWidth: 0, fitHeight: 0 });
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  // Instante do último movimento (pinça ou arrasto): gesto de movimento nunca vira toque duplo.
  const lastMoveAt = useSharedValue(0);

  const ratio = width && height ? width / height : 3 / 2;

  // Sair zera o zoom: a próxima foto sempre abre inteira.
  const close = () => {
    scale.value = 1;
    translateX.value = 0; translateY.value = 0;
    baseX.value = 0; baseY.value = 0;
    onClose();
  };

  const measure = (next: Fold) => {
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
  };

  const pinch = usePinchGesture({
    // O zoom parte do valor que está na tela e anda com o delta de cada evento
    // (`scaleChange`). Antes, uma base fixa multiplicada pelo `scale` acumulado do
    // gesto fazia o recolhimento rápido "bater" no mínimo e voltar.
    onBegin: () => {
      'worklet';
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    },
    onUpdate: (event) => {
      'worklet';
      lastMoveAt.value = Date.now();
      const view = geometry.value;
      const next = clamp(scale.value * event.scaleChange, 1, MAX_ZOOM);
      scale.value = next;
      const limitX = panLimit(next, view.fitWidth, view.viewportWidth);
      const limitY = panLimit(next, view.fitHeight, view.viewportHeight);
      translateX.value = clamp(translateX.value, -limitX, limitX);
      translateY.value = clamp(translateY.value, -limitY, limitY);
    },
    onDeactivate: () => {
      'worklet';
      lastMoveAt.value = Date.now();
      // Sempre assenta: abaixo do mínimo volta a 1, acima mantém o quadro dentro dos limites.
      if (scale.value <= 1.02) {
        scale.value = withTiming(1, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        baseX.value = 0; baseY.value = 0;
      } else {
        const view = geometry.value;
        const limitX = panLimit(scale.value, view.fitWidth, view.viewportWidth);
        const limitY = panLimit(scale.value, view.fitHeight, view.viewportHeight);
        translateX.value = withTiming(clamp(translateX.value, -limitX, limitX));
        translateY.value = withTiming(clamp(translateY.value, -limitY, limitY));
        baseX.value = translateX.value; baseY.value = translateY.value;
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
      translateX.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(0, { duration: 180 });
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
      scale.value = withTiming(next, { duration: 220 });
      translateX.value = withTiming(targetX, { duration: 220 });
      translateY.value = withTiming(targetY, { duration: 220 });
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
