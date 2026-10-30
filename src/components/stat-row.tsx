import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';

type Stat = { value: string; label: string; onPress?: () => void; accessibilityHint?: string };

type StatRowProps = {
  stats: Stat[];
};

/** Números em destaque entre duas linhas de tinta (perfil e comuna). Alguns números, como
 * seguidores e seguindo, podem ser tocados para abrir a respectiva lista. */
export function StatRow({ stats }: StatRowProps) {
  return (
    <View style={styles.row}>
      {stats.map((s, i) => {
        const content = <>
          <AppText style={styles.value} maxFontSizeMultiplier={1.3}>
            {s.value}
          </AppText>
          <AppText style={styles.label} color={Colors.muted} numberOfLines={1}>
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
            style={({ pressed }) => [styles.cell, i > 0 && styles.divider, pressed && styles.pressed]}>
            {content}
          </Pressable>
        ) : (
          <View
            key={s.label}
            style={[styles.cell, i > 0 && styles.divider]}
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
  pressed: {
    opacity: 0.7,
  },
  value: {
    fontFamily: Fonts.condensed,
    fontSize: 28,
    lineHeight: 30,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 3,
  },
});
