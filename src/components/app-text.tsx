import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

export type TextVariant =
  | 'display'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'button';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: string;
};

/**
 * Texto com a tipografia da Popularia. Respeita o tamanho de fonte do sistema
 * (acessibilidade), com teto para não quebrar layouts compactos.
 */
export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={variant === 'label' ? 1.4 : 1.8}
      style={[styles[variant], color ? { color } : null, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  /** Títulos de tela: condensada, caixa-alta. */
  display: {
    fontFamily: Fonts.condensed,
    fontSize: 40,
    lineHeight: 42,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  heading: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 23,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: 15.5,
    lineHeight: 22,
    color: Colors.ink,
  },
  bodyStrong: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  caption: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
  },
  /** Rótulos editoriais: mono, caixa-alta, espaçada. */
  label: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  button: {
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 18,
    color: Colors.ink,
  },
});
