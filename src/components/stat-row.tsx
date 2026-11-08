import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Motion } from '@/constants/motion';
import { Colors, Fonts, Spacing } from '@/constants/theme';

type Stat = { value: string; label: string; onPress?: () => void; accessibilityHint?: string };

type StatRowProps = {
  stats: Stat[];
  /** Perfil usa números maiores e fio de 2; a comuna mantém o padrão. */
  appearance?: 'default' | 'profile';
};

/** Números em destaque entre duas linhas de tinta (perfil e comuna). Alguns números, como
 * seguidores e seguindo, podem ser tocados para abrir a respectiva lista. */
export function StatRow({ stats, appearance = 'default' }: StatRowProps) {
  const profile = appearance === 'profile';
  return (
    <View style={[styles.row, profile && styles.rowProfile]}>
      {stats.map((s, i) => {
        const content = <>
          <AppText style={[styles.value, profile && styles.valueProfile]} maxFontSizeMultiplier={1.3}>
            {s.value}
          </AppText>
          <AppText style={[styles.label, profile && styles.labelProfile]} color={Colors.muted} numberOfLines={1}>
            {s.label}
          </AppText>
        </>;
        return s.onPress ? (
          <Pressable
            key={s.label}
            onPress={s.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${s.value} ${s.label}`}
            accessibilityHint={s.accessibilityHint}
            style={({ pressed }) => [styles.cell, profile && styles.cellProfile, i > 0 && styles.divider, i > 0 && profile && styles.dividerProfile, pressed && styles.pressed]}>
            {content}
          </Pressable>
        ) : (
          <View
            key={s.label}
            style={[styles.cell, profile && styles.cellProfile, i > 0 && styles.divider, i > 0 && profile && styles.dividerProfile]}
            accessible
            accessibilityLabel={`${s.value} ${s.label}`}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  cell: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
  },
  divider: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.rule,
    paddingLeft: Spacing.three,
  },
  rowProfile: { borderTopWidth: 2, borderBottomWidth: 2 },
  cellProfile: { paddingVertical: 12 },
  dividerProfile: { paddingLeft: 14 },
  pressed: {
    opacity: Motion.feedback.pressed.opacity,
  },
  value: {
    fontFamily: Fonts.condensed,
    fontSize: 28,
    lineHeight: 30,
  },
  valueProfile: { fontFamily: Fonts.anton, fontSize: 38, lineHeight: 44 },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  labelProfile: { fontSize: 11, lineHeight: 14, letterSpacing: 0.88 },
});
