import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

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
  const merged = StyleSheet.flatten([styles[variant], color ? { color } : null, style]);
  return (
    <Text
      maxFontSizeMultiplier={variant === 'label' ? 1.4 : 1.8}
      style={withMinimumLineHeight(merged ?? {})}
      {...rest}
    />
  );
}

const TITLE_FAMILIES: string[] = [Fonts.condensed, Fonts.anton, Fonts.bold, Fonts.extrabold, Fonts.monoSemibold];

/**
 * Regra de legibilidade: títulos, nomes e rótulos em bold/condensada precisam de
 * `lineHeight >= fontSize + 8`. O topo das maiúsculas do Anton e do Archivo Narrow
 * fica fora da caixa quando a linha é apertada; o piso central evita repetir o
 * ajuste em cada tela.
 */
export function withMinimumLineHeight(style: TextStyle): TextStyle {
  if (typeof style.fontSize !== 'number' || typeof style.lineHeight !== 'number') return style;
  const emphasized = TITLE_FAMILIES.includes(style.fontFamily ?? '') || style.textTransform === 'uppercase' || style.fontSize >= 18;
  if (!emphasized) return style;
  const minimum = style.fontSize + 8;
  return style.lineHeight >= minimum ? style : { ...style, lineHeight: minimum };
}

const styles = StyleSheet.create({
  /** Títulos de tela: condensada, caixa-alta. */
  display: {
    fontFamily: Fonts.condensed,
    fontSize: 40,
    lineHeight: 48,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  heading: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 30,
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
    lineHeight: 23,
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
    lineHeight: 19,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  button: {
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 21,
    color: Colors.ink,
  },
});
