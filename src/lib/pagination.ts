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
