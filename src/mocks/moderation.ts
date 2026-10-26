import type { ModerationLogEntry } from '@/types/models';

import { daysAgo, hoursAgo } from './time';

export type ReportMock = {
  id: string;
  comunaId: string;
  reason: string;
  reportCount: number;
  authorId: string;
  where: string;
  text: string;
  note?: string;
  createdAt: string;
};

/** Denúncias fictícias aguardando a moderação do Cursinho (2k). */
export const reports: ReportMock[] = [
  {
    id: 'q1',
    comunaId: 'cursinho',
    reason: 'Desinformação',
    reportCount: 4,
    authorId: 'rafa',
    where: 'Comentário em “Simulado do sábado”',
    text: 'O Enem vai acabar ano que vem, o governo já decidiu. Nem adianta estudar.',
    note: 'Isso não é verdade e está assustando estudantes.',
    createdAt: hoursAgo(2),
  },
  {
    id: 'q2',
    comunaId: 'cursinho',
    reason: 'Ataque pessoal',
    reportCount: 2,
    authorId: 'gus',
    where: 'Comentário em “Precisamos de duas pessoas…”',
    text: 'Voluntário que some devia ter vergonha. A professora Ana sumiu de novo, típico.',
    note: 'Expôs uma voluntária pelo nome.',
    createdAt: hoursAgo(5),
  },
  {
    id: 'q3',
    comunaId: 'cursinho',
    reason: 'Spam ou golpe',
    reportCount: 6,
    authorId: 'spam',
    where: 'Publicação',
    text: 'APOSTILA COMPLETA ENEM POR R$ 19,90!!! Chama no zap e garanta sua vaga.',
    createdAt: hoursAgo(6),
  },
];

/** Registro de decisões já tomadas pela moderação do Cursinho. */
export const moderationLog: Record<string, ModerationLogEntry[]> = {
  cursinho: [
    { id: 'l1', createdAt: daysAgo(1), text: 'Ana Kariri removeu um comentário por discurso de ódio.' },
    { id: 'l2', createdAt: daysAgo(4), text: 'Renato Assis silenciou @contafake22 por 24 horas.' },
    { id: 'l3', createdAt: daysAgo(6), text: 'Regra 02 atualizada após votação aberta (61 votos).' },
    { id: 'l4', createdAt: daysAgo(10), text: 'Camila Rocha manteve uma publicação denunciada por engano.' },
  ],
};
