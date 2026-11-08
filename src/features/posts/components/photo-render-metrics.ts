import { estimateImageBitmapBytes } from '@/lib/performance';

/**
 * Tamanho efetivo de uma foto no feed (POP-65).
 *
 * O layout do React Native está em DIP; a decodificação nativa acontece em
 * pixels físicos. `neededWidthPx`/`neededHeightPx` são o menor bitmap que cobre
 * o quadro mantendo a proporção da fonte (a mesma lógica de `cover`), então a
 * comparação com a fonte de 2048 px não depende de um tamanho de tela fixo.
 */
export type PhotoRenderMetrics = {
  renderedWidthPx: number;
  renderedHeightPx: number;
  neededWidthPx: number;
  neededHeightPx: number;
  decodedBytes: number;
  neededBytes: number;
  /** Fonte / necessário. Maior que 1 sobra resolução; menor que 1 falta. */
  sourceCoverRatio: number;
  coversFrame: boolean;
};

export type PhotoRenderInput = {
  sourceWidth: number;
  sourceHeight: number;
  layoutWidth: number;
  layoutHeight: number;
  pixelRatio: number;
};

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function photoRenderMetrics(input: PhotoRenderInput): PhotoRenderMetrics | null {
  const { sourceWidth, sourceHeight, layoutWidth, layoutHeight, pixelRatio } = input;
  if (![sourceWidth, sourceHeight, layoutWidth, layoutHeight, pixelRatio].every(positive)) return null;
  if (sourceHeight === 0) return null;

  const renderedWidthPx = Math.max(1, Math.round(layoutWidth * pixelRatio));
  const renderedHeightPx = Math.max(1, Math.round(layoutHeight * pixelRatio));
  const sourceRatio = sourceWidth / sourceHeight;
  const frameRatio = renderedWidthPx / renderedHeightPx;

  // `cover`: a fonte preenche o quadro e sobra corte no eixo mais longo. O
  // bitmap necessário preserva a proporção da fonte; não é só a view.
  const neededWidthPx = sourceRatio >= frameRatio
    ? Math.max(renderedWidthPx, Math.round(renderedHeightPx * sourceRatio))
    : renderedWidthPx;
  const neededHeightPx = sourceRatio >= frameRatio
    ? renderedHeightPx
    : Math.max(renderedHeightPx, Math.round(renderedWidthPx / sourceRatio));

  const sourceCoverRatio = Math.min(
    sourceWidth / neededWidthPx,
    sourceHeight / neededHeightPx,
  );

  return {
    renderedWidthPx,
    renderedHeightPx,
    neededWidthPx,
    neededHeightPx,
    decodedBytes: estimateImageBitmapBytes(sourceWidth, sourceHeight),
    neededBytes: estimateImageBitmapBytes(neededWidthPx, neededHeightPx),
    sourceCoverRatio: Math.round(sourceCoverRatio * 100) / 100,
    coversFrame: sourceWidth >= neededWidthPx && sourceHeight >= neededHeightPx,
  };
}
