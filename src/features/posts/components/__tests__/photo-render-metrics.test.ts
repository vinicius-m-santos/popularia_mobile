import { describe, expect, it } from '@jest/globals';

import { photoRenderMetrics } from '../photo-render-metrics';

describe('medida efetiva da foto no feed', () => {
  it('converte o layout em pixels físicos e preserva a proporção no cover', () => {
    const metrics = photoRenderMetrics({
      sourceWidth: 2048,
      sourceHeight: 1365,
      layoutWidth: 360,
      layoutHeight: 450,
      pixelRatio: 3,
    });

    expect(metrics).toMatchObject({
      renderedWidthPx: 1080,
      renderedHeightPx: 1350,
      neededWidthPx: 2025,
      neededHeightPx: 1350,
      coversFrame: true,
      sourceCoverRatio: 1.01,
    });
    expect(metrics?.decodedBytes).toBe(2048 * 1365 * 4);
    expect(metrics?.neededBytes).toBe(2025 * 1350 * 4);
  });

  it('mede retrato e quadrada sem fixar um tamanho de tela', () => {
    const portrait = photoRenderMetrics({
      sourceWidth: 1365,
      sourceHeight: 2048,
      layoutWidth: 360,
      layoutHeight: 450,
      pixelRatio: 3,
    });
    expect(portrait).toMatchObject({
      neededWidthPx: 1080,
      neededHeightPx: 1620,
      sourceCoverRatio: 1.26,
      coversFrame: true,
    });

    const squareAt2x = photoRenderMetrics({
      sourceWidth: 2048,
      sourceHeight: 2048,
      layoutWidth: 360,
      layoutHeight: 450,
      pixelRatio: 2,
    });
    expect(squareAt2x).toMatchObject({
      renderedWidthPx: 720,
      renderedHeightPx: 900,
      neededWidthPx: 900,
      neededHeightPx: 900,
      sourceCoverRatio: 2.28,
      coversFrame: true,
    });
  });

  it('sinaliza fonte menor que o quadro em vez de inventar sobra de resolução', () => {
    const metrics = photoRenderMetrics({
      sourceWidth: 400,
      sourceHeight: 300,
      layoutWidth: 360,
      layoutHeight: 450,
      pixelRatio: 3,
    });

    expect(metrics).toMatchObject({
      neededWidthPx: 1800,
      neededHeightPx: 1350,
      coversFrame: false,
      sourceCoverRatio: 0.22,
    });
    expect(metrics!.neededBytes).toBeGreaterThan(metrics!.decodedBytes);
  });

  it('devolve null para medida ausente ou inválida', () => {
    expect(photoRenderMetrics({ sourceWidth: 0, sourceHeight: 100, layoutWidth: 300, layoutHeight: 300, pixelRatio: 3 })).toBeNull();
    expect(photoRenderMetrics({ sourceWidth: 100, sourceHeight: 100, layoutWidth: 300, layoutHeight: 0, pixelRatio: 3 })).toBeNull();
    expect(photoRenderMetrics({ sourceWidth: 100, sourceHeight: 100, layoutWidth: 300, layoutHeight: 300, pixelRatio: 0 })).toBeNull();
  });
});
