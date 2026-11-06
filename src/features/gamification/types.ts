import { queryKeys } from '@/lib/query/keys';

/** GET /me/gamification. Privado: sem livro de XP e sem a origem de cada ação. */
export type GamificationMission = {
  action: string;
  label: string;
  completed: boolean;
};

export type GamificationAchievement = {
  code: string;
  title: string;
  detail: string;
  /** Como ganhar, usado enquanto a conquista está bloqueada. */
  criterion: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type GamificationState = {
  id: string;
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  streak: number;
  /** Último dia civil (America/Sao_Paulo) com participação válida. */
  lastActivityOn: string | null;
  missionBonusXp: number;
  dayBonusXp: number;
  missions: GamificationMission[];
  achievements: GamificationAchievement[];
};

export function gamificationQueryKey(accountId: string) {
  return queryKeys.gamification.detail(accountId);
}

export function streakLabel(streak: number): string {
  if (streak <= 0) return 'Nenhum dia seguido';
  if (streak === 1) return '1 dia seguido';
  return `${streak} dias seguidos`;
}

export function levelFraction(state: Pick<GamificationState, 'xp' | 'currentLevelXp' | 'nextLevelXp'>): number {
  const span = state.nextLevelXp - state.currentLevelXp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (state.xp - state.currentLevelXp) / span));
}
