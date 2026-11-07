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
  /** Destaque amarelo dos mockups: selo de "acontecendo", opções e interruptores. */
  yellow: '#F4C534',
  yellowSoft: '#F9E6A6',
  /** Destaque de comentário em cartões. */
  highlight: '#EADFCB',
  /** Linhas divisórias. */
  rule: '#D9CBB2',
  muted: '#6B6259',
  /** Ícones inativos da navegação inferior. */
  navInactive: '#948A7E',
  /** Texto de apoio sobre superfícies escuras (tinta). */
  onInkMuted: '#C9BCAA',
  onInkSoft: '#D9CEBF',
  /** Linhas divisórias sobre superfícies escuras. */
  inkRule: '#4A403A',
  /** Bordas tracejadas e pegador da folha inferior. */
  strawDark: '#CDBFA6',
  /** Texto de exemplo dentro dos campos. */
  placeholder: '#8A7F73',
  error: '#B00020',
} as const;

export type ColorName = keyof typeof Colors;

/**
 * Identidade das coleções: tons mais saturados que a paleta de avatar, para a faixa de
 * coleções não ficar em marrons e olivas. A ordem é fixa; o ID da coleção escolhe a posição.
 */
export const CollectionColors = [
  { bg: Colors.red, fg: Colors.paper },
  { bg: Colors.yellow, fg: Colors.ink },
  { bg: '#2563EB', fg: Colors.paper },
  { bg: '#EA580C', fg: Colors.paper },
  { bg: '#C026D3', fg: Colors.paper },
  { bg: '#65A30D', fg: Colors.paper },
  { bg: '#7C3AED', fg: Colors.paper },
  { bg: '#0891B2', fg: Colors.paper },
  { bg: '#E11D48', fg: Colors.paper },
  { bg: '#0D9488', fg: Colors.paper },
  { bg: '#059669', fg: Colors.paper },
  { bg: '#B45309', fg: Colors.paper },
] as const;


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
  anton: 'Anton_400Regular',
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

/**
 * Sombra sólida deslocada da direção dos mockups: sem desfoque, tinta sobre o creme.
 * Use em cartões de destaque e controles principais; não em toda superfície.
 */
export const Shadows = {
  offset: {
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  offsetSmall: {
    shadowColor: Colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
} as const;

/** Compatibilidade: os tokens de movimento vivem em `constants/motion.ts`. */
export { Motion } from './motion';
