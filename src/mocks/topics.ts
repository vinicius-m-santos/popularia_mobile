import type { TopicGroup, TopicId, Trend } from '@/types/models';

/** Assuntos da escolha de interesses, agrupados como no design (2b). */
export const topicGroups: TopicGroup[] = [
  {
    title: 'Política e direitos',
    topics: [
      { id: 'pol', label: 'Política brasileira', shortLabel: 'Política' },
      { id: 'trab', label: 'Trabalho e direitos trabalhistas', shortLabel: 'Trabalho' },
      { id: 'sind', label: 'Sindicatos e organização popular', shortLabel: 'Sindicatos' },
      { id: 'eco', label: 'Economia e desigualdade', shortLabel: 'Economia' },
      { id: 'fem', label: 'Feminismo', shortLabel: 'Feminismo' },
      { id: 'anti', label: 'Antirracismo', shortLabel: 'Antirracismo' },
      { id: 'lgbt', label: 'Direitos LGBTQIA+', shortLabel: 'LGBTQIA+' },
    ],
  },
  {
    title: 'Bem comum',
    topics: [
      { id: 'edu', label: 'Educação', shortLabel: 'Educação' },
      { id: 'saude', label: 'Saúde pública', shortLabel: 'Saúde' },
      { id: 'clima', label: 'Meio ambiente e clima', shortLabel: 'Clima' },
      { id: 'comun', label: 'Projetos comunitários e voluntariado', shortLabel: 'Comunitário' },
    ],
  },
  {
    title: 'Cultura e ideias',
    topics: [
      { id: 'cult', label: 'Cultura, música e arte', shortLabel: 'Cultura' },
      { id: 'hist', label: 'História e filosofia', shortLabel: 'História' },
      { id: 'livros', label: 'Livros e clubes de leitura', shortLabel: 'Livros' },
      { id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' },
    ],
  },
  {
    title: 'Dia a dia',
    topics: [
      { id: 'games', label: 'Games', shortLabel: 'Games' },
      { id: 'esp', label: 'Esportes', shortLabel: 'Esportes' },
      { id: 'humor', label: 'Humor e cotidiano', shortLabel: 'Humor' },
    ],
  },
];

/** Interesses do perfil de demonstração, usados por quem entra sem fazer o cadastro. */
export const demoInterests: TopicId[] = ['pol', 'edu', 'trab', 'livros'];

/** Assuntos em destaque no Explorar (2e). */
export const trends: Trend[] = [
  { label: 'Escala 6x1', postCountLabel: '4,8 mil publicações', query: '6x1', tone: 'red' },
  { label: 'Tarifa zero', postCountLabel: '2,1 mil publicações', query: 'tarifa', tone: 'black' },
  { label: 'Enem', postCountLabel: '1,6 mil publicações', query: 'enem', tone: 'cream' },
  { label: 'Campos de várzea', postCountLabel: '870 publicações', query: 'várzea', tone: 'black' },
];
