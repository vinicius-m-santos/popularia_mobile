import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import type { Comuna } from '@/types/models';

import { ComunaMark } from './comuna-mark';

type ComunaRowProps = {
  comuna: Comuna;
  /** Linha de apoio, como "11,6 mil membros · Política, Economia". */
  subtitle: string;
  description?: string;
  onOpen: () => void;
  /** Ação ou selo à direita (Participar, papel na comuna). */
  trailing?: ReactNode;
};

/** Comuna em lista: marca, nome e uma linha de contexto. */
export function ComunaRow({ comuna, subtitle, description, onOpen, trailing }: ComunaRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="link"
        accessibilityLabel={`${comuna.name}, ${subtitle}`}
        accessibilityHint="Abre a comuna"
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
        <ComunaMark initials={comuna.initials} tone={comuna.tone} size={44} />
        <View style={styles.text}>
          <AppText style={styles.name} numberOfLines={1}>
            {comuna.name}
          </AppText>
          <AppText style={styles.subtitle} color={Colors.muted} numberOfLines={1}>
            {subtitle}
          </AppText>
          {description ? <AppText variant="caption" numberOfLines={2} style={styles.description}>{description}</AppText> : null}
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 20,
  },
  description: { marginTop: Spacing.one },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 1,
  },
});
