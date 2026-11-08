import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts, PressedColors, Radius, Spacing } from '@/constants/theme';

/** Ação compacta sobre a capa: entrar, pedir entrada ou sair da comuna. */
export function MiniJoin({ label, tone, disabled, onPress, accessibilityLabel, accessibilityHint }: {
  label: string;
  tone: 'paper' | 'red';
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniJoin,
        tone === 'red'
          ? (pressed ? styles.miniJoinRedPressed : styles.miniJoinRed)
          : (pressed ? styles.miniJoinPaperPressed : styles.miniJoinPaper),
        disabled && styles.miniJoinDisabled,
      ]}>
      <AppText style={styles.miniJoinLabel} color={tone === 'red' ? Colors.paper : Colors.ink} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Número do herói da comuna (membros, publicações, regras). */
export function ComunaStat({ value, label, divider = false }: { value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.statCell, divider && styles.statDivider]} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText style={styles.statValue} maxFontSizeMultiplier={1.3}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

/** Ação do menu da comuna com ícone colorido e detalhe opcional. */
export function ComunaMenuAction({ icon, label, tone = 'ink', detail, selected = false, onPress }: {
  icon: IconName;
  label: string;
  tone?: 'ink' | 'red';
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuAction, pressed && styles.menuActionPressed]}>
      <View style={[styles.menuIcon, tone === 'red' ? styles.menuIconRed : styles.menuIconInk]}>
        <Icon name={icon} size={19} color={tone === 'red' ? Colors.red : Colors.ink} />
      </View>
      <AppText style={styles.menuLabel}>{label}</AppText>
      {detail ? <AppText variant="label" color={selected ? Colors.red : Colors.muted}>{detail}</AppText> : <Icon name="chevronRight" size={18} color={Colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  miniJoin: {
    maxWidth: 150,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
  },
  miniJoinRed: {
    backgroundColor: Colors.red,
  },
  miniJoinRedPressed: {
    backgroundColor: PressedColors.red,
  },
  miniJoinPaper: {
    backgroundColor: Colors.paper,
  },
  miniJoinPaperPressed: {
    backgroundColor: PressedColors.paper,
  },
  miniJoinDisabled: {
    opacity: 0.6,
  },
  miniJoinLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 11.5,
    lineHeight: 14,
  },
  statCell: {
    flex: 1,
    paddingVertical: 6,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.rule,
    paddingLeft: Spacing.three,
  },
  statValue: {
    fontFamily: Fonts.anton,
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  menuAction: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two + 2,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  menuActionPressed: {
    backgroundColor: Colors.strawLight,
  },
  menuIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconInk: {
    backgroundColor: Colors.strawLight,
  },
  menuIconRed: {
    backgroundColor: Colors.redSoft,
  },
  menuLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
});
