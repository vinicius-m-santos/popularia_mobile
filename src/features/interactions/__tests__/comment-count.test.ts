import { describe, expect, it } from '@jest/globals';

import { displayedCommentCount } from '../interactions-context';

describe('contagem de comentários', () => {
  it('na API usa o servidor como fonte da verdade, inclusive depois de excluir', () => {
    expect(displayedCommentCount(0, 1, false)).toBe(0);
    expect(displayedCommentCount(1, 0, false)).toBe(1);
    expect(displayedCommentCount(3, undefined, false)).toBe(3);
  });

  it('no modo demonstração soma os comentários locais', () => {
    expect(displayedCommentCount(0, 1, true)).toBe(1);
    expect(displayedCommentCount(3, undefined, true)).toBe(3);
  });
});
