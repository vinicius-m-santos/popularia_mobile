import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AnimatedPressable } from '@/components/animated-pressable';
import { Icon, type IconName } from '@/components/icon';
import { Colors, MinTouchTarget } from '@/constants/theme';
import { usePressFeedback } from '@/hooks/use-press-feedback';

type IconButtonProps = {
  icon: IconName;
  /** Obrigatório: botões só com ícone precisam de rótulo para leitores de tela. */
  accessibilityLabel: string;
  onPress: () => void;
  color?: string;
  size?: number;
  /** Traço do ícone quando o mockup pede um desenho mais grosso. */
  strokeWidth?: number;
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
  strokeWidth,
  background,
  bordered = false,
  filled,
  selected,
  style,
}: IconButtonProps) {
  const press = usePressFeedback();
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={[
        styles.base,
        background ? { backgroundColor: background } : null,
        bordered && styles.bordered,
        style,
        press.style,
      ]}>
      <Icon name={icon} size={size} color={color} filled={filled} strokeWidth={strokeWidth} />
    </AnimatedPressable>
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
});
