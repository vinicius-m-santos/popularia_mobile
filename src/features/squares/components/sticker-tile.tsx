import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { TONE_COLORS } from '@/components/avatar';
import { Colors } from '@/constants/theme';
import type { Sticker } from '../api';

export function StickerTile({ sticker, small = false }: { sticker: Sticker; small?: boolean }) {
  const tone = TONE_COLORS[sticker.tone];
  return <View style={[styles.tile, small && styles.small, { backgroundColor: tone.bg }]} accessibilityLabel={`Figurinha ${sticker.label}`}>
    <AppText style={styles.symbol} maxFontSizeMultiplier={1}>{sticker.symbol}</AppText>
    <AppText variant="label" color={tone.fg} style={styles.label} numberOfLines={2}>{sticker.label}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  tile: {
    width: 108,
    minHeight: 108,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  small: {
    width: 88,
    minHeight: 88,
  },
  symbol: {
    fontSize: 34,
    lineHeight: 40,
  },
  label: {
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
