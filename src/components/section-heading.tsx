import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Spacing } from '@/constants/theme';

type SectionHeadingProps = {
  label: string;
  /** Link à direita, como "Ver todas". */
  actionLabel?: string;
  onAction?: () => void;
};

/** Título de seção com quadradinho vermelho e, opcionalmente, um link à direita. */
export function SectionHeading({ label, actionLabel, onAction }: SectionHeadingProps) {
  return (
    <View style={styles.row}>
      <View accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
        <Kicker label={label} />
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.action}>
          <AppText style={styles.actionLabel} color={Colors.red}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
