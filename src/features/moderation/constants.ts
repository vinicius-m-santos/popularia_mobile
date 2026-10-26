/** Motivos de denúncia (design 2h). */
export const REPORT_REASONS = [
  'Discurso de ódio ou discriminação',
  'Assédio ou ataque pessoal',
  'Desinformação',
  'Ameaça ou incitação à violência',
  'Spam, golpe ou propaganda',
  'Exposição de dados pessoais',
  'Fere as regras da comuna',
] as const;

export const DETAILS_MAX_LENGTH = 500;

export type RestrictionId = 'mute' | 'suspend' | 'ban';

/** Restrições que a moderação pode aplicar (design 2k). */
export const RESTRICTIONS: { id: RestrictionId; title: string; description: string; result: string }[] = [
  {
    id: 'mute',
    title: 'Silenciar por 24 horas',
    description: 'Pode ler, mas não publica nem comenta.',
    result: 'Silenciado por 24 horas',
  },
  {
    id: 'suspend',
    title: 'Suspender por 7 dias',
    description: 'Perde o acesso à comuna durante o período.',
    result: 'Suspenso por 7 dias',
  },
  {
    id: 'ban',
    title: 'Remover da comuna',
    description: 'Pode pedir revisão à moderação em 30 dias.',
    result: 'Removido da comuna',
  },
];
