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

/** Distância vertical (em pontos) a partir da qual arrastar descarta a foto. */
export const DISMISS_DISTANCE = 110;
/** Velocidade (em pontos por segundo) de um fling que descarta mesmo com arrasto curto. */
export const DISMISS_VELOCITY = 900;
/** Arrasto mínimo para uma soltura rápida ser tratada como fling, não como toque. */
export const DISMISS_FLING_DISTANCE = 48;
/** Distância em que o backdrop chega a transparente durante o arrasto. */
export const DISMISS_FADE_DISTANCE = 260;

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
 * Decide o descarte a partir da posição e da velocidade na soltura.
 *
 * Distância sozinha já fecha; um fling curto também fecha, mas só acima de
 * `DISMISS_FLING_DISTANCE` — assim um toque trêmulo não vira descarte.
 */
export function shouldDismiss(distance: number, velocity: number): boolean {
  'worklet';
  const pulled = Math.abs(distance);
  // O fling só fecha se continuar na direção do arrasto; um retorno rápido ao
  // centro não pode ser lido como intenção de descartar.
  const flungAway = distance * velocity > 0;
  return pulled > DISMISS_DISTANCE
    || (flungAway && pulled > DISMISS_FLING_DISTANCE && Math.abs(velocity) > DISMISS_VELOCITY);
}

/**
 * Alvo da animação de saída: além da borda na direção do gesto, mesmo que a
 * pessoa já tenha arrastado até perto da borda antes de soltar.
 */
export function dismissTarget(distance: number, viewportHeight: number): number {
  'worklet';
  const direction = distance < 0 ? -1 : 1;
  return direction * Math.max(viewportHeight + 64, Math.abs(distance) + 64);
}

/**
 * Opacidade do backdrop e do chrome durante o arrasto sem zoom. Com a imagem
 * ampliada o fundo continua opaco: pinça nunca deve parecer descarte.
 */
export function dragBackdropOpacity(distance: number, scale: number): number {
  'worklet';
  if (scale > 1.02) return 1;
  return 1 - Math.min(1, Math.abs(distance) / DISMISS_FADE_DISTANCE);
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
