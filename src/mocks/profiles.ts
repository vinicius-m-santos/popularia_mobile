import type { CreatorInfo, ProfileStat } from '@/types/models';

type ProfileMock = {
  bio: string;
  meta: string;
  summary: string;
  stats: ProfileStat[];
  comunaIds: string[];
  creator?: CreatorInfo;
};

/**
 * Perfis com bio e números. Pessoas sem entrada aqui recebem um perfil genérico.
 * O perfil da própria pessoa ("me") vem do cadastro local, ver `features/account`.
 */
export const profiles: Record<string, ProfileMock> = {
  me: {
    bio: 'Professora de redação, mãe da Lia e usuária diária do 4110. Escrevo sobre transporte, educação e direito à cidade.',
    meta: 'na Popularia desde mar 2025',
    summary: 'Professora de redação',
    stats: [
      { value: '312', label: 'Seguidores' },
      { value: '1,8 mil', label: 'Apoios recebidos' },
    ],
    comunaIds: [],
  },
  taina: {
    bio: 'Apresento o Leitura Crítica, podcast semanal sobre trabalho, economia e cultura popular. Uma pauta por semana, explicada sem economês.',
    meta: 'Salvador · BA · criadora desde 2024',
    summary: 'Criadora · podcast Leitura Crítica',
    stats: [
      { value: '48,2 mil', label: 'Seguidores' },
      { value: '42', label: 'Episódios' },
      { value: '96 mil', label: 'Apoios' },
    ],
    comunaIds: ['leitura', 'entregadores', 'sus'],
    creator: {
      mastheadKicker: 'Podcast · toda quinta',
      mastheadTitle: 'Leitura Crítica',
      mastheadLeft: 'Ep. 42 no ar',
      mastheadRight: 'Salvador · BA',
      episodes: [
        { number: '42', title: 'Quem paga a conta da 6x1', meta: '38 min · esta semana' },
        { number: '41', title: 'O preço do arroz, explicado', meta: '44 min · 1 sem' },
        { number: '40', title: 'Plataformas e o novo chão de fábrica', meta: '51 min · 2 sem' },
        { number: '39', title: 'Cultura popular não é nicho', meta: '36 min · 3 sem' },
      ],
    },
  },
  pula: {
    bio: 'Coletivo pela tarifa zero em BH desde 2019. Dados abertos, atos e muita planilha.',
    meta: 'Belo Horizonte · MG · desde 2019',
    summary: 'Coletivo · Tarifa Zero BH',
    stats: [
      { value: '9,4 mil', label: 'Seguidores' },
      { value: '318', label: 'Publicações' },
      { value: '1', label: 'Comuna' },
    ],
    comunaIds: ['tarifa'],
  },
  cida: {
    bio: 'Avó, cozinheira e jardineira de praça. Fundadora das Hortas da Zona Leste.',
    meta: 'São Paulo · SP · desde 2023',
    summary: 'Fundadora · Hortas da Zona Leste',
    stats: [
      { value: '3,1 mil', label: 'Seguidores' },
      { value: '204', label: 'Publicações' },
      { value: '2', label: 'Comunas' },
    ],
    comunaIds: ['hortas', 'sus'],
  },
  renato: {
    bio: 'Professor de química da rede estadual e coordenador do Cursinho Popular Carolina.',
    meta: 'Recife · PE · desde 2021',
    summary: 'Professor · Cursinho Carolina',
    stats: [
      { value: '1,4 mil', label: 'Seguidores' },
      { value: '96', label: 'Publicações' },
      { value: '2', label: 'Comunas' },
    ],
    comunaIds: ['cursinho', 'sus'],
  },
};

/** Pessoas e criadores em destaque no Explorar. */
export const featuredPeopleIds = ['taina', 'pula', 'cida', 'renato'];
