import { describe, expect, it } from '@jest/globals';

import { mergeById, reconcileRefreshedPages, type Page } from '../pagination';

type Item = { id: string };
const page = (ids: string[], nextCursor: string | null = null): Page<Item> => ({
  items: ids.map((id) => ({ id })),
  nextCursor,
});
const ids = (...pages: Page<Item>[]) => mergeById(...pages.map((entry) => entry.items)).map((item) => item.id);

describe('reconcileRefreshedPages', () => {
  it('mantém o histórico quando a primeira página não mudou', () => {
    const cached = [page(['a', 'b', 'c'], 'c'), page(['d', 'e', 'f'], 'f')];
    const result = reconcileRefreshedPages(cached, [page(['a', 'b', 'c'], 'c')]);

    expect(result.action).toBe('reuse');
    if (result.action !== 'reuse') throw new Error('esperava reutilizar o cache');
    expect(result.cachedStartPage).toBe(1);
    expect(ids(...result.pages)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('absorve novas inserções no topo sem deixar buraco entre a página nova e o histórico', () => {
    const cached = [page(['a', 'b', 'c'], 'c'), page(['d', 'e', 'f'], 'f'), page(['g', 'h', 'i'])];
    // Duas publicações novas empurraram "a" para o fim da primeira página.
    const result = reconcileRefreshedPages(cached, [page(['x', 'y', 'a'], 'a')]);

    expect(result.action).toBe('reuse');
    if (result.action !== 'reuse') throw new Error('esperava reutilizar o cache');
    expect(ids(...result.pages)).toEqual(['x', 'y', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  });

  it('remove itens apagados no topo sem duplicar o item de fronteira', () => {
    const cached = [page(['a', 'b', 'c'], 'c'), page(['d', 'e', 'f'], 'f'), page(['g', 'h', 'i'])];
    // "b" foi apagado; "d" entrou no fim da primeira página.
    const result = reconcileRefreshedPages(cached, [page(['a', 'c', 'd'], 'd')]);

    expect(result.action).toBe('reuse');
    if (result.action !== 'reuse') throw new Error('esperava reutilizar o cache');
    expect(ids(...result.pages)).toEqual(['a', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  });

  it('lida com mudança de ordem sem repetir o item movido', () => {
    const cached = [page(['a', 'b', 'c'], 'c'), page(['d', 'e', 'f'], 'f'), page(['g', 'h', 'i'])];
    // "f" foi fixado no topo; a ordem antiga continua depois do âncora "b".
    const result = reconcileRefreshedPages(cached, [page(['f', 'a', 'b'], 'b')]);

    expect(result.action).toBe('reuse');
    if (result.action !== 'reuse') throw new Error('esperava reutilizar o cache');
    expect(ids(...result.pages)).toEqual(['f', 'a', 'b', 'c', 'd', 'e', 'g', 'h', 'i']);
  });

  it('pede a próxima página quando o prefixo novo ainda não alcançou o cache', () => {
    const cached = [page(['a', 'b', 'c'], 'c'), page(['d', 'e', 'f'], 'f')];
    const result = reconcileRefreshedPages(cached, [page(['x', 'y', 'z'], 'z')]);

    expect(result).toEqual({ action: 'fetch', cursor: 'z' });
  });

  it('substitui o cache quando o fim da lista foi alcançado antes do histórico', () => {
    const cached = [page(['a', 'b'], 'b'), page(['c', 'd'])];
    const result = reconcileRefreshedPages(cached, [page(['x', 'y'])]);

    expect(result.action).toBe('replace');
    if (result.action !== 'replace') throw new Error('esperava substituir o cache');
    expect(ids(...result.pages)).toEqual(['x', 'y']);
  });

  it('não mantém páginas antigas quando o prefixo termina no último item delas', () => {
    const cached = [page(['a', 'b'], 'b'), page(['c', 'd'])];
    const result = reconcileRefreshedPages(cached, [page(['c', 'd'])]);

    expect(result.action).toBe('reuse');
    if (result.action !== 'reuse') throw new Error('esperava reutilizar o cache');
    expect(result.cachedStartPage).toBe(2);
    expect(ids(...result.pages)).toEqual(['c', 'd']);
  });
});
