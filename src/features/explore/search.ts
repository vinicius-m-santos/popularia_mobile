import type { Comuna, ExploreFilter, FeedItem, Profile, Topic } from '@/types/models';

import type { ExploreData } from './api';

export type ExploreResults = {
  comunas: Comuna[];
  people: Profile[];
  topics: Topic[];
  posts: FeedItem[];
};

/** Ignora maiúsculas e acentos: "varzea" encontra "Várzea Viva". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Busca local no índice do Explorar. Sem termo, devolve tudo (para os filtros). */
export function searchExplore(data: ExploreData, query: string): ExploreResults {
  const q = normalize(query.trim());
  const has = (text: string | undefined) => !q || normalize(text ?? '').includes(q);
  const topicLabel = (id: string) => data.topics.find((t) => t.id === id)?.label;

  return {
    comunas: data.comunas.filter(
      (c) => has(c.name) || has(c.description) || c.topics.some((t) => has(topicLabel(t))),
    ),
    people: data.people.filter((p) => has(p.user.name) || has(p.user.handle)),
    topics: data.topics.filter((t) => has(t.label)),
    posts: [...data.posts]
      .filter((p) => has(p.text))
      .sort((a, b) => b.supportCount - a.supportCount),
  };
}

/** Quantos itens cada seção mostra: no filtro "Tudo", uma amostra; nos demais, tudo. */
export function sectionLimit(filter: ExploreFilter, section: Exclude<ExploreFilter, 'tudo'>): number {
  if (filter === 'tudo') return section === 'assuntos' ? 6 : 3;
  return filter === section ? Infinity : 0;
}
