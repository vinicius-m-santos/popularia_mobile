/**
 * Paleta da área legal (Sobre e legal, documentos e licenças).
 * Os valores vêm dos mockups de 390 px e são os mesmos usados pelo login e pelo cadastro,
 * para a entrada do app e a área legal lerem como a mesma superfície.
 */
export const LegalPaint = {
  bg: '#F2EADB',
  surface: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  /** Vermelho de texto e de perigo (links, alertas, chips restritos). */
  redText: '#A3261C',
  yellow: '#F4C534',
  secondary: '#5E554A',
  subtitle: '#3E3630',
  rule: '#D9CFBF',
  /** Rótulo mono sobre a superfície escura do card de suporte. */
  labelOnDark: '#C9BFAE',
} as const;

/** Sombra dura de 3 px da direção editorial, aplicada enquanto o card está pressionado. */
export const LegalHardShadow = `3px 3px 0 ${LegalPaint.ink}`;

/** Sombra vermelha das frases-chave (highlight) dos documentos. */
export const LegalRedShadow = `3px 3px 0 ${LegalPaint.red}`;
