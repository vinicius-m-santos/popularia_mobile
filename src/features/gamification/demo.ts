import type { GamificationState } from './types';

/** Estado fictício do modo demonstração. Não simula o livro de XP. */
export const DEMO_GAMIFICATION: GamificationState = {
  id: 'demo',
  level: 2,
  xp: 128,
  currentLevelXp: 100,
  nextLevelXp: 250,
  streak: 3,
  missionBonusXp: 4,
  dayBonusXp: 6,
  missions: [
    { action: 'poll_participated', label: 'Participe de uma enquete', completed: true },
    { action: 'post_saved', label: 'Salve uma publicação', completed: false },
    { action: 'event_rsvp_positive', label: 'Confirme interesse em um evento', completed: false },
  ],
  achievements: [
    { code: 'primeiro_passo', title: 'Primeiro passo', detail: 'Participou da primeira enquete.', unlocked: true, unlockedAt: '2026-06-01T15:00:00-03:00' },
    { code: 'para_depois', title: 'Para depois', detail: 'Salvou a primeira publicação.', unlocked: true, unlockedAt: '2026-06-02T15:00:00-03:00' },
    { code: 'na_conversa', title: 'Na conversa', detail: 'Entrou na primeira discussão.', unlocked: false, unlockedAt: null },
    { code: 'em_comunidade', title: 'Em comunidade', detail: 'Entrou na primeira comuna.', unlocked: true, unlockedAt: '2026-06-03T15:00:00-03:00' },
    { code: 'organizando', title: 'Organizando', detail: 'Demonstrou interesse no primeiro evento.', unlocked: false, unlockedAt: null },
    { code: 'constancia', title: 'Constância', detail: 'Manteve três dias seguidos de atividade.', unlocked: true, unlockedAt: '2026-06-04T15:00:00-03:00' },
    { code: 'uma_semana', title: 'Uma semana', detail: 'Manteve sete dias seguidos de atividade.', unlocked: false, unlockedAt: null },
  ],
};
