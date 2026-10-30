import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

export type PillVariant = 'primary' | 'dark' | 'outline' | 'light';
type PillSize = 'sm' | 'md' | 'lg';

type PillButtonProps = {
  label: string;
  onPress: () => void;
  variant?: PillVariant;
  size?: PillSize;
  icon?: IconName;
  /** Ícone preenchido (estado ativo de "Apoiar"). */
  iconFilled?: boolean;
  /** Para botões de alternância (Seguir, Participar, Vou): anunciado ao leitor de tela. */
  selected?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Texto em caixa-alta condensada, como "Participar da comuna". */
  display?: boolean;
  /** Ação em andamento (ou indisponível): não responde ao toque e fica esmaecido. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const VARIANTS: Record<PillVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: Colors.red, fg: Colors.paper, border: Colors.red },
  dark: { bg: Colors.ink, fg: Colors.cream, border: Colors.ink },
  outline: { bg: 'transparent', fg: Colors.ink, border: Colors.ink },
  light: { bg: Colors.paper, fg: Colors.ink, border: Colors.paper },
};

const HEIGHTS: Record<PillSize, number> = { sm: 36, md: 44, lg: 50 };

/** Botão em pílula do design. Altura mínima de 36 com área de toque estendida a 44. */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconFilled,
  selected,
  accessibilityLabel,
  accessibilityHint,
  display = false,
  disabled = false,
  style,
}: PillButtonProps) {
  const colors = VARIANTS[variant];
  const height = HEIGHTS[size];
  const extraHit = Math.max(0, (44 - height) / 2);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined && !disabled ? undefined : { selected, disabled }}
      hitSlop={extraHit ? { top: extraHit, bottom: extraHit } : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: size === 'lg' ? 2 : 1.5,
        },
        (pressed || disabled) && styles.pressed,
        style,
      ]}>
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={size === 'lg' ? 20 : 18} color={colors.fg} filled={iconFilled} /> : null}
        <AppText
          style={display ? styles.displayLabel : size === 'sm' ? styles.smallLabel : styles.label}
          color={colors.fg}
          numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
  smallLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 13,
    lineHeight: 17,
  },
  displayLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 19,
    lineHeight: 22,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.one,
  },
});
