import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Colors, MinTouchTarget } from '@/constants/theme';

type IconButtonProps = {
  icon: IconName;
  /** Obrigatório: botões só com ícone precisam de rótulo para leitores de tela. */
  accessibilityLabel: string;
  onPress: () => void;
  color?: string;
  size?: number;
  /** Círculo de fundo, usado sobre a capa da comuna. */
  background?: string;
  /** Borda circular, usada no botão "Salvar" da discussão. */
  bordered?: boolean;
  filled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Botão de ícone com área de toque mínima de 44×44. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color = Colors.ink,
  size = 22,
  background,
  bordered = false,
  filled,
  selected,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [
        styles.base,
        background ? { backgroundColor: background } : null,
        bordered && styles.bordered,
        pressed && styles.pressed,
        style,
      ]}>
      <Icon name={icon} size={size} color={color} filled={filled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: MinTouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bordered: {
    borderWidth: 1.5,
    borderColor: Colors.ink,
  },
  pressed: {
    opacity: 0.6,
  },
});
