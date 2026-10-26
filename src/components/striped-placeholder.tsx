import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type StripedPlaceholderProps = {
  /** Legenda e texto alternativo, por exemplo "mutirão na praça". */
  label: string;
  prefix?: 'foto' | 'capa';
  variant?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  /** Exibe a legenda no canto. */
  showLabel?: boolean;
};

const PALETTES = {
  light: { a: Colors.straw, b: Colors.strawLight, text: '#5A5047' },
  dark: { a: '#221C18', b: '#2C241F', text: '#B3A694' },
};

/**
 * Placeholder listrado do design no lugar de fotos. Quando houver imagens reais,
 * este componente dá lugar a `expo-image` com o mesmo texto alternativo.
 */
export function StripedPlaceholder({
  label,
  prefix = 'foto',
  variant = 'light',
  style,
  showLabel = true,
}: StripedPlaceholderProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const palette = PALETTES[variant];
  // Medidas do ladrilho em números: porcentagens dentro de <Pattern> viram NaN no iOS e derrubam o app.
  const tile = variant === 'dark' ? 20 : 18;
  return (
    <View
      style={[styles.box, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${prefix === 'capa' ? 'Capa' : 'Foto'}: ${label}`}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern
            id={id}
            patternUnits="userSpaceOnUse"
            width={tile}
            height={tile}
            patternTransform="rotate(45)">
            <Rect width={tile} height={tile} fill={palette.a} />
            <Rect x={tile / 2} width={tile / 2} height={tile} fill={palette.b} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {showLabel ? (
        <AppText style={styles.label} color={palette.text} maxFontSizeMultiplier={1.2}>
          {prefix}: {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 10,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
  },
});
