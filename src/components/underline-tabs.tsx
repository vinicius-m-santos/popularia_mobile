import { GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Motion } from '@/constants/motion';
import { Colors, Fonts, Spacing } from '@/constants/theme';

export type TabOption<K extends string> = { key: K; label: string };

// Mocks de teste antigos podem não exportar o enum; o valor público continua sendo "system".
const SYSTEM_REDUCE_MOTION = ReduceMotion?.System ?? ('system' as ReduceMotion);

/**
 * Transição do indicador de aba. É só opacidade e escala — as duas na UI thread —
 * porque a barra vive dentro de células recicladas (perfil e feed) e não pode
 * animar altura, largura ou posição de layout. Com movimento reduzido, o
 * Reanimated aplica o valor final sem animar.
 */
export const TAB_INDICATOR_TIMING = {
  duration: Motion.duration.normal,
  easing: Motion.easing.standard,
  reduceMotion: SYSTEM_REDUCE_MOTION,
} as const;

type UnderlineTabsProps<K extends string> = {
  options: TabOption<K>[];
  value: K;
  onChange: (key: K) => void;
  height?: number;
  /** Linhas pretas em cima e embaixo (página da comuna). */
  ruled?: boolean;
  /** Scroll horizontal das abas. Quando presente, não deixa um pan externo trocar de página. */
  gesture?: NativeGesture | null;
  /** Ajuste tipográfico local, sem mexer no padrão das outras telas. */
  labelStyle?: StyleProp<TextStyle>;
  /** Aba ativa em extrabold, como no perfil. */
  activeWeight?: boolean;
  underlineHeight?: number;
};

/** Abas de texto com sublinhado vermelho na ativa ("Para você", "Regras"…). */
export function UnderlineTabs<K extends string>({
  options,
  value,
  onChange,
  height = 38,
  ruled = false,
  gesture,
  labelStyle,
  activeWeight = false,
  underlineHeight = 3,
}: UnderlineTabsProps<K>) {
  const scrollerRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Partial<Record<K, number>>>({});
  // A aba ativa pode mudar por gesto externo: traga a seleção para a área visível.
  useEffect(() => {
    const x = offsets.current[value];
    if (x === undefined) return;
    scrollerRef.current?.scrollTo({ x: Math.max(0, x - Spacing.five), animated: true });
  }, [value]);
  const scroller = (
    <ScrollView
      ref={scrollerRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      role="tablist">
      {options.map((opt) => (
        <Tab
          key={opt.key}
          option={opt}
          active={opt.key === value}
          height={height}
          labelStyle={labelStyle}
          activeWeight={activeWeight}
          underlineHeight={underlineHeight}
          onPress={() => onChange(opt.key)}
          onLayout={(event) => { offsets.current[opt.key] = event.nativeEvent.layout.x; }}
        />
      ))}
    </ScrollView>
  );
  return (
    <View style={[styles.bar, ruled && styles.ruled]}>
      {gesture ? <GestureDetector gesture={gesture}>{scroller}</GestureDetector> : scroller}
    </View>
  );
}

type TabProps<K extends string> = {
  option: TabOption<K>;
  active: boolean;
  height: number;
  labelStyle?: StyleProp<TextStyle>;
  activeWeight: boolean;
  underlineHeight: number;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
};

/**
 * Cada aba anima o próprio indicador. O primeiro render não anima (a barra
 * pode montar no meio da lista), e a troca de estado apenas cresce/recolhe o
 * sublinhado da esquerda para a direita. Não há mudança de layout.
 */
function Tab<K extends string>({
  option,
  active,
  height,
  labelStyle,
  activeWeight,
  underlineHeight,
  onPress,
  onLayout,
}: TabProps<K>) {
  const indicator = useSharedValue(active ? 1 : 0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (wasActive.current === active) return;
    wasActive.current = active;
    indicator.value = withTiming(active ? 1 : 0, TAB_INDICATOR_TIMING);
  }, [active, indicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicator.value,
    transform: [{ scaleX: indicator.value }],
  }), [indicator]);

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      role="tab"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.tab, { minHeight: Math.max(height, 44) }]}>
      <AppText
        style={[styles.label, labelStyle, activeWeight && active && styles.labelActive]}
        color={active ? Colors.ink : Colors.muted}
        numberOfLines={1}>
        {option.label}
      </AppText>
      <Animated.View
        pointerEvents="none"
        style={[styles.underline, { height: underlineHeight }, indicatorStyle]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.cream,
  },
  ruled: {
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  row: {
    paddingHorizontal: Spacing.five,
    gap: 22,
  },
  tab: {
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  labelActive: { fontFamily: Fonts.extrabold },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.red,
    transformOrigin: 'left',
  },
});
