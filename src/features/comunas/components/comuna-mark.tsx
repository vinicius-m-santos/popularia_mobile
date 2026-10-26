import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { TONE_COLORS } from '@/components/avatar';
import { Colors, Fonts } from '@/constants/theme';
import type { Tone } from '@/types/models';

type ComunaMarkProps = {
  initials: string;
  tone: Tone;
  size?: number;
  /** Selo inclinado com contorno e sombra, como nas capas dos cartões. */
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Marca quadrada da comuna com as iniciais. Decorativa: o nome fica no texto ao lado. */
export function ComunaMark({ initials, tone, size = 44, raised = false, style }: ComunaMarkProps) {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size >= 50 ? 12 : 10, backgroundColor: bg },
        raised && styles.raised,
        raised && { boxShadow: `0 ${size >= 50 ? 4 : 3}px 0 ${Colors.ink}` },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <AppText
        style={[styles.initials, { fontSize: size * 0.43, lineHeight: size * 0.5 }]}
        color={fg}
        maxFontSizeMultiplier={1}>
        {initials}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  raised: {
    borderWidth: 3,
    borderColor: Colors.paper,
    transform: [{ rotate: '-4deg' }],
  },
  initials: {
    fontFamily: Fonts.condensed,
  },
});
