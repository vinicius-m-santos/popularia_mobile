import { describe, expect, it } from '@jest/globals';

import { AVATAR_COLORS, avatarColorFor, avatarPalette, TONE_COLORS } from '../avatar';

describe('cores de identidade sem foto', () => {
  it('tem entre 10 e 15 cores e mantém a mesma cor para a mesma pessoa', () => {
    expect(AVATAR_COLORS.length).toBeGreaterThanOrEqual(10);
    expect(AVATAR_COLORS.length).toBeLessThanOrEqual(15);
    const id = '0192a7b0-0000-7000-8000-0000000000aa';
    expect(avatarColorFor(id)).toBe(avatarColorFor(id));
    expect(avatarColorFor(null)).toBeNull();
    expect(avatarPalette(null, 'red')).toBe(TONE_COLORS.red);
  });

  it('espalha pessoas diferentes pela paleta', () => {
    const used = new Set(
      Array.from({ length: 60 }, (_, index) =>
        avatarColorFor(`0192a7b0-0000-7000-8000-${String(index).padStart(12, '0')}`)?.bg),
    );
    expect(used.size).toBeGreaterThanOrEqual(8);
  });
});
