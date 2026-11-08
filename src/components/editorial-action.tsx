import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AnimatedPressable } from '@/components/animated-pressable';
import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Colors, PressedColors, Spacing } from '@/constants/theme';
import { usePressFeedback } from '@/hooks/use-press-feedback';

type EditorialActionProps = {
  label: string;
  /** Variação de leitura para controles; o padrão editorial continua mono. */
  labelVariant?: 'label' | 'button';
  icon: IconName;
  onPress: () => void;
  /** 'ghost': ação neutra como "Cancelar" — sem borda nem preenchimento, menor peso visual. */
  tone?: 'paper' | 'red' | 'ghost';
  disabled?: boolean;
  /** Operação em andamento: mantém o botão bloqueado e anuncia o estado. */
  busy?: boolean;
  accessibilityLabel?: string;
  iconPosition?: 'leading' | 'trailing';
  /** Mantém o ícone à esquerda sem deslocar o rótulo do centro do botão. */
  pinnedLeadingIcon?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Ação editorial padrão: retangular, com ícone de 22 px e rótulo mono. */
export function EditorialAction({ label, labelVariant = 'label', icon, onPress, tone = 'paper', disabled = false, busy = false, accessibilityLabel, iconPosition = 'leading', pinnedLeadingIcon = false, style }: EditorialActionProps) {
  const foreground = tone === 'red' ? Colors.paper : tone === 'ghost' ? Colors.inkSoft : Colors.ink;
  const iconNode = <Icon name={icon} size={22} color={foreground} />;
  const pinLeadingIcon = pinnedLeadingIcon && iconPosition === 'leading';
  const unavailable = disabled || busy;
  const press = usePressFeedback(tone === 'red'
    ? { backgroundColor: Colors.red, pressedBackgroundColor: PressedColors.red }
    : tone === 'paper'
      ? { backgroundColor: Colors.paper, pressedBackgroundColor: PressedColors.paper }
      : {});
  return <AnimatedPressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled: unavailable, busy }}
    disabled={unavailable}
    onPress={onPress}
    onPressIn={press.onPressIn}
    onPressOut={press.onPressOut}
    style={[styles.base, tone === 'red' && styles.red, tone === 'ghost' && styles.ghost, style, unavailable ? styles.unavailable : press.style]}>
    {pinLeadingIcon ? <View style={styles.pinnedLeadingIcon}>{iconNode}</View> : null}
    {iconPosition === 'leading' && !pinLeadingIcon ? iconNode : null}
    <AppText variant={labelVariant} color={foreground} numberOfLines={1}>{label}</AppText>
    {iconPosition === 'trailing' ? iconNode : null}
  </AnimatedPressable>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    paddingHorizontal: Spacing.two,
  },
  red: {
    backgroundColor: Colors.red,
  },
  ghost: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  pinnedLeadingIcon: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: Spacing.two,
    justifyContent: 'center',
  },
  unavailable: {
    opacity: 0.68,
  },
});
