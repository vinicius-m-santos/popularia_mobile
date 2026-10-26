import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';
import type { Tone } from '@/types/models';

/** Cores por tom, como no design. Fotos reais ficam para uma etapa futura. */
export const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  red: { bg: Colors.red, fg: Colors.paper },
  black: { bg: Colors.ink, fg: Colors.cream },
  cream: { bg: Colors.straw, fg: Colors.ink },
};

type AvatarProps = {
  initials: string;
  tone: Tone;
  size?: number;
  /** Contorno creme, para avatares sobrepostos. */
  ring?: boolean;
};

/** Avatar com iniciais. É decorativo: o nome fica no texto ao lado. */
export function Avatar({ initials, tone, size = 40, ring = false }: AvatarProps) {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ring && styles.ring,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <AppText style={[styles.initials, { fontSize: size * 0.35, lineHeight: size * 0.45 }]} color={fg} maxFontSizeMultiplier={1}>
        {initials}
      </AppText>
    </View>
  );
}

type AvatarStackProps = {
  people: { id: string; initials: string; tone: Tone }[];
  size?: number;
};

export function AvatarStack({ people, size = 30 }: AvatarStackProps) {
  return (
    <View style={styles.stack} accessible={false} importantForAccessibility="no-hide-descendants">
      {people.map((p) => (
        <View key={p.id} style={styles.stackItem}>
          <Avatar initials={p.initials} tone={p.tone} size={size} ring />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 2,
    borderColor: Colors.cream,
  },
  initials: {
    fontFamily: Fonts.condensed,
  },
  stack: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  stackItem: {
    marginRight: -8,
  },
});
