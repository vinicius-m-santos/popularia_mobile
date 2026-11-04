/**
 * Paleta da área legal (Sobre e legal e licenças).
 * Os valores vêm do mockup de 390 px e são os mesmos usados pelo login e pelo cadastro,
 * para a entrada do app e a área legal lerem como a mesma superfície.
 */
export const LegalPaint = {
  bg: '#F2EADB',
  surface: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  secondary: '#5E554A',
  subtitle: '#3E3630',
  rule: '#D9CFBF',
} as const;

/** Sombra dura de 3 px da direção editorial, aplicada enquanto o card está pressionado. */
export const LegalHardShadow = `3px 3px 0 ${LegalPaint.ink}`;
