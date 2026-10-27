import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { TONE_COLORS } from '@/components/avatar';
import type { Sticker } from '../api';

export function StickerTile({ sticker, small = false }: { sticker: Sticker; small?: boolean }) {
  const tone = TONE_COLORS[sticker.tone];
  return <View style={[styles.tile, small && styles.small, { backgroundColor: tone.bg }]} accessibilityLabel={`Figurinha ${sticker.label}`}>
    <AppText style={styles.symbol} maxFontSizeMultiplier={1}>{sticker.symbol}</AppText>
    <AppText variant="label" color={tone.fg} style={styles.label} numberOfLines={2}>{sticker.label}</AppText>
  </View>;
}
const styles = StyleSheet.create({ tile: { width: 108, minHeight: 108, borderRadius: 14, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 6 }, small: { width: 88, minHeight: 96 }, symbol: { fontSize: 34, lineHeight: 42 }, label: { textAlign: 'center', fontSize: 10, lineHeight: 15 } });
