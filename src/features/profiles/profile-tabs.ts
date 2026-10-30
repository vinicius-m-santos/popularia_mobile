export type ProfileTabKey = 'posts' | 'media' | 'episodios' | 'comunas' | 'biblioteca';

/** Distância e velocidade mínimas para trocar de aba. O gesto vertical continua com a lista. */
export const PROFILE_TAB_SWIPE_DISTANCE = 56;
export const PROFILE_TAB_SWIPE_VELOCITY = 900;

export type ProfileTabOption = { key: ProfileTabKey; label: string };

/**
 * Abas visíveis do perfil. Episódios só existe para criadoras.
 * Perfil próprio e alheio usam a mesma lista: o índice nunca é fixo.
 */
export function profileTabOptions(hasEpisodes: boolean): ProfileTabOption[] {
  return [
    { key: 'posts', label: 'Publicações' },
    { key: 'media', label: 'Mídia' },
    ...(hasEpisodes ? [{ key: 'episodios' as const, label: 'Episódios' }] : []),
    { key: 'comunas', label: 'Comunas' },
    { key: 'biblioteca', label: 'Biblioteca pessoal' },
  ];
}

/** 1 = próxima aba (dedo para a esquerda); -1 = aba anterior. */
export function profileSwipeDirection(translationX: number, velocityX: number): -1 | 0 | 1 {
  if (translationX <= -PROFILE_TAB_SWIPE_DISTANCE) return 1;
  if (translationX >= PROFILE_TAB_SWIPE_DISTANCE) return -1;
  if (velocityX <= -PROFILE_TAB_SWIPE_VELOCITY) return 1;
  if (velocityX >= PROFILE_TAB_SWIPE_VELOCITY) return -1;
  return 0;
}

/** Próxima aba depois de um swipe. Nas pontas, devolve a aba atual. */
export function profileTabAfterSwipe<T extends string>(tabs: readonly T[], current: T, translationX: number, velocityX: number): T {
  const index = tabs.indexOf(current);
  if (index < 0) return current;
  const direction = profileSwipeDirection(translationX, velocityX);
  const next = index + direction;
  if (direction === 0 || next < 0 || next >= tabs.length) return current;
  return tabs[next];
}
