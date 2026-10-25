import type { User } from '@/types/models';

/** Pessoas fictícias. Nenhum dado real. */
export const users: User[] = [
  { id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red' },
  { id: 'luana', name: 'Luana Ferreira', handle: 'luanaf', initials: 'LF', tone: 'red' },
  { id: 'cida', name: 'Dona Cida Ramos', handle: 'cidahorta', initials: 'CR', tone: 'black' },
  { id: 'renato', name: 'Renato Assis', handle: 'prof.renato', initials: 'RA', tone: 'cream' },
  {
    id: 'taina',
    name: 'Tainá Okara',
    handle: 'leituracritica',
    initials: 'TO',
    tone: 'red',
    badge: 'Criadora',
  },
  { id: 'rosangela', name: 'Rosângela Lima', handle: 'rosalima', initials: 'RL', tone: 'cream' },
  { id: 'jorge', name: 'Jorge Batista', handle: 'jorgebatista', initials: 'JB', tone: 'red' },
];

/** Usuária fictícia "logada" no protótipo. Não há autenticação real. */
export const currentUserId = 'me';
