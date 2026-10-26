import type { CommunityEvent } from '@/types/models';

import { nextWeekday } from './time';

/** Chamados (atos, mutirões, assembleias) fictícios desta semana. */
export const events: CommunityEvent[] = [
  {
    id: 'tarifa',
    comunaId: 'tarifa',
    kind: 'Ato',
    title: 'Tarifa Zero já',
    startsAt: nextWeekday(4, 17), // quinta
    place: 'Praça Sete, BH',
    attendeeCount: 486,
    tone: 'red',
  },
  {
    id: 'horta',
    comunaId: 'hortas',
    kind: 'Mutirão',
    title: 'Plantio no Jardim Helena',
    startsAt: nextWeekday(6, 8), // sábado
    place: 'Praça do Jd. Helena, SP',
    attendeeCount: 58,
    tone: 'black',
  },
  {
    id: 'cursinho',
    comunaId: 'cursinho',
    kind: 'Assembleia',
    title: 'Futuro do cursinho',
    startsAt: nextWeekday(1, 19), // segunda
    place: 'Associação do Ibura, Recife',
    attendeeCount: 31,
    tone: 'cream',
  },
];
