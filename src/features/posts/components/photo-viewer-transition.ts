import type { ViewerGeometry } from './photo-viewer-geometry';

/**
 * Transição thumbnail → visualizador.
 *
 * O contrato de mídia não oferece `sharedTransitionTag` nem uma tela nativa
 * compartilhada: o visualizador é um `Modal` transparente. A transição é feita
 * com a posição real do thumbnail na janela (`measureInWindow`) e uma camada
 * temporária que percorre esse retângulo até o quadro final. O visualizador
 * recebe uma medida tirada no toque — nunca um ref de célula — para que a
 * reciclagem da lista não reaproveite a origem de outra foto.
 */

/** Retângulo em pontos, relativo à janela do app. */
export type WindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowInsets = {
  top: number;
  left: number;
};

/** Subconjunto de um host component necessário para medir a origem. */
export type MeasurableView = {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

const MIN_SIZE = 0.5;

/**
 * Descarta medidas sem área ou não finitas. Uma célula desmontada/reclicada
 * costuma responder com zeros; começar a transição em 0 × 0 faria a foto
 * nascer de um ponto invisível em vez de continuar o thumbnail.
 */
export function validWindowRect(rect: WindowRect | null | undefined): WindowRect | null {
  if (!rect) return null;
  const { x, y, width, height } = rect;
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= MIN_SIZE || height <= MIN_SIZE) return null;
  return { x, y, width, height };
}

/**
 * A célula pode estar parcialmente sob o cabeçalho ou cortada pela borda da
 * janela. Basta existir a parte tocada; medidas totalmente fora pertencem a
 * uma célula que já saiu da tela e não servem para a transição.
 */
export function intersectsWindow(rect: WindowRect | null | undefined, windowWidth: number, windowHeight: number): boolean {
  const valid = validWindowRect(rect);
  if (!valid || windowWidth <= 0 || windowHeight <= 0) return false;
  return valid.x < windowWidth
    && valid.y < windowHeight
    && valid.x + valid.width > 0
    && valid.y + valid.height > 0;
}

/**
 * Lê a origem uma única vez e devolve a medida já validada. O callback do
 * `measureInWindow` é assíncrono; na prática chega entre o `pressIn` e o
 * `press`, mas quando não chega o visualizador abre com o fade de fallback.
 */
export function measurePhotoOrigin(
  view: MeasurableView | null | undefined,
  windowWidth: number,
  windowHeight: number,
  onMeasured: (origin: WindowRect | null) => void,
): void {
  if (!view || typeof view.measureInWindow !== 'function') {
    onMeasured(null);
    return;
  }
  view.measureInWindow((x, y, width, height) => {
    const rect = validWindowRect({ x, y, width, height });
    onMeasured(rect && intersectsWindow(rect, windowWidth, windowHeight) ? rect : null);
  });
}

/**
 * Quadro final da foto em coordenadas da janela. O viewport começa depois do
 * inset superior e da margem esquerda; o chrome inferior não entra porque a
 * viewport já é medida sem ele.
 */
export function travelDestination(geometry: ViewerGeometry, insets: WindowInsets): WindowRect | null {
  if (geometry.viewportWidth <= 0 || geometry.viewportHeight <= 0) return null;
  if (geometry.fitWidth <= 0 || geometry.fitHeight <= 0) return null;
  return {
    x: insets.left + (geometry.viewportWidth - geometry.fitWidth) / 2,
    y: insets.top + (geometry.viewportHeight - geometry.fitHeight) / 2,
    width: geometry.fitWidth,
    height: geometry.fitHeight,
  };
}
