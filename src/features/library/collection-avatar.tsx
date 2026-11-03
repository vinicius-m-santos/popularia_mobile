import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { collectionColorFor } from '@/components/avatar';
import { Colors, Fonts, Shadows } from '@/constants/theme';

/** Duas primeiras letras significativas do nome, como no selo da coleção. */
export function collectionMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) ?? 'CO').toUpperCase();
}

/**
 * Selo de coleção compartilhado pela faixa da Biblioteca e pelo cabeçalho da coleção.
 * O monograma fica sempre centralizado, inclusive quando a fonte do sistema cresce.
 */
export function CollectionAvatar({ id, name, size = 48, shadow = false, style }: {
  id: string;
  name: string;
  size?: number;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = collectionColorFor(id);
  const fontSize = Math.round(size * 0.4);
  const lineHeight = size;
  return (
    <View
      accessible={false}
      style={[
        styles.base,
        { width: size, height: size, backgroundColor: color.bg },
        shadow && styles.shadow,
        style,
      ]}>
      <AppText
        style={[styles.text, { fontSize, lineHeight, color: color.fg, transform: [{ translateY: -Math.round(size * 0.08) }] }]}
        maxFontSizeMultiplier={1}
        numberOfLines={1}>
        {collectionMonogram(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 5,
  },
  shadow: {
    ...Shadows.offset,
    boxShadow: '3px 3px 0 #16120F',
  },
  text: {
    width: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontFamily: Fonts.anton,
    letterSpacing: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
});
