import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { Colors, MinTouchTarget, Spacing } from '@/constants/theme';

type EditorialBarProps = {
  /** Ação de voltar. Sem ela, o recuo de 44 mantém o título estável. */
  onBack?: () => void;
  backLabel?: string;
  /** Slot do rótulo: o consumidor mantém a variante tipográfica de cada tela. */
  title?: ReactNode;
  /** Slot à direita, normalmente uma ação de 44 ou o menu da tela. */
  actions?: ReactNode;
  /** Divisor vertical de 1.5 × 28 entre voltar e título, como no chrome da Biblioteca. */
  divider?: boolean;
  /** Espaço extra depois do divisor, quando o consumidor tinha margem própria. */
  dividerStyle?: StyleProp<ViewStyle>;
  /** Recuo horizontal do chrome; 4 é o padrão das barras internas. */
  inset?: number;
  /** Espaçamento entre os elementos da barra. */
  gap?: number;
  /** Altura mínima; 58 é o padrão do chrome interno. */
  minHeight?: number;
  /** Linha inferior de 1.5 ou 2 quando a barra separa o conteúdo. */
  rule?: 0 | 1.5 | 2;
  /** Mantém o espaço de uma ação de 44 quando não há ação à direita. */
  reserveActionSpace?: boolean;
  /** Conteúdo do título centralizado em vez de alinhado à esquerda. */
  align?: 'start' | 'center';
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Barra editorial de voltar + divisor + label. Concentra o chrome que estava
 * repetido no perfil, na discussão, na Biblioteca e no tópico; os slots mantêm
 * a tipografia e as ações de cada tela sem recriar a estrutura.
 */
export function EditorialBar({
  onBack,
  backLabel = 'Voltar',
  title,
  actions,
  divider = false,
  dividerStyle,
  inset = Spacing.one,
  gap = Spacing.two,
  minHeight = 58,
  rule = 0,
  reserveActionSpace = false,
  align = 'start',
  style,
  titleStyle,
  testID,
}: EditorialBarProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.bar,
        {
          gap,
          minHeight,
          paddingHorizontal: inset,
          ...(rule ? { borderBottomWidth: rule, borderBottomColor: Colors.ink } : null),
        },
        style,
      ]}>
      {onBack ? (
        <IconButton icon="back" accessibilityLabel={backLabel} onPress={onBack} />
      ) : (
        <View style={styles.spacer} accessibilityElementsHidden importantForAccessibility="no" />
      )}
      {divider ? <View style={[styles.divider, dividerStyle]} /> : null}
      {title === undefined || title === null ? null : (
        <View
          style={[
            styles.title,
            align === 'center' && styles.titleCentered,
            titleStyle,
          ]}>
          {title}
        </View>
      )}
      {actions ?? (reserveActionSpace ? <View style={styles.spacer} /> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cream,
  },
  spacer: {
    width: MinTouchTarget,
    height: MinTouchTarget,
  },
  divider: {
    width: 1.5,
    height: 28,
    backgroundColor: Colors.ink,
  },
  title: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleCentered: {
    alignItems: 'center',
  },
});
