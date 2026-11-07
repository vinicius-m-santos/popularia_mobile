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
 *
 * O caminho mais comum (sem `style`/`color`) usa o estilo da variante já
 * resolvido no módulo: não há `StyleSheet.flatten` nem alocação por render.
 * Estilos customizados continuam passando pelo mesmo piso de line-height.
 */
export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  const base = VARIANT_STYLES[variant];
  const textStyle = style === undefined
    ? (color ? [base, { color }] : base)
    : withMinimumLineHeight(StyleSheet.flatten([base, color ? { color } : null, style]) ?? {});
  return (
    <Text
      maxFontSizeMultiplier={variant === 'label' ? 1.4 : 1.8}
      style={textStyle}
      {...rest}
    />
  );
}

const TITLE_FAMILIES = new Set<string>([Fonts.condensed, Fonts.anton, Fonts.bold, Fonts.extrabold, Fonts.monoSemibold]);
const minimumLineHeightCache = new WeakMap<TextStyle, TextStyle>();

/**
 * Regra de legibilidade: títulos, nomes e rótulos em bold/condensada precisam de
 * `lineHeight >= fontSize + 8`. O topo das maiúsculas do Anton e do Archivo Narrow
 * fica fora da caixa quando a linha é apertada; o piso central evita repetir o
 * ajuste em cada tela.
 *
 * O resultado ajustado é memorizado pela identidade do estilo: folhas e estilos
 * registrados são reutilizados entre renders e não geram um objeto novo cada vez.
 */
export function withMinimumLineHeight(style: TextStyle): TextStyle {
  if (typeof style.fontSize !== 'number' || typeof style.lineHeight !== 'number') return style;
  const emphasized = TITLE_FAMILIES.has(style.fontFamily ?? '') || style.textTransform === 'uppercase' || style.fontSize >= 18;
  if (!emphasized) return style;
  const minimum = style.fontSize + 8;
  if (style.lineHeight >= minimum) return style;
  const cached = minimumLineHeightCache.get(style);
  if (cached) return cached;
  const adjusted = { ...style, lineHeight: minimum };
  minimumLineHeightCache.set(style, adjusted);
  return adjusted;
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

/** Estilos de variante já com o piso de line-height aplicado uma única vez. */
const VARIANT_STYLES: Record<TextVariant, TextStyle> = {
  display: withMinimumLineHeight(StyleSheet.flatten(styles.display) as TextStyle),
  heading: withMinimumLineHeight(StyleSheet.flatten(styles.heading) as TextStyle),
  body: withMinimumLineHeight(StyleSheet.flatten(styles.body) as TextStyle),
  bodyStrong: withMinimumLineHeight(StyleSheet.flatten(styles.bodyStrong) as TextStyle),
  caption: withMinimumLineHeight(StyleSheet.flatten(styles.caption) as TextStyle),
  label: withMinimumLineHeight(StyleSheet.flatten(styles.label) as TextStyle),
  button: withMinimumLineHeight(StyleSheet.flatten(styles.button) as TextStyle),
};
