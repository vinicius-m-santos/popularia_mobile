import { GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';

export type TabOption<K extends string> = { key: K; label: string };

type UnderlineTabsProps<K extends string> = {
  options: TabOption<K>[];
  value: K;
  onChange: (key: K) => void;
  height?: number;
  /** Linhas pretas em cima e embaixo (página da comuna). */
  ruled?: boolean;
  /** Scroll horizontal das abas. Quando presente, não deixa um pan externo trocar de página. */
  gesture?: NativeGesture | null;
};

/** Abas de texto com sublinhado vermelho na ativa ("Para você", "Regras"…). */
export function UnderlineTabs<K extends string>({
  options,
  value,
  onChange,
  height = 38,
  ruled = false,
  gesture,
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
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            onLayout={(event) => { offsets.current[opt.key] = event.nativeEvent.layout.x; }}
            role="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.tab, { minHeight: Math.max(height, 44) }]}>
            <AppText style={styles.label} color={active ? Colors.ink : Colors.muted}>
              {opt.label}
            </AppText>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
  return (
    <View style={[styles.bar, ruled && styles.ruled]}>
      {gesture ? <GestureDetector gesture={gesture}>{scroller}</GestureDetector> : scroller}
    </View>
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
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  underlineActive: {
    backgroundColor: Colors.red,
  },
});
