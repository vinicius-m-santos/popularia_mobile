import type { Post } from '@/types/models';

/** Publicações fictícias do feed. */
export const posts: Post[] = [
  {
    id: 'tarifa',
    authorId: 'luana',
    comunaId: 'tarifa',
    createdAt: '2024-11-07T14:32:00-03:00',
    text: 'Assembleia de quinta decidiu: dia 14 tem ato na Praça Sete contra o aumento da passagem para R$ 6,25. A dúvida que ficou é se o abaixo-assinado pela tarifa zero entra junto ou fica para depois. Quero ouvir principalmente quem não conseguiu ir.',
    eventId: 'tarifa',
    supportCount: 1204,
    commentCount: 187,
    echoCount: 342,
    topComment: {
      authorId: 'rosangela',
      text: 'Trabalho até as 18h no Barro Preto. Dá pra fazer uma concentração mais tarde pra quem sai do serviço?',
    },
  },
  {
    id: 'horta',
    authorId: 'cida',
    comunaId: 'hortas',
    createdAt: '2024-11-07T12:05:00-03:00',
    text: 'Mutirão de domingo plantou 40 mudas de ora-pro-nóbis, couve e taioba na praça do Jardim Helena. Próximo encontro é dia 9, às 8h. Traz enxada se tiver, o café é por nossa conta.',
    images: [{ alt: 'mutirão na praça' }, { alt: 'mudas de ora-pro-nóbis' }],
    supportCount: 312,
    commentCount: 48,
    echoCount: 21,
    topComment: {
      authorId: 'jorge',
      text: 'Levo o carrinho de mão e as sementes crioulas que sobraram da troca.',
    },
  },
  {
    id: 'cursinho',
    authorId: 'renato',
    comunaId: 'cursinho',
    createdAt: '2024-11-07T10:18:00-03:00',
    text: 'Precisamos de duas pessoas para dar aula de química aos sábados de manhã, até o Enem. A turma tem 34 estudantes, quase todos trabalhando durante a semana. Material a gente tem, falta gente.',
    supportCount: 529,
    commentCount: 63,
    echoCount: 140,
  },
  {
    id: 'leitura',
    authorId: 'taina',
    comunaId: null,
    createdAt: '2024-11-07T08:00:00-03:00',
    text: 'Episódio novo no ar: por que a escala 6x1 virou pauta nacional e o que os números dizem sobre jornada, saúde e salário. Com duas trabalhadoras do comércio de Salvador.',
    media: { meta: 'Leitura Crítica · Ep. 42 · 38 min', title: 'Quem paga a conta da 6x1' },
    supportCount: 2140,
    commentCount: 96,
    echoCount: 610,
  },
];
