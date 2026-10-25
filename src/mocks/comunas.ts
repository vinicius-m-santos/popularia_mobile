import type { Comuna } from '@/types/models';

/** Comunas fictícias. */
export const comunas: Comuna[] = [
  {
    id: 'hortas',
    name: 'Hortas da Zona Leste',
    handle: 'hortaszl',
    initials: 'HZ',
    tone: 'red',
    place: 'São Paulo · SP',
    description:
      'Rede de hortas comunitárias da Zona Leste. Organizamos mutirões, trocas de mudas e oficinas de compostagem em praças e terrenos ociosos.',
    memberCount: 2418,
    topics: ['clima', 'comun', 'saude'],
  },
  {
    id: 'tarifa',
    name: 'Tarifa Zero BH',
    handle: 'tarifazerobh',
    initials: 'TZ',
    tone: 'black',
    place: 'Belo Horizonte · MG',
    description:
      'Movimento pelo transporte público gratuito e de qualidade em Belo Horizonte e região metropolitana. Ônibus é direito, não mercadoria.',
    memberCount: 11600,
    topics: ['pol', 'eco', 'comun'],
  },
  {
    id: 'cursinho',
    name: 'Cursinho Popular Carolina',
    handle: 'cursinhocarolina',
    initials: 'CC',
    tone: 'cream',
    place: 'Recife · PE',
    description:
      'Cursinho pré-vestibular gratuito para estudantes de escola pública. Aulas aos sábados na associação de moradores do Ibura e reforço online.',
    memberCount: 846,
    topics: ['edu', 'comun', 'anti'],
  },
];
