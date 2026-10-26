import type { Comment } from '@/types/models';

import { hoursAgo, minutesAgo } from './time';

/** Comentários fictícios em lista plana; `parentId` forma as respostas. */
export const comments: Comment[] = [
  // Tarifa Zero
  { id: 't1', postId: 'tarifa', parentId: null, authorId: 'marcos', createdAt: hoursAgo(1), supportCount: 214, text: 'Eu fui na assembleia. A proposta é levar o abaixo-assinado impresso pro ato e colher assinatura ali mesmo. Uma coisa puxa a outra.' },
  { id: 't11', postId: 'tarifa', parentId: 't1', authorId: 'luana', createdAt: minutesAgo(58), supportCount: 96, text: 'Isso! Quem topa ficar numa banca de assinaturas? Preciso de umas dez pessoas revezando.' },
  { id: 't111', postId: 'tarifa', parentId: 't11', authorId: 'jessica', createdAt: minutesAgo(40), supportCount: 41, text: 'Eu topo. Levo prancheta e caneta, e chamo o pessoal do coletivo do Barreiro.' },
  { id: 't12', postId: 'tarifa', parentId: 't1', authorId: 'tiago', createdAt: minutesAgo(52), supportCount: 132, text: 'Só lembrando: para valer como iniciativa popular, cada assinatura precisa do número do título de eleitor. Vale explicar isso na banca.' },
  { id: 't2', postId: 'tarifa', parentId: null, authorId: 'rosangela', createdAt: minutesAgo(61), supportCount: 388, text: 'Trabalho até as 18h no Barro Preto. Dá pra fazer uma concentração mais tarde pra quem sai do serviço? Muita gente que mais precisa da tarifa zero não chega às 17h.' },
  { id: 't21', postId: 'tarifa', parentId: 't2', authorId: 'pula', createdAt: minutesAgo(45), supportCount: 157, text: 'Boa, Rosângela. Vamos propor uma segunda concentração às 18h30 na Estação Central, com caminhada até a Praça Sete.' },
  { id: 't3', postId: 'tarifa', parentId: null, authorId: 'pedro', createdAt: minutesAgo(38), supportCount: 176, text: 'Abaixo-assinado sozinho a prefeitura engaveta, e ato sem proposta concreta vira só foto. Precisamos dos dois e de uma data para audiência pública na Câmara.' },
  // Hortas
  { id: 'h1', postId: 'horta', parentId: null, authorId: 'jorge', createdAt: hoursAgo(3), supportCount: 27, text: 'Levo o carrinho de mão e as sementes crioulas que sobraram da troca.' },
  { id: 'h11', postId: 'horta', parentId: 'h1', authorId: 'cida', createdAt: hoursAgo(2), supportCount: 12, text: 'Ótimo, Jorge! As crioulas vão pro canteiro perto do muro, que pega sol a manhã toda.' },
  { id: 'h2', postId: 'horta', parentId: null, authorId: 'bia', createdAt: minutesAgo(170), supportCount: 19, text: 'Alguém tem muda de taioba sobrando? Quero começar um canteiro na escola onde trabalho.' },
  // Cursinho
  { id: 'c1', postId: 'cursinho', parentId: null, authorId: 'ana', createdAt: hoursAgo(5), supportCount: 44, text: 'Sou formada em farmácia e posso dar aula a partir de dezembro. Me avisa como combinamos os horários.' },
  { id: 'c11', postId: 'cursinho', parentId: 'c1', authorId: 'renato', createdAt: hoursAgo(4), supportCount: 9, text: 'Maravilha, Ana. Coloquei o cronograma no post fixado da comuna.' },
  // Leitura Crítica
  { id: 'l1', postId: 'leitura', parentId: null, authorId: 'rosangela', createdAt: hoursAgo(7), supportCount: 120, text: 'Ouvi no ônibus voltando do trabalho. A parte sobre a folga de domingo a cada sete semanas é a minha vida.' },
  { id: 'l2', postId: 'leitura', parentId: null, authorId: 'marcos', createdAt: hoursAgo(6), supportCount: 58, text: 'Coloca as fontes na descrição? Quero levar pro meu sindicato.' },
  { id: 'l21', postId: 'leitura', parentId: 'l2', authorId: 'taina', createdAt: minutesAgo(355), supportCount: 73, text: 'Já estão lá, Marcos. Tem também o PDF com os gráficos.' },
];
