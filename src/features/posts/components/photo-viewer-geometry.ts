/** Geometria da foto dentro da área útil do visualizador. */
export type ViewerGeometry = {
  viewportWidth: number;
  viewportHeight: number;
  fitWidth: number;
  fitHeight: number;
};

export type ZoomState = {
  scale: number;
  translateX: number;
  translateY: number;
};

/** Limite de deslocamento para a imagem já ampliada não sair do quadro. */
export function panLimit(scale: number, fit: number, viewport: number): number {
  'worklet';
  return Math.max(0, (fit * scale - viewport) / 2);
}

/**
 * Deslocamento que mantém sob o ponto focal o mesmo ponto da imagem.
 *
 * O `transform` é `[{ translateX }, { translateY }, { scale }]`, então a posição
 * na tela é `translate + scale * local` (a translação não é multiplicada pelo
 * zoom). Ao passar de `previousScale` para `nextScale`, o ponto da imagem que
 * estava em `focal` precisa continuar em `focal`; a compensação é a diferença
 * entre as duas posições antes e depois da escala.
 */
export function focalTranslation(
  translate: number,
  focal: number,
  viewport: number,
  previousScale: number,
  nextScale: number,
): number {
  'worklet';
  if (previousScale <= 0) return translate;
  const focalFromCenter = focal - viewport / 2;
  const ratio = nextScale / previousScale;
  return focalFromCenter + (translate - focalFromCenter) * ratio;
}

/** Aplica o limite de borda a uma translação. */
export function clampPan(translate: number, scale: number, fit: number, viewport: number): number {
  'worklet';
  const limit = panLimit(scale, fit, viewport);
  return Math.min(Math.max(translate, -limit), limit);
}

/**
 * Próximo estado da pinça: aplica o delta de escala no ponto focal capturado no
 * início do gesto e recoloca a translação dentro das bordas. O zoom fica entre
 * 1x e `maxScale`; no limite, o delta não desloca mais a imagem.
 */
export function pinchZoom(
  scale: number,
  translateX: number,
  translateY: number,
  focalX: number,
  focalY: number,
  scaleChange: number,
  geometry: ViewerGeometry,
  maxScale: number,
): ZoomState {
  'worklet';
  const previousScale = scale > 0 ? scale : 1;
  const nextScale = Math.min(Math.max(previousScale * scaleChange, 1), maxScale);
  const nextX = focalTranslation(translateX, focalX, geometry.viewportWidth, previousScale, nextScale);
  const nextY = focalTranslation(translateY, focalY, geometry.viewportHeight, previousScale, nextScale);
  return {
    scale: nextScale,
    translateX: clampPan(nextX, nextScale, geometry.fitWidth, geometry.viewportWidth),
    translateY: clampPan(nextY, nextScale, geometry.fitHeight, geometry.viewportHeight),
  };
}
