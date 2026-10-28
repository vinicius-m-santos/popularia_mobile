import type { Comuna } from '@/types/models';

/** Regras, aviso fixado e nota de moderação comuns às comunas sem texto próprio. */
const DEFAULTS = {
  foundedYear: '2022',
  moderationNote:
    'A moderação acompanha as regras da comuna. Viu algo fora delas? Toque em ⋯ na publicação e escolha Denunciar.',
  pinned: { title: 'Boas-vindas à comuna', text: 'Leia as regras e se apresente nos comentários deste post.' },
  rules: [
    {
      title: 'Respeito sempre',
      description: 'Racismo, machismo, LGBTfobia e ataques pessoais levam a remoção e banimento.',
    },
    { title: 'Fique no tema', description: 'Publicações precisam ter relação com o propósito da comuna.' },
    {
      title: 'Informação com fonte',
      description: 'Dados e notícias precisam de link ou origem. Boatos são removidos.',
    },
  ],
  founderRole: 'Fundação · Moderação',
} satisfies Partial<Comuna>;

/** Comunas fictícias. */
export const comunas: Comuna[] = [
  {
    id: 'hortas',
    name: 'Hortas da Zona Leste',
    handle: 'hortaszl',
    initials: 'HZ',
    tone: 'red',
    place: 'São Paulo · SP',
    foundedYear: '2023',
    description:
      'Rede de hortas comunitárias da Zona Leste. Organizamos mutirões, trocas de mudas e oficinas de compostagem em praças e terrenos ociosos.',
    memberCount: 2418,
    onlineCount: 37,
    coverAlt: 'mutirão na horta da praça',
    topics: ['clima', 'comun', 'saude'],
    stats: [
      { value: '2.418', label: 'Membros' },
      { value: '4', label: 'Chamados' },
      { value: '19', label: 'Hortas ativas' },
    ],
    pinned: {
      title: 'Calendário de mutirões do mês',
      text: 'Um sábado no Jardim Helena, o seguinte no Itaim Paulista e o outro em São Miguel. Sempre às 8h, com café coletivo.',
    },
    moderationNote:
      'A moderação acompanha as regras da comuna. Viu algo fora delas? Toque em ⋯ na publicação e escolha Denunciar.',
    rules: [
      {
        title: 'Território e alimento',
        description: 'Publicações sobre hortas, alimentação, compostagem e uso dos espaços do bairro.',
      },
      {
        title: 'Respeito sempre',
        description: 'Racismo, machismo, LGBTfobia e ataques pessoais levam a remoção e banimento.',
      },
      {
        title: 'Sem propaganda',
        description:
          'Nada de venda de agrotóxico ou divulgação de empresas. Troca e doação são bem-vindas.',
      },
      {
        title: 'Decisões coletivas',
        description: 'Mudanças nas regras e no uso do caixa passam por votação aberta na comuna.',
      },
    ],
    moderatorIds: ['cida', 'jorge'],
    founderRole: 'Fundadora · Moderação',
    featuredMemberIds: ['ana', 'bia', 'edu', 'jorge'],
  },
  {
    id: 'tarifa',
    name: 'Tarifa Zero BH',
    handle: 'tarifazerobh',
    initials: 'TZ',
    tone: 'black',
    place: 'Belo Horizonte · MG',
    foundedYear: '2019',
    description:
      'Movimento pelo transporte público gratuito e de qualidade em Belo Horizonte e região metropolitana. Ônibus é direito, não mercadoria.',
    memberCount: 11600,
    onlineCount: 214,
    coverAlt: 'ato na Praça Sete',
    topics: ['pol', 'eco', 'comun'],
    stats: [
      { value: '11,6 mil', label: 'Membros' },
      { value: '2', label: 'Chamados' },
      { value: '38', label: 'Bairros' },
    ],
    pinned: {
      title: 'Como funciona o abaixo-assinado',
      text: 'Projeto de iniciativa popular precisa de assinaturas de 5% do eleitorado da cidade. Leia antes de colher.',
    },
    moderationNote:
      'A moderação é escolhida em assembleia a cada seis meses. Viu algo fora das regras? Toque em ⋯ na publicação e escolha Denunciar.',
    rules: [
      {
        title: 'Foco no transporte',
        description: 'Tarifa, linhas, horários, acessibilidade e mobilidade na região metropolitana.',
      },
      {
        title: 'Sem ataques pessoais',
        description: 'Discorde da ideia, não da pessoa. Discurso de ódio leva a banimento.',
      },
      {
        title: 'Informação com fonte',
        description: 'Dados e notícias precisam de link ou origem. Boatos são removidos.',
      },
    ],
    moderatorIds: ['pula', 'luana'],
    founderRole: 'Coletivo fundador · Moderação',
    featuredMemberIds: ['marcos', 'jessica', 'tiago', 'rosangela'],
  },
  {
    id: 'cursinho',
    name: 'Cursinho Popular Carolina',
    handle: 'cursinhocarolina',
    initials: 'CC',
    tone: 'cream',
    place: 'Recife · PE',
    foundedYear: '2021',
    description:
      'Cursinho pré-vestibular gratuito para estudantes de escola pública. Aulas aos sábados na associação de moradores do Ibura.',
    memberCount: 846,
    onlineCount: 12,
    coverAlt: 'sala de aula na associação',
    topics: ['edu', 'comun', 'anti'],
    stats: [
      { value: '846', label: 'Membros' },
      { value: '1', label: 'Chamado' },
      { value: '34', label: 'Estudantes' },
    ],
    pinned: {
      title: 'Escala de aulas do mês',
      text: 'Planilha com horários e substituições. Avise com 48h se precisar trocar.',
    },
    moderationNote:
      'A coordenação cuida das regras e do ambiente da comuna. Use ⋯ para denunciar.',
    rules: [
      { title: 'Estudantes primeiro', description: 'Dúvidas de estudantes têm prioridade de resposta.' },
      { title: 'Sem venda de material', description: 'Material é compartilhado de graça, sempre.' },
      { title: 'Respeito', description: 'Discriminação de qualquer tipo leva a remoção.' },
    ],
    // A pessoa logada (Camila) também modera esta comuna, como no design (2k).
    moderatorIds: ['renato', 'ana', 'me'],
    founderRole: 'Coordenação',
    featuredMemberIds: ['ana', 'edu', 'bia', 'renato'],
  },
  {
    ...DEFAULTS,
    id: 'entregadores',
    name: 'Entregadores em Luta SP',
    handle: 'entregadoresemluta',
    initials: 'EL',
    tone: 'black',
    place: 'São Paulo · SP',
    description:
      'Organização de entregadores por aplicativo. Tabela de taxas, pontos de apoio, assessoria jurídica e mobilização por direitos.',
    memberCount: 5200,
    onlineCount: 88,
    coverAlt: 'ponto de apoio na avenida',
    topics: ['trab', 'sind', 'eco'],
    stats: [
      { value: '5,2 mil', label: 'Membros' },
      { value: '3', label: 'Chamados' },
      { value: '88', label: 'Online agora' },
    ],
    moderatorIds: ['edu', 'jorge'],
    featuredMemberIds: ['edu', 'rafa', 'marcos', 'jorge'],
  },
  {
    ...DEFAULTS,
    id: 'sus',
    name: 'SUS é Nosso',
    handle: 'susenosso',
    initials: 'SN',
    tone: 'red',
    place: 'Brasil',
    description:
      'Profissionais e usuários do SUS trocando informação, defendendo o sistema público e acompanhando o orçamento da saúde.',
    memberCount: 8900,
    onlineCount: 120,
    coverAlt: 'fila na UBS',
    topics: ['saude', 'pol'],
    stats: [
      { value: '8,9 mil', label: 'Membros' },
      { value: '2', label: 'Chamados' },
      { value: '120', label: 'Online agora' },
    ],
    moderatorIds: ['rosangela', 'ana'],
    featuredMemberIds: ['rosangela', 'ana', 'bia', 'tiago'],
  },
  {
    ...DEFAULTS,
    id: 'leitura',
    name: 'Leituras da Quebrada',
    handle: 'leiturasdaquebrada',
    initials: 'LQ',
    tone: 'cream',
    place: 'Salvador · BA',
    description:
      'Clube de leitura com encontros mensais na biblioteca comunitária e online. Este mês: “Torto Arado”.',
    memberCount: 3104,
    onlineCount: 41,
    coverAlt: 'roda de leitura na biblioteca',
    topics: ['livros', 'hist', 'cult', 'anti'],
    stats: [
      { value: '3.104', label: 'Membros' },
      { value: '1', label: 'Chamado' },
      { value: '41', label: 'Online agora' },
    ],
    moderatorIds: ['bia', 'taina'],
    featuredMemberIds: ['bia', 'taina', 'ana', 'edu'],
  },
  {
    ...DEFAULTS,
    id: 'jogatina',
    name: 'Jogatina Coletiva',
    handle: 'jogatina',
    initials: 'JC',
    tone: 'black',
    place: 'Online',
    description:
      'Games, indies brasileiros e partidas de fim de semana. Comunidade sem toxicidade, com moderação ativa.',
    memberCount: 1977,
    onlineCount: 63,
    coverAlt: 'campeonato de fim de semana',
    topics: ['games', 'tec', 'humor'],
    stats: [
      { value: '1.977', label: 'Membros' },
      { value: '1', label: 'Chamado' },
      { value: '63', label: 'Online agora' },
    ],
    moderatorIds: ['jorge', 'tiago'],
    featuredMemberIds: ['jorge', 'edu', 'tiago', 'bia'],
  },
  {
    ...DEFAULTS,
    id: 'varzea',
    name: 'Várzea Viva',
    handle: 'varzeaviva',
    initials: 'VV',
    tone: 'red',
    place: 'Rio de Janeiro · RJ',
    description:
      'Futebol de várzea, campeonatos de bairro e a luta pelos campos públicos que ainda restam na cidade.',
    memberCount: 4410,
    onlineCount: 52,
    coverAlt: 'jogo no campo do bairro',
    topics: ['esp', 'comun'],
    stats: [
      { value: '4.410', label: 'Membros' },
      { value: '2', label: 'Chamados' },
      { value: '52', label: 'Online agora' },
    ],
    moderatorIds: ['marcos', 'pedro'],
    featuredMemberIds: ['marcos', 'pedro', 'jorge', 'edu'],
  },
  {
    ...DEFAULTS,
    id: 'aurora',
    name: 'Coletivo Aurora',
    handle: 'coletivoaurora',
    initials: 'CA',
    tone: 'cream',
    place: 'Porto Alegre · RS',
    description:
      'Acolhimento, cultura e direitos da população LGBTQIA+. Rodas de conversa, festas e orientação jurídica gratuita.',
    memberCount: 2730,
    onlineCount: 33,
    coverAlt: 'roda de conversa',
    topics: ['lgbt', 'fem', 'cult'],
    stats: [
      { value: '2.730', label: 'Membros' },
      { value: '1', label: 'Chamado' },
      { value: '33', label: 'Online agora' },
    ],
    moderatorIds: ['ana', 'jessica'],
    featuredMemberIds: ['ana', 'bia', 'jessica', 'edu'],
  },
];
