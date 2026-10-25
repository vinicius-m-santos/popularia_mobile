import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';
import type { Tone } from '@/types/models';

/** Cores de avatar por tom, como no design. Fotos reais ficam para uma etapa futura. */
export const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  red: { bg: Colors.red, fg: Colors.paper },
  black: { bg: Colors.ink, fg: Colors.cream },
  cream: { bg: Colors.straw, fg: Colors.ink },
};

type AvatarProps = {
  initials: string;
  tone: Tone;
  size?: number;
};

export function Avatar({ initials, tone, size = 40 }: AvatarProps) {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <AppText style={[styles.initials, { fontSize: size * 0.35 }]} color={fg} maxFontSizeMultiplier={1}>
        {initials}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: Fonts.condensed,
  },
});
