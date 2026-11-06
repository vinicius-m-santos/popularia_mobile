import type { Page } from '@/lib/pagination';

/**
 * Guarda de forma para páginas que entram no cache.
 *
 * O tipo TypeScript some em runtime. Uma resposta parcial (por exemplo, sem
 * `items` ou com `nextCursor` de tipo inesperado) não pode substituir páginas
 * boas no cache: antes de gravar, a página é validada e a operação falha como
 * erro de leitura, preservando o conteúdo anterior.
 */
export function isPagePayload<T extends { id: string }>(value: unknown): value is Page<T> {
  if (!value || typeof value !== 'object') return false;
  const page = value as { items?: unknown; nextCursor?: unknown };
  if (!Array.isArray(page.items)) return false;
  return page.nextCursor === null || page.nextCursor === undefined || typeof page.nextCursor === 'string';
}

export function assertPagePayload<T extends { id: string }>(value: unknown): Page<T> {
  if (!isPagePayload<T>(value)) throw new Error('Resposta de página incompleta; o cache anterior foi preservado.');
  return value;
}
