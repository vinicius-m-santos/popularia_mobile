import type { CommunityEvent } from '@/types/models';

import { nextWeekday } from './time';

const peopleArt = require('../../assets/comunas/comuna-hero-people.png') as number;
const parkArt = require('../../assets/squares/squares-hero-park-illustration.png') as number;

/**
 * Chamados fictícios desta semana, um de cada tipo: entrada livre, com vagas e com meta.
 * As capas são as mesmas ilustrações usadas nas Praças.
 */
export const events: CommunityEvent[] = [
  {
    id: 'tarifa',
    comunaId: 'tarifa',
    kind: 'Ato',
    title: 'Ato pela Tarifa Zero',
    startsAt: nextWeekday(5, 19), // sexta
    place: 'Praça Sete de Setembro, Centro',
    address: 'Praça Sete de Setembro, Centro, Belo Horizonte',
    cover: peopleArt,
    coverFit: 'cover',
    description: 'Concentração na Praça Sete. Leve cartaz, apito e água.',
    attendeeCount: 12,
    maybeCount: 4,
    goingIds: ['jessica', 'tiago', 'rosangela'],
    tone: 'red',
  },
  {
    id: 'jogatina',
    comunaId: 'jogatina',
    kind: 'Assembleia',
    title: 'Noite de jogos de tabuleiro',
    startsAt: nextWeekday(6, 19), // sábado
    place: 'Casa da Lu — Santa Tereza',
    address: 'Rua Duque de Caxias, Santa Tereza, Belo Horizonte',
    description: 'Cada um leva um jogo ou um petisco. Iniciantes são bem-vindos.',
    attendeeCount: 6,
    maybeCount: 2,
    capacityMode: 'spots',
    capacity: 8,
    goingIds: ['jessica', 'rafa', 'bia'],
    tone: 'cream',
  },
  {
    id: 'piquenique',
    comunaId: 'leitura',
    kind: 'Mutirão',
    title: 'Piquenique e troca de livros',
    startsAt: nextWeekday(0, 10), // domingo
    place: 'Parque Municipal, perto do coreto',
    address: 'Parque Municipal, Centro, Belo Horizonte',
    cover: parkArt,
    coverFit: 'contain',
    description: 'Traga um livro que você já leu e leve outro pra casa.',
    attendeeCount: 5,
    maybeCount: 3,
    capacityMode: 'goal',
    capacity: 10,
    goingIds: ['bia', 'ana', 'jorge'],
    tone: 'black',
  },
  {
    id: 'horta',
    comunaId: 'hortas',
    kind: 'Mutirão',
    title: 'Plantio no Jardim Helena',
    startsAt: nextWeekday(6, 8), // sábado
    place: 'Praça do Jd. Helena, SP',
    description: 'Mutirão de plantio de hortaliças na praça.',
    attendeeCount: 58,
    maybeCount: 7,
    goingIds: ['cida', 'jorge'],
    tone: 'black',
  },
  {
    id: 'cursinho',
    comunaId: 'cursinho',
    kind: 'Assembleia',
    title: 'Futuro do cursinho',
    startsAt: nextWeekday(1, 19), // segunda
    place: 'Associação do Ibura, Recife',
    description: 'Assembleia para decidir o calendário do próximo semestre.',
    attendeeCount: 31,
    maybeCount: 3,
    goingIds: ['ana', 'renato'],
    tone: 'cream',
  },
];
