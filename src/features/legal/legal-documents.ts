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
  | { type: 'path'; label: string; segments: LegalPathSegment[] }
  | { type: 'notice'; text: string }
  | { type: 'alert'; title?: string; text: string }
  | { type: 'highlight'; text: string }
  | { type: 'link_card'; label: string; documentId: string };

export type LegalSection = { title: string; blocks: LegalBlock[] };

export type LegalDocument = {
  title: string;
  intro: string;
  /** Origem exibida na barra fixa; o nome do documento não se repete nela. */
  backLabel: string;
  sections: LegalSection[];
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
    intro: 'O que você pode esperar do Popularia e o que o Popularia espera de você.',
    backLabel: 'Sobre e legal',
    sections: [
      {
        title: 'O que é a Popularia',
        blocks: [
          { type: 'paragraph', text: 'O Popularia reúne pessoas em perfis, Comunas, Praças e Bibliotecas. O beta é destinado a maiores de 18 anos.' },
          {
            type: 'list',
            items: [
              'Proteja suas credenciais e use apenas identidades que você controla.',
              'Sua conta é pessoal: não compartilhe o acesso com outras pessoas.',
            ],
          },
        ],
      },
      {
        title: 'Seu conteúdo',
        blocks: [
          { type: 'paragraph', text: 'Você continua titular dos direitos do que publica.' },
          { type: 'highlight', text: 'Seu conteúdo é seu. O Popularia só mostra o que você autoriza.' },
          { type: 'paragraph', text: 'Ao publicar, você concede ao Popularia autorização limitada para operar o serviço e mostrar o conteúdo às pessoas autorizadas.' },
        ],
      },
      {
        title: 'Convivência',
        blocks: [
          { type: 'paragraph', text: 'As regras valem em qualquer espaço do app, inclusive nas comunas e na Biblioteca.' },
          { type: 'link_card', label: 'Ler as Regras da Comunidade', documentId: 'regras' },
        ],
      },
      {
        title: 'Conta e encerramento',
        blocks: [
          { type: 'paragraph', text: 'Podemos remover conteúdo ou restringir contas para proteger a comunidade.' },
          { type: 'alert', title: 'Excluir a conta é definitivo', text: 'A exclusão apaga seu perfil, suas publicações e seus documentos pessoais. A ação não pode ser desfeita.' },
          { type: 'paragraph', text: 'A Política de Privacidade explica o tratamento dos dados e como pedir revisão.' },
          { type: 'link_card', label: 'Ler a Política de Privacidade', documentId: 'privacidade' },
        ],
      },
      {
        title: 'Mudanças nestas regras',
        blocks: [
          { type: 'notice', text: 'Se estes termos mudarem, avisamos no app antes de valerem.' },
        ],
      },
    ],
  },

  privacidade: {
    title: 'Política de Privacidade',
    intro: 'O que guardamos, por quê e o que fica fora do alcance de outras pessoas.',
    backLabel: 'Sobre e legal',
    sections: [
      {
        title: 'O que tratamos',
        blocks: [
          { type: 'paragraph', text: 'Tratamos os dados necessários para criar a conta, organizar o perfil e controlar acessos:' },
          { type: 'chips', items: ['E-mail', 'Nome', '@', 'Bio', 'Endereço declarado', 'Interesses'] },
        ],
      },
      {
        title: 'O que não é público',
        blocks: [
          { type: 'chips_private', items: ['E-mail', 'Senha', 'Interesses', 'Sessões', 'Bloqueios'] },
          { type: 'paragraph', text: 'A senha é armazenada como hash. Não usamos GPS para obter sua cidade.' },
        ],
      },
      {
        title: 'Como usamos',
        blocks: [
          {
            type: 'list',
            items: [
              'Recomendar conteúdo, pessoas e comunas.',
              'Controlar acessos e proteger a conta.',
              'Enviar avisos sobre o próprio serviço.',
            ],
          },
        ],
      },
      {
        title: 'Seus direitos',
        blocks: [
          { type: 'paragraph', text: 'Você pode pedir acesso, correção, informação, eliminação ou revisão pelo suporte.' },
          {
            type: 'path',
            label: 'No app:',
            segments: [
              { kind: 'chip', text: 'Conta' },
              { kind: 'arrow' },
              { kind: 'chip', text: 'Excluir conta', danger: true },
            ],
          },
          { type: 'paragraph', text: 'Não envie senha ou token ao suporte.' },
        ],
      },
      {
        title: 'Segurança',
        blocks: [
          { type: 'alert', title: 'Ninguém do Popularia pede sua senha', text: 'Não compartilhe senha, código de recuperação ou token — nem com quem diz ser do suporte.' },
        ],
      },
    ],
  },
};

export function getLegalDocument(id: string): LegalDocument | undefined {
  return DOCUMENTS[id];
}
