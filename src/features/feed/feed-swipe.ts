/**
 * O pan lateral só ativa depois de 20 pontos no eixo X. Antes disso, um
 * deslocamento de 16 pontos no eixo Y o faz falhar: a lista vertical continua
 * dona do scroll e um arrasto diagonal não vira troca de aba.
 */
export const FEED_SWIPE_ACTIVATION_X = 20;
export const FEED_SWIPE_FAIL_Y = 16;

/** Distância mínima, e dominância horizontal no fim do gesto, para trocar de aba. */
export const FEED_SWIPE_DISTANCE = 48;
export const FEED_SWIPE_VERTICAL_RATIO = 1.25;

/** 1 = próxima aba (dedo para a esquerda); -1 = aba anterior; 0 = não troca. */
export function feedSwipeDirection(translationX: number, translationY: number): -1 | 0 | 1 {
  if (Math.abs(translationX) < FEED_SWIPE_DISTANCE) return 0;
  if (Math.abs(translationX) < Math.abs(translationY) * FEED_SWIPE_VERTICAL_RATIO) return 0;
  return translationX < 0 ? 1 : -1;
}

/** Próxima aba depois de um swipe. Nas pontas, mantém a aba atual. */
export function feedTabAfterSwipe<T extends string>(
  tabs: readonly T[],
  current: T,
  translationX: number,
  translationY: number,
): T {
  const index = tabs.indexOf(current);
  if (index < 0) return current;
  const direction = feedSwipeDirection(translationX, translationY);
  const next = index + direction;
  if (direction === 0 || next < 0 || next >= tabs.length) return current;
  return tabs[next];
}
