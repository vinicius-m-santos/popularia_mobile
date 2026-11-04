/**
 * Conteúdo dos documentos legais. A tela renderiza os blocos na ordem em que aparecem,
 * sem conhecer cada documento: adicionar um aviso novo é adicionar uma entrada aqui.
 */

export type LegalPathSegment =
  | { kind: 'chip'; text: string; danger?: boolean }
  | { kind: 'arrow' }
  | { kind: 'text'; text: string };

export type LegalBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'chips_no'; items: string[] }
  | { type: 'chips'; items: string[] }
  | { type: 'chips_private'; items: string[] }
  | { type: 'path'; label?: string; segments: LegalPathSegment[]; href?: string }
  | { type: 'notice'; text: string; icon?: 'info' | 'pin' }
  | { type: 'alert'; title?: string; text: string }
  | { type: 'highlight'; text: string }
  | { type: 'link_card'; text: string; target: string }
  | { type: 'badge_card'; badge: string; text: string };

export type LegalSection = { title: string; blocks: LegalBlock[] };

export type LegalSupportCard = { label: string; title: string };

export type LegalDocument = {
  title: string;
  intro: string;
  /** Origem exibida na barra fixa; o nome do documento não se repete nela. */
  backLabel: string;
  sections: LegalSection[];
  /** Rótulo e título do card final; o padrão é "Ficou com dúvida? / Fale com o suporte". */
  supportCard?: LegalSupportCard;
};

const DOCUMENTS: Record<string, LegalDocument> = {
  regras: {
    title: 'Regras da Comunidade',
    intro: 'Valem pra todo mundo, em todas as comunas, Praças e na Biblioteca.',
    backLabel: 'Sobre e legal',
    sections: [
      {
        title: 'Respeito',
        blocks: [
          { type: 'paragraph', text: 'Debata ideias sem atacar pessoas. Não aceitamos:' },
          {
            type: 'chips_no',
            items: ['Racismo', 'Discriminação', 'Desumanização', 'Propaganda nazista', 'Ameaças', 'Assédio', 'Perseguição', 'Incentivo à violência'],
          },
        ],
      },
      {
        title: 'Cuide do que é dos outros',
        blocks: [
          {
            type: 'list',
            items: [
              'Proteja dados pessoais, seus e de outras pessoas.',
              'Respeite autoria e licenças.',
              'Respeite o acesso de Comunas e documentos: o que é restrito fica restrito.',
            ],
          },
        ],
      },
      {
        title: 'Sem lixo',
        blocks: [
          { type: 'paragraph', text: 'Não envie spam, fraude, conteúdo ilegal ou arquivos maliciosos.' },
        ],
      },
      {
        title: 'Denúncia e bloqueio',
        blocks: [
          { type: 'paragraph', text: 'Use as ferramentas de denúncia e bloqueio de boa-fé.' },
          {
            type: 'path',
            label: 'No app:',
            segments: [
              { kind: 'chip', text: '···' },
              { kind: 'arrow' },
              { kind: 'chip', text: 'Denunciar' },
              { kind: 'text', text: 'ou' },
              { kind: 'chip', text: 'Bloquear' },
            ],
          },
        ],
      },
      {
        title: 'Regras de cada comuna',
        blocks: [
          { type: 'notice', text: 'Cada comuna pode ter **regras adicionais**, desde que sejam compatíveis com estas.' },
        ],
      },
    ],
  },

  termos: {
    title: 'Termos de Uso',
    intro: 'O Popularia reúne pessoas em perfis, Comunas, Praças e Bibliotecas. Este é o combinado pra usar.',
    backLabel: 'Sobre e legal',
    sections: [
      {
        title: 'Quem pode usar',
        blocks: [
          { type: 'badge_card', badge: '18+', text: 'O beta é destinado a **maiores de 18 anos**.' },
        ],
      },
      {
        title: 'Sua conta',
        blocks: [
          {
            type: 'list',
            items: [
              'Proteja suas credenciais: senha e códigos são só seus.',
              'Use apenas identidades que você controla.',
            ],
          },
        ],
      },
      {
        title: 'Seu conteúdo',
        blocks: [
          { type: 'highlight', text: 'O que você publica continua seu.' },
          { type: 'paragraph', text: 'Você continua titular dos direitos do seu conteúdo. Ao publicar, autoriza o Popularia, de forma limitada, a operar o serviço e mostrar o conteúdo às pessoas autorizadas.' },
        ],
      },
      {
        title: 'Moderação',
        blocks: [
          { type: 'paragraph', text: 'Podemos remover conteúdo ou restringir contas pra proteger a comunidade.' },
          { type: 'link_card', text: 'Ler as Regras da Comunidade', target: 'regras' },
        ],
      },
      {
        title: 'Excluir sua conta',
        blocks: [
          { type: 'paragraph', text: 'Você pode excluir sua conta quando quiser, pelo aplicativo:' },
          {
            type: 'path',
            segments: [
              { kind: 'chip', text: 'Conta' },
              { kind: 'arrow' },
              { kind: 'chip', text: 'Excluir conta', danger: true },
            ],
            href: '/conta/exclusao',
          },
          { type: 'link_card', text: 'Como tratamos seus dados', target: 'privacidade' },
        ],
      },
    ],
    supportCard: { label: 'Ficou com dúvida?', title: 'Fale com o suporte' },
  },

  privacidade: {
    title: 'Política de Privacidade',
    intro: 'O que a gente guarda sobre você, pra quê, e o que você pode pedir.',
    backLabel: 'Sobre e legal',
    sections: [
      {
        title: 'O que tratamos',
        blocks: [
          { type: 'chips', items: ['E-mail', 'Identificador', 'Nome', '@', 'Bio', 'Endereço declarado', 'Interesses', 'Preferências'] },
          { type: 'list', items: ['Sua senha é guardada como hash: nem a gente consegue ler.'] },
          { type: 'notice', icon: 'pin', text: '**Não usamos GPS pra descobrir sua cidade.** Vale o endereço que você declara.' },
        ],
      },
      {
        title: 'Pra que usamos',
        blocks: [
          {
            type: 'list',
            items: ['Criar sua conta', 'Organizar seu perfil', 'Recomendar conteúdo', 'Controlar quem acessa o quê'],
          },
        ],
      },
      {
        title: 'O que fica só com você',
        blocks: [
          { type: 'paragraph', text: 'Não aparecem no seu perfil público:' },
          { type: 'chips_private', items: ['E-mail', 'Senha', 'Interesses', 'Sessões', 'Bloqueios'] },
          { type: 'paragraph', text: 'O que você publica em **Comunas e Praças** segue as permissões de cada espaço.' },
        ],
      },
      {
        title: 'Seus direitos',
        blocks: [
          { type: 'paragraph', text: 'Pelo suporte, você pode pedir acesso, correção, informação, eliminação ou revisão dos seus dados.' },
          { type: 'paragraph', text: 'Pra excluir a conta:' },
          {
            type: 'path',
            segments: [
              { kind: 'chip', text: 'Conta' },
              { kind: 'arrow' },
              { kind: 'chip', text: 'Excluir conta', danger: true },
            ],
            href: '/conta/exclusao',
          },
          { type: 'alert', title: 'Nunca envie senha ou token ao suporte.', text: 'A gente nunca pede.' },
        ],
      },
    ],
    supportCard: { label: 'Quer pedir algo sobre seus dados?', title: 'Fale com o suporte' },
  },
};

export function getLegalDocument(id: string): LegalDocument | undefined {
  return DOCUMENTS[id];
}
