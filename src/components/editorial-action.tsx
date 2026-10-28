import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';

type EditorialActionProps = {
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'paper' | 'red';
  disabled?: boolean;
  accessibilityLabel?: string;
  iconPosition?: 'leading' | 'trailing';
  style?: StyleProp<ViewStyle>;
};

/** Ação editorial padrão: retangular, com ícone de 22 px e rótulo mono. */
export function EditorialAction({ label, icon, onPress, tone = 'paper', disabled = false, accessibilityLabel, iconPosition = 'leading', style }: EditorialActionProps) {
  const foreground = tone === 'red' ? Colors.paper : Colors.ink;
  const iconNode = <Icon name={icon} size={22} color={foreground} />;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.base, tone === 'red' && styles.red, style, (pressed || disabled) && styles.pressed]}>
    {iconPosition === 'leading' ? iconNode : null}
    <AppText variant="label" color={foreground} numberOfLines={1}>{label}</AppText>
    {iconPosition === 'trailing' ? iconNode : null}
  </Pressable>;
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
  pressed: {
    opacity: 0.68,
  },
});
