import { describe, expect, it } from '@jest/globals';

import { photoRenderMetrics, type PhotoRenderMetrics } from '@/features/posts/components/photo-render-metrics';
import { QA_PHOTO_SIZES, qaPhotoVariantSize, type QaPhotoSize } from '@/features/performance/photo-harness-fixture';

/**
 * Modelo de memória do POP-65.
 *
 * Não decodifica imagem nem mede memória: usa as mesmas dimensões do feed de
 * QA para calcular bitmap ARGB e o mínimo necessário para cobrir o quadro em
 * pixels físicos. Serve para mostrar por que a fonte de 2048 px não é
 * automaticamente 5× maior que o render, e para dimensionar a variante antes
 * de qualquer pipeline.
 *
 * npx jest --runTestsByPath benchmarks/pop-65-photo-decode-model.bench.ts \
 *   --testMatch '**\/*.bench.ts' --runInBand --silent=false
 */

const CARD_WIDTH_DIP = 360;
const MAX_CARD_HEIGHT_DIP = 520;
const FEED_WIDTH_RATIO_MIN = 0.8;
const FEED_WIDTH_RATIO_MAX = 16 / 9;

function frameFor(size: QaPhotoSize): { width: number; height: number } {
  const ratio = Math.max(FEED_WIDTH_RATIO_MIN, Math.min(FEED_WIDTH_RATIO_MAX, size.width / size.height));
  return {
    width: CARD_WIDTH_DIP,
    height: Math.min(MAX_CARD_HEIGHT_DIP, CARD_WIDTH_DIP / ratio),
  };
}

function metricsFor(size: QaPhotoSize, pixelRatio: number): PhotoRenderMetrics {
  const frame = frameFor(size);
  const metrics = photoRenderMetrics({
    sourceWidth: size.width,
    sourceHeight: size.height,
    layoutWidth: frame.width,
    layoutHeight: frame.height,
    pixelRatio,
  });
  if (!metrics) throw new Error(`medida inválida para ${size.label}`);
  return metrics;
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function table(pixelRatio: number): void {
  console.info(`POP-65 feed ${CARD_WIDTH_DIP} DIP @ ${pixelRatio}× · fonte → necessário no cover`);
  for (const size of QA_PHOTO_SIZES) {
    const metrics = metricsFor(size, pixelRatio);
    console.info(
      `POP-65 ${size.label.padEnd(14)} ${size.width}×${size.height} ` +
      `fonte ${mb(metrics.decodedBytes)} · necessário ${metrics.neededWidthPx}×${metrics.neededHeightPx} ` +
      `${mb(metrics.neededBytes)} · razão ${metrics.sourceCoverRatio.toFixed(2)}× · ` +
      `${metrics.coversFrame ? 'cobre' : 'AMPLIA'}`,
    );
  }
}

describe('POP-65 modelo de decodificação da foto 2048px', () => {
  it('compara fonte e render em 2× e 3× e mede a variante de 512', () => {
    table(3);
    table(2);
    table(1);

    const square3x = metricsFor(QA_PHOTO_SIZES[0], 3);
    const square2x = metricsFor(QA_PHOTO_SIZES[0], 2);
    expect(square3x.neededWidthPx).toBe(1080);
    expect(square3x.decodedBytes).toBe(2048 * 2048 * 4);
    expect(square3x.neededBytes).toBe(1080 * 1080 * 4);
    expect(square3x.sourceCoverRatio).toBeLessThan(2);
    expect(square2x.sourceCoverRatio).toBeGreaterThan(2);

    // Uma variante de 512 px não cobre nem o quadro de 360 DIP em 2×.
    const small = qaPhotoVariantSize(QA_PHOTO_SIZES[0], 'small');
    const smallMetrics = metricsFor(small, 2);
    expect(smallMetrics.coversFrame).toBe(false);
    expect(smallMetrics.sourceCoverRatio).toBeLessThan(1);

    // A fonte de 900 px já é menor que o necessário em 3×.
    const legacy = metricsFor(QA_PHOTO_SIZES[QA_PHOTO_SIZES.length - 1], 3);
    expect(legacy.coversFrame).toBe(false);

    // Cenário hipotético: 120 fontes vs 120 bitmaps no tamanho do render.
    const sourceTotal = QA_PHOTO_SIZES.reduce((total, size) => total + metricsFor(size, 3).decodedBytes, 0);
    const neededTotal = QA_PHOTO_SIZES.reduce((total, size) => total + metricsFor(size, 3).neededBytes, 0);
    console.info(
      `POP-65 120 fotos (repetindo os 8 presets) @3×: fontes ${mb(sourceTotal * 15)} · ` +
      `necessário ${mb(neededTotal * 15)} · economia máxima ${mb((sourceTotal - neededTotal) * 15)} ` +
      '(hipótese de todas montadas; a lista virtualizada mantém poucas)',
    );
  });
});
