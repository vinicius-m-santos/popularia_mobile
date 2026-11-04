import { Pressable, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Spacing } from '@/constants/theme';

type SectionHeadingProps = {
  label: string;
  /** Link à direita, como "Ver todas". */
  actionLabel?: string;
  onAction?: () => void;
  /** Ícone opcional antes do link, como o "+" de "Criar coleção". */
  actionIcon?: IconName;
  /** Controle próprio à direita, como o seletor "Mais recentes". */
  trailing?: React.ReactNode;
  /** Escala e alvos de toque da direção refinada, sem alterar consumidores antigos. */
  appearance?: 'default' | 'editorial';
  /** Cor do marcador quando a tela pede um vermelho específico. */
  markerColor?: string;
  /** Ajuste explícito do rótulo sem duplicar o componente em uma tela. */
  labelStyle?: StyleProp<TextStyle>;
};

/** Título de seção com quadradinho vermelho e, opcionalmente, um link à direita. */
export function SectionHeading({ label, actionLabel, onAction, actionIcon, trailing, appearance = 'default', markerColor, labelStyle }: SectionHeadingProps) {
  const editorial = appearance === 'editorial';
  return (
    <View style={[styles.row, editorial && styles.editorialRow]}>
      <View accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
        <Kicker label={label} squareColor={markerColor} textStyle={editorial ? [styles.editorialLabel, labelStyle] : labelStyle} />
      </View>
      {trailing ?? (actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.action, editorial && styles.editorialAction]}>
          {actionIcon ? <Icon name={actionIcon} size={16} color={editorial ? Colors.ink : Colors.red} /> : null}
          <AppText style={styles.actionLabel} color={editorial ? Colors.ink : Colors.red}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  editorialRow: { minHeight: 36 },
  editorialLabel: { fontSize: 12.5, lineHeight: 21 },
  editorialAction: { minHeight: 44 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    gap: Spacing.two,
  },
  action: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 21,
  },
});
