import { describe, expect, it } from '@jest/globals';

import { Motion } from '@/constants/motion';
import { Colors, PressedColors } from '@/constants/theme';

/** Contraste WCAG 2.x entre duas cores RGB opacas. */
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Resultado de aplicar alpha sobre a cor de fundo da tela. */
function blend(foreground: string, background: string, alpha: number): string {
  const front = Number.parseInt(foreground.slice(1), 16);
  const back = Number.parseInt(background.slice(1), 16);
  return `#${[0, 1, 2].map((index) => {
    const shift = 16 - index * 8;
    return Math.round(((front >> shift) & 255) * alpha + ((back >> shift) & 255) * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  }).join('')}`;
}

describe('contraste dos estados pressed', () => {
  it('mantém o texto claro legível quando o vermelho troca de superfície', () => {
    // O vermelho normal é o piso: 4,72:1 para `paper`.
    expect(contrast(Colors.paper, Colors.red)).toBeGreaterThanOrEqual(4.5);
    // O pressed usa `redPressed` em vez de apagar o botão inteiro; 7,09:1.
    expect(PressedColors.red).toBe(Colors.redPressed);
    expect(contrast(Colors.paper, PressedColors.red)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(Colors.paper, PressedColors.red)).toBeGreaterThan(contrast(Colors.paper, Colors.red));
  });

  it('preserva o texto escuro nas superfícies claras e o texto claro sobre tinta', () => {
    expect(contrast(Colors.ink, PressedColors.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(Colors.cream, PressedColors.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(Colors.cream, Colors.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('mantém o contraste mínimo quando o feedback usa opacidade sobre o creme', () => {
    const fadedInk = blend(Colors.ink, Colors.cream, Motion.feedback.pressed.opacity);
    expect(contrast(fadedInk, Colors.cream)).toBeGreaterThanOrEqual(4.5);
  });

  it('documenta por que o texto padrão do vermelho é tinta ou papel, nunca creme', () => {
    // Creme sobre vermelho fica em 4,30:1 e não serve para texto pequeno.
    expect(contrast(Colors.cream, Colors.red)).toBeLessThan(4.5);
    // Papel é o par aprovado do vermelho principal (4,72:1).
    expect(contrast(Colors.paper, Colors.red)).toBeGreaterThanOrEqual(4.5);
  });
});
