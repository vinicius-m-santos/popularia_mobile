import { createContext, use, useCallback, useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useNativeGesture, usePanGesture, type NativeGesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, runOnJS, type SharedValue } from 'react-native-reanimated';

import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';

import { profileTabAfterSwipe } from './profile-tabs';

function settleProfileSwipe<T extends string>(current: SwipeState<T>, translationX: number, velocityX: number) {
  const next = profileTabAfterSwipe(current.tabs, current.active, translationX, velocityX);
  if (next !== current.active) current.onChange(next);
}

const DragContext = createContext<SharedValue<number> | null>(null);
const TabGestureContext = createContext<NativeGesture | null>(null);
const PanGestureContext = createContext<PanGesture | null>(null);

type SwipeState<T extends string> = {
  tabs: readonly T[];
  active: T;
  onChange: (next: T) => void;
};

/**
 * Swipe horizontal entre as abas, no mesmo estado que o toque.
 * O pan só ativa com deslocamento claramente horizontal, para a lista
 * continuar dona do scroll vertical e dos gestos diagonais.
 */
export function ProfileTabSwipe<T extends string>({ tabs, active, onChange, children }: {
  tabs: readonly T[];
  active: T;
  onChange: (next: T) => void;
  children: ReactNode;
}) {
  const dragX = useSharedValue(0);
  const indexSV = useSharedValue(0);
  const countSV = useSharedValue(tabs.length);
  const finishSwipe = useCallback((translationX: number, velocityX: number) => {
    settleProfileSwipe({ tabs, active, onChange }, translationX, velocityX);
  }, [active, onChange, tabs]);
  useEffect(() => {
    indexSV.value = Math.max(0, tabs.indexOf(active));
    countSV.value = tabs.length;
  }, [active, countSV, indexSV, tabs]);

  const pan = usePanGesture({
    maxPointers: 1,
    activeOffsetX: [-36, 36],
    failOffsetY: [-28, 28],
    onBegin: () => {
      'worklet';
      cancelAnimation(dragX);
    },
    onUpdate: (event) => {
      'worklet';
      const atStart = indexSV.value <= 0;
      const atEnd = indexSV.value >= countSV.value - 1;
      let next = event.translationX;
      if ((atStart && next > 0) || (atEnd && next < 0)) next *= 0.22;
      dragX.value = next;
    },
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled) runOnJS(finishSwipe)(event.translationX, event.velocityX);
      dragX.value = withTiming(0, { duration: event.canceled ? 160 : 200 });
    },
    onFinalize: (event) => {
      'worklet';
      // Também restaura quando o pan falha antes de ativar (por exemplo, scroll vertical).
      if (event.canceled) dragX.value = withTiming(0, { duration: 160 });
    },
  });
  const tabGesture = useNativeGesture({ block: pan });

  return (
    <DragContext.Provider value={dragX}>
      <PanGestureContext.Provider value={pan}>
        <TabGestureContext.Provider value={tabGesture}>
          <GestureDetector gesture={pan}>
            <View style={styles.fill} collapsable={false}>{children}</View>
          </GestureDetector>
        </TabGestureContext.Provider>
      </PanGestureContext.Provider>
    </DragContext.Provider>
  );
}

/** Permite que controles nativos de mídia tenham prioridade sobre o swipe da aba. */
export function useProfileTabPanGesture() {
  return use(PanGestureContext);
}

/** Conteúdo da aba acompanha o dedo. Cabeçalho e tabs ficam de fora. */
export function ProfileSwipeContent({ children }: { children: ReactNode }) {
  const dragX = use(DragContext);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dragX ? dragX.value : 0 }] }));
  if (!dragX) return children;
  return <Animated.View style={[styles.slide, style]}>{children}</Animated.View>;
}

/** Abas do perfil: o toque troca a página e o scroll dos rótulos não vira swipe. */
export function ProfileTabs<K extends string>({ options, value, onChange, height }: {
  options: TabOption<K>[];
  value: K;
  onChange: (key: K) => void;
  height?: number;
}) {
  const gesture = use(TabGestureContext);
  return <UnderlineTabs options={options} value={value} onChange={onChange} height={height} gesture={gesture} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  slide: { width: '100%' },
});
