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
  { id: 'marcos', name: 'Marcos Vinícius', handle: 'marcosbh', initials: 'MV', tone: 'black' },
  { id: 'jessica', name: 'Jéssica Moura', handle: 'jessbarreiro', initials: 'JM', tone: 'cream' },
  { id: 'tiago', name: 'Tiago Nunes', handle: 'tiagon', initials: 'TN', tone: 'red' },
  { id: 'rosangela', name: 'Rosângela Lima', handle: 'rosalima', initials: 'RL', tone: 'cream' },
  {
    id: 'pula',
    name: 'Coletivo Pula Catraca',
    handle: 'pulacatraca',
    initials: 'PC',
    tone: 'black',
    badge: 'Moderação',
  },
  { id: 'pedro', name: 'Pedro Henrique', handle: 'pedroh', initials: 'PH', tone: 'black' },
  { id: 'jorge', name: 'Jorge Batista', handle: 'jorgebatista', initials: 'JB', tone: 'red' },
  { id: 'ana', name: 'Ana Kariri', handle: 'anakariri', initials: 'AK', tone: 'black' },
  { id: 'bia', name: 'Bia Santos', handle: 'biasantos', initials: 'BS', tone: 'cream' },
  { id: 'edu', name: 'Edu Kalunga', handle: 'edukalunga', initials: 'EK', tone: 'cream' },
  { id: 'rafa', name: 'Rafael Prado', handle: 'rafaprado', initials: 'RP', tone: 'black' },
  { id: 'gus', name: 'Gustavo Lemos', handle: 'guslemos', initials: 'GL', tone: 'cream' },
  { id: 'spam', name: 'Apostilas Aprovação', handle: 'apostilas_aprov', initials: 'AA', tone: 'cream' },
];

/**
 * Perfil fictício "logado" no protótipo. Não há autenticação real.
 * A cidade é declarada no perfil: o app não usa localização do aparelho.
 */
export const currentUser = {
  id: 'me',
  city: 'São Paulo · SP',
  /** Comunas de que a pessoa já participa ao abrir o app. */
  joinedComunaIds: ['tarifa', 'cursinho'],
};
