import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { SectionHeading } from '@/components/section-heading';
import { Colors, Fonts } from '@/constants/theme';

type Props = {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Cabeçalho das duas seções novas do Explorar. Reutiliza o título editorial
 * (quadradinho + mono) e deixa só o link "Ver todas" no desenho do mockup.
 */
export function ExploreSectionHeading({ label, actionLabel, onAction }: Props) {
  return (
    <SectionHeading
      appearance="editorial"
      label={label}
      markerColor="#BF3326"
      labelStyle={styles.label}
      trailing={actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <AppText style={styles.actionLabel} color={Colors.ink}>{actionLabel}</AppText>
        </Pressable>
      ) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 1.44,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 10,
  },
  actionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.65,
  },
});
