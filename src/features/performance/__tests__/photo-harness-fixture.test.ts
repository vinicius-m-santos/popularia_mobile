import { describe, expect, it } from '@jest/globals';

import {
  buildQaPhotoFeedItems,
  QA_PHOTO_FEED_COUNT,
  QA_PHOTO_SIZES,
  qaPhotoVariantSize,
} from '../photo-harness-fixture';

describe('dataset do feed de fotos 2048px', () => {
  it('gera 120 publicações somente com foto e tamanhos variados', () => {
    const items = buildQaPhotoFeedItems();

    expect(items).toHaveLength(QA_PHOTO_FEED_COUNT);
    expect(QA_PHOTO_FEED_COUNT).toBeGreaterThanOrEqual(100);
    expect(items.every((item) => item.attachment?.type === 'image')).toBe(true);
    expect(new Set(items.map((item) => item.attachment!.width)).size).toBeGreaterThan(3);
    expect(Math.max(...items.map((item) => Math.max(item.attachment!.width, item.attachment!.height)))).toBe(2048);
    expect(items.map((item) => item.id)).toEqual(Array.from({ length: QA_PHOTO_FEED_COUNT }, (_, index) => `qa-photo-post-${index + 1}`));
    expect(QA_PHOTO_SIZES).toHaveLength(8);
  });

  it('varia a URL pelo seed e mantém a mesma proporção na variante simulada', () => {
    const original = buildQaPhotoFeedItems(2, 'original');
    const first = original[0].attachment!;
    const second = original[1].attachment!;
    expect(first.url).not.toBe(second.url);
    expect(first.url).toContain(`/${first.width}/${first.height}`);

    const variant = buildQaPhotoFeedItems(2, 'small')[0].attachment!;
    const size = qaPhotoVariantSize(QA_PHOTO_SIZES[0], 'small');
    expect(variant).toMatchObject({ width: size.width, height: size.height });
    expect(variant.width).toBe(512);
    expect(variant.height).toBe(512);
    expect(variant.url).toContain('/512/512');
  });
});
