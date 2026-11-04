import { describe, expect, it } from '@jest/globals';

import { displayedCommentCount } from '../interactions-context';

describe('contagem de comentários', () => {
  it('prefere a última contagem conhecida e permite diminuir após a exclusão', () => {
    expect(displayedCommentCount(1, 0)).toBe(0);
    expect(displayedCommentCount(1, 2)).toBe(2);
    expect(displayedCommentCount(3, undefined)).toBe(3);
  });
});
