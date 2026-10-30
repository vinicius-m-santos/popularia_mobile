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

/** Motivos da denúncia de publicação, comentário, perfil e comuna. O código vai para a API. */
export const CONTENT_REPORT_REASONS = [
  { code: 'harassment', label: 'Assédio ou intimidação' },
  { code: 'hate', label: 'Discurso de ódio ou preconceito' },
  { code: 'threat', label: 'Ameaça ou violência' },
  { code: 'spam', label: 'Spam' },
  { code: 'fraud', label: 'Golpe ou fraude' },
  { code: 'sexual', label: 'Conteúdo sexual impróprio' },
  { code: 'doxxing', label: 'Exposição de dados pessoais' },
  { code: 'illegal', label: 'Conteúdo ilegal' },
  { code: 'other', label: 'Outro' },
] as const;

export type ContentReportReasonCode = (typeof CONTENT_REPORT_REASONS)[number]['code'];

export const DETAILS_MAX_LENGTH = 800;

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
