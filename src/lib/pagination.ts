/** Página de uma lista com paginação por cursor, já convertida para os modelos do app. */
export type Page<T> = { items: T[]; nextCursor: string | null };

/** Página única, para os mocks (que não paginam). */
export function singlePage<T>(items: T[]): Page<T> {
  return { items, nextCursor: null };
}

/**
 * Junta listas sem repetir IDs, mantendo a primeira ocorrência e a ordem.
 * Evita duplicados quando uma página nova traz um item que já estava na tela
 * (por exemplo, alguém publicou entre uma página e outra).
 */
export function mergeById<T extends { id: string }>(...lists: T[][]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Resultado de reconciliar um refresh incremental com as páginas já carregadas.
 *
 * - `fetch`: o prefixo novo terminou em um item que ainda não estava no cache;
 *   é preciso buscar a próxima página a partir de `cursor` para encontrar onde
 *   retomar o histórico.
 * - `reuse`: o prefixo novo alcançou o cache; as páginas antigas a partir de
 *   `cachedStartPage` continuam corretas e podem ser mantidas.
 * - `replace`: não há como retomar o histórico (fim da lista, cache vazio ou
 *   cache inteiro fora da faixa conhecida); o prefixo novo é a lista completa.
 */
export type RefreshedPages<T> =
  | { action: 'fetch'; cursor: string }
  /** `cachedStartPage` alinha os `pageParams` das páginas antigas mantidas. */
  | { action: 'reuse'; pages: Page<T>[]; cachedStartPage: number }
  | { action: 'replace'; pages: Page<T>[] };

/**
 * Reconcilia páginas buscadas de novo no topo com o restante do cache.
 *
 * A busca incremental traz primeiro a página mais nova. Se o último item dela
 * ainda existe no cache, tudo o que vem depois dele no cache continua sendo a
 * sequência correta: inserções, remoções e reordenações acima desse ponto já
 * foram absorvidas pelo prefixo novo. As páginas antigas são mantidas a partir
 * do item-âncora (exclusive), sem repetir o prefixo na exibição.
 *
 * Quando o último item do prefixo é novo, o cache ainda não foi alcançado e a
 * próxima página precisa ser buscada. Isso evita o merge ingênuo que deixaria
 * um buraco entre a primeira página nova e as páginas antigas.
 */
export function reconcileRefreshedPages<T extends { id: string }>(
  cachedPages: Page<T>[],
  refreshedPages: Page<T>[],
): RefreshedPages<T> {
  const lastPage = refreshedPages[refreshedPages.length - 1];
  if (!lastPage || lastPage.items.length === 0) return { action: 'replace', pages: refreshedPages };
  if (cachedPages.length === 0) return { action: 'replace', pages: refreshedPages };

  const lastItem = lastPage.items[lastPage.items.length - 1];
  let anchorPage = -1;
  let anchorItem = -1;
  for (let pageIndex = 0; pageIndex < cachedPages.length; pageIndex += 1) {
    const itemIndex = cachedPages[pageIndex].items.findIndex((item) => item.id === lastItem.id);
    if (itemIndex < 0) continue;
    anchorPage = pageIndex;
    anchorItem = itemIndex;
    break;
  }

  if (anchorPage < 0) {
    return lastPage.nextCursor
      ? { action: 'fetch', cursor: lastPage.nextCursor }
      : { action: 'replace', pages: refreshedPages };
  }

  const anchor = cachedPages[anchorPage];
  const pages = [...refreshedPages];
  // O item-âncora já está no prefixo novo. O restante desta página e as
  // páginas seguintes continuam a lista, na mesma ordem em que estavam.
  if (anchorItem + 1 < anchor.items.length) {
    pages.push({ items: anchor.items.slice(anchorItem + 1), nextCursor: anchor.nextCursor });
    pages.push(...cachedPages.slice(anchorPage + 1));
    return { action: 'reuse', pages, cachedStartPage: anchorPage };
  }

  pages.push(...cachedPages.slice(anchorPage + 1));
  return { action: 'reuse', pages, cachedStartPage: anchorPage + 1 };
}
