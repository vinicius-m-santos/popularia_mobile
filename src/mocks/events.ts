import type { CommunityEvent } from '@/types/models';

/** Chamados (atos, mutirões, assembleias) fictícios. */
export const events: CommunityEvent[] = [
  {
    id: 'tarifa',
    comunaId: 'tarifa',
    kind: 'Ato',
    title: 'Tarifa Zero já',
    startsAt: '2024-11-14T17:00:00-03:00',
    place: 'Praça Sete, BH',
    attendeeCount: 486,
  },
];
