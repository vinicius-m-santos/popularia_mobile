import { describe, expect, it } from '@jest/globals';

import {
  buildQaFeedItems,
  QA_MOUNTED_CARD_COUNT,
  QA_PAGE_SIZE,
  QA_PHOTO_COUNT,
  QA_POST_COUNT,
  QA_VIDEO_COUNT,
  qaFeedPage,
  qaMountedCards,
} from '../qa-fixture';

describe('dataset de QA de performance', () => {
  it('prepara 200+ publicações com mídia, 100+ fotos e vídeos', () => {
    const items = buildQaFeedItems();
    expect(items).toHaveLength(QA_POST_COUNT);
    expect(items.length).toBeGreaterThan(200);
    expect(items.filter((item) => item.attachment?.type === 'image')).toHaveLength(QA_PHOTO_COUNT);
    expect(items.filter((item) => item.attachment?.type === 'video')).toHaveLength(QA_VIDEO_COUNT);
    expect(QA_PHOTO_COUNT).toBeGreaterThan(100);
    expect(new Set(items.map((item) => item.id)).size).toBe(QA_POST_COUNT);
  });

  it('é determinístico e pagina com pelo menos três páginas por cursor', () => {
    const first = buildQaFeedItems();
    const second = buildQaFeedItems();
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));

    const pages = [] as string[][];
    let cursor: string | null = null;
    do {
      const page = qaFeedPage(cursor);
      expect(page.items.length).toBeLessThanOrEqual(QA_PAGE_SIZE);
      pages.push(page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(pages).toHaveLength(3);
    expect(pages.flat()).toHaveLength(QA_POST_COUNT);
  });

  it('separa exatamente 20 cartões para o cenário de montagem simultânea', () => {
    const mounted = qaMountedCards();
    expect(mounted).toHaveLength(QA_MOUNTED_CARD_COUNT);
    expect(QA_MOUNTED_CARD_COUNT).toBe(20);
    expect(new Set(mounted.map((item) => item.id)).size).toBe(20);
  });
});
