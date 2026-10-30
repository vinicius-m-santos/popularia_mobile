import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Spacing } from '@/constants/theme';

type SectionHeadingProps = {
  label: string;
  /** Link à direita, como "Ver todas". */
  actionLabel?: string;
  onAction?: () => void;
  /** Escala e alvos de toque da direção refinada, sem alterar consumidores antigos. */
  appearance?: 'default' | 'editorial';
};

/** Título de seção com quadradinho vermelho e, opcionalmente, um link à direita. */
export function SectionHeading({ label, actionLabel, onAction, appearance = 'default' }: SectionHeadingProps) {
  const editorial = appearance === 'editorial';
  return (
    <View style={[styles.row, editorial && styles.editorialRow]}>
      <View accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
        <Kicker label={label} textStyle={editorial ? styles.editorialLabel : undefined} />
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.action, editorial && styles.editorialAction]}>
          <AppText style={styles.actionLabel} color={editorial ? Colors.ink : Colors.red}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  editorialRow: { minHeight: 36 },
  editorialLabel: { fontSize: 12.5, lineHeight: 18 },
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
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
});
