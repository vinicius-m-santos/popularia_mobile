/**
 * Tokens visuais da Popularia, extraídos da direção visual (Etapa 1 do design).
 * Paleta editorial: papel, tinta e vermelho. O app usa apenas o tema claro por enquanto.
 */

export const Colors = {
  /** Vermelho principal: ações, comunas, destaques. */
  red: '#D62718',
  redPressed: '#A51C10',
  redSoft: '#F3C9C3',
  /** Tinta: texto principal e superfícies escuras (barra de navegação). */
  ink: '#16120F',
  inkSoft: '#3D3530',
  /** Fundo das telas. */
  cream: '#F4ECDD',
  /** Cartões e superfícies elevadas. */
  paper: '#FBF7EF',
  /** Palha: avatares claros, placeholders de imagem. */
  straw: '#E4D6BD',
  strawLight: '#EBE1CF',
  /** Destaque de comentário em cartões. */
  highlight: '#EADFCB',
  /** Linhas divisórias. */
  rule: '#D9CBB2',
  muted: '#6B6259',
  /** Ícones inativos da navegação inferior. */
  navInactive: '#948A7E',
  error: '#B00020',
} as const;

export type ColorName = keyof typeof Colors;

/**
 * Famílias carregadas em `src/app/_layout.tsx` via `useFonts`.
 * O design usa Archivo com `font-stretch` (62–80%) nos títulos; o React Native
 * não suporta essa propriedade, então Archivo Narrow cumpre o papel de "condensada".
 */
export const Fonts = {
  regular: 'Archivo_400Regular',
  bold: 'Archivo_700Bold',
  extrabold: 'Archivo_800ExtraBold',
  condensed: 'ArchivoNarrow_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 18,
  six: 24,
  seven: 32,
  eight: 48,
} as const;

export const Radius = {
  sm: 4,
  md: 6,
  lg: 10,
  xl: 12,
  pill: 999,
} as const;

/** Área mínima de toque recomendada (Android 48dp, iOS 44pt). */
export const MinTouchTarget = 44;

export const MaxContentWidth = 640;
