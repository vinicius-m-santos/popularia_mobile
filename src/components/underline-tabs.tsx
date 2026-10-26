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
};

/** Abas de texto com sublinhado vermelho na ativa ("Para você", "Regras"…). */
export function UnderlineTabs<K extends string>({
  options,
  value,
  onChange,
  height = 38,
  ruled = false,
}: UnderlineTabsProps<K>) {
  return (
    <View style={[styles.bar, ruled && styles.ruled]}>
      <ScrollView
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
