import { DEMO_MODE } from '@/constants/config';
import { queryClient } from '@/lib/query/client';

import { getGamification } from './api';
import { gamificationQueryKey, type GamificationState } from './types';

/** Aviso curto quando uma missão fechou desde a última leitura. Sem leitura anterior, não avisa. */
export function missionFeedback(before: GamificationState | undefined, after: GamificationState): string | null {
  if (!before) return null;
  const done = new Set(before.missions.filter((mission) => mission.completed).map((mission) => mission.action));
  const newly = after.missions.filter((mission) => mission.completed && !done.has(mission.action));
  if (newly.length === 0) return null;
  let xp = newly.length * after.missionBonusXp;
  const hadOpen = before.missions.length >= 3 && before.missions.some((mission) => !mission.completed);
  const cleared = hadOpen && after.missions.length >= 3 && after.missions.every((mission) => mission.completed);
  if (cleared) xp += after.dayBonusXp;
  return `${newly.length > 1 ? 'Missões concluídas' : 'Missão concluída'} · +${xp} XP`;
}

/** Atualiza o progresso sem segurar a ação que já deu certo. Falha aqui não desfaz voto, save ou presença. */
export function acknowledgeGamification(accountId: string | undefined, notify: (message: string) => void): void {
  if (DEMO_MODE || !accountId) return;
  const key = gamificationQueryKey(accountId);
  const before = queryClient.getQueryData<GamificationState>(key);
  void queryClient.fetchQuery({
    queryKey: key,
    queryFn: ({ signal }) => getGamification(signal),
  }).then((after) => {
    const message = missionFeedback(before, after);
    if (message) notify(message);
  }).catch(() => undefined);
}
