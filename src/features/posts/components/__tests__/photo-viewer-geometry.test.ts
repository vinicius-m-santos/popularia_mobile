import { describe, expect, it } from '@jest/globals';

import { clampPan, focalTranslation, panLimit, pinchZoom, type ViewerGeometry } from '../photo-viewer-geometry';

/** Imagem retrato que preenche exatamente a área útil de 400 × 800. */
const fill: ViewerGeometry = { viewportWidth: 400, viewportHeight: 800, fitWidth: 400, fitHeight: 800 };

function localAt(translate: number, scale: number, viewport: number, focal: number): number {
  return (focal - viewport / 2 - translate) / scale;
}

function screenAt(translate: number, scale: number, viewport: number, local: number): number {
  return viewport / 2 + translate + local * scale;
}

describe('limites do visualizador', () => {
  it('só permite deslocar quando a imagem ampliada passa da área útil', () => {
    expect(panLimit(1, 400, 400)).toBe(0);
    expect(panLimit(1, 300, 400)).toBe(0);
    expect(panLimit(2, 400, 400)).toBe(200);
    expect(panLimit(2, 300, 400)).toBe(100);
    expect(panLimit(1, 500, 400)).toBe(50);
  });

  it('não deixa a translação cruzar as bordas', () => {
    expect(clampPan(999, 2, 400, 400)).toBe(200);
    expect(clampPan(-999, 2, 400, 400)).toBe(-200);
    expect(clampPan(50, 1, 300, 400)).toBe(0);
    expect(clampPan(50, 2, 300, 400)).toBe(50);
  });
});

describe('compensação do ponto focal', () => {
  it('mantém a translação quando a escala não muda', () => {
    expect(focalTranslation(120, 40, 400, 2, 2)).toBe(120);
  });

  it('não mexe na translação sem uma escala anterior válida', () => {
    expect(focalTranslation(120, 40, 400, 0, 2)).toBe(120);
  });

  it('não desloca quando o foco está no centro', () => {
    expect(focalTranslation(0, 200, 400, 1, 2)).toBe(0);
    expect(focalTranslation(0, 400, 800, 1, 3)).toBe(0);
  });

  it('mantém o ponto pinçado sob os dedos nos quatro cantos', () => {
    const corners = [
      { x: 1, y: 1 },
      { x: 399, y: 1 },
      { x: 1, y: 799 },
      { x: 399, y: 799 },
    ];
    for (const focal of corners) {
      const localX = localAt(0, 1, fill.viewportWidth, focal.x);
      const localY = localAt(0, 1, fill.viewportHeight, focal.y);
      const next = pinchZoom(1, 0, 0, focal.x, focal.y, 2, fill, 4);

      expect(screenAt(next.translateX, next.scale, fill.viewportWidth, localX)).toBeCloseTo(focal.x, 5);
      expect(screenAt(next.translateY, next.scale, fill.viewportHeight, localY)).toBeCloseTo(focal.y, 5);
    }
  });

  it('acompanha uma sequência de deltas em torno do mesmo foco', () => {
    const focal = { x: 120, y: 260 };
    const localX = localAt(0, 1, fill.viewportWidth, focal.x);
    const localY = localAt(0, 1, fill.viewportHeight, focal.y);
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    for (let step = 0; step < 12; step += 1) {
      const next = pinchZoom(scale, translateX, translateY, focal.x, focal.y, 1.05, fill, 4);
      scale = next.scale;
      translateX = next.translateX;
      translateY = next.translateY;
    }

    expect(scale).toBeCloseTo(1.05 ** 12, 5);
    expect(screenAt(translateX, scale, fill.viewportWidth, localX)).toBeCloseTo(focal.x, 5);
    expect(screenAt(translateY, scale, fill.viewportHeight, localY)).toBeCloseTo(focal.y, 5);
  });

  it('respeita a borda quando a imagem ainda é menor que a área útil', () => {
    const letterbox: ViewerGeometry = { viewportWidth: 400, viewportHeight: 800, fitWidth: 400, fitHeight: 600 };
    // No eixo vertical a imagem tem 600 de altura: em 1,2× ainda cabe e a
    // translação precisa ficar em zero para não abrir faixa morta.
    const next = pinchZoom(1, 0, 0, 100, 100, 1.2, letterbox, 4);
    expect(next.translateY).toBe(0);
    expect(next.translateX).toBeCloseTo(20, 5);
  });

  it('não passa do zoom máximo e assenta no teto', () => {
    const focal = { x: 80, y: 160 };
    const atMax = pinchZoom(3.5, 0, 0, focal.x, focal.y, 2, fill, 4);
    expect(atMax.scale).toBe(4);
    const after = pinchZoom(atMax.scale, atMax.translateX, atMax.translateY, focal.x, focal.y, 3, fill, 4);
    expect(after.scale).toBe(4);
    expect(after.translateX).toBeCloseTo(atMax.translateX, 5);
    expect(after.translateY).toBeCloseTo(atMax.translateY, 5);
  });

  it('volta ao centro no zoom mínimo', () => {
    const next = pinchZoom(1.5, 50, 100, 100, 200, 0.5, fill, 4);
    expect(next.scale).toBe(1);
    expect(next.translateX).toBe(0);
    expect(next.translateY).toBe(0);
  });
});

describe('rotação do aparelho', () => {
  it('recoloca a imagem dentro do novo limite quando a área útil gira', () => {
    // Paisagem 800 × 400 com imagem 2:1 preenchia a tela; ao girar para retrato
    // 400 × 800 o limite horizontal encolhe e o vertical zera.
    expect(clampPan(400, 2, 400, 400)).toBe(200);
    expect(clampPan(200, 2, 200, 800)).toBe(0);
  });
});
