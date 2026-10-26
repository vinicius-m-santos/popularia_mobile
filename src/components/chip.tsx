import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type ChipOption<K extends string> = { key: K; label: string };

type ChipRowProps<K extends string> = {
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
};

/** Filtros em pílula, rolando na horizontal: o ativo fica preenchido de tinta. */
export function ChipRow<K extends string>({ options, value, onChange, accessibilityLabel }: ChipRowProps<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      role="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            role="radio"
            accessibilityState={{ checked: active }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
            <AppText style={styles.label} color={active ? Colors.cream : Colors.ink} numberOfLines={1}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.five,
    gap: 6,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.ink,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
