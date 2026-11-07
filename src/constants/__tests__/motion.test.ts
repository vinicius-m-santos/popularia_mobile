import { describe, expect, it } from '@jest/globals';

import { Motion } from '../motion';

describe('tokens de motion', () => {
  it('mantém a escala de duração curta e sem loops', () => {
    expect(Motion.duration.fast).toBeLessThan(Motion.duration.normal);
    expect(Motion.duration.normal).toBeLessThan(Motion.duration.confirmation);
    expect(Motion.duration.fast).toBeGreaterThan(0);
  });

  it('define pressed discreto e uma mola de retorno sem ultrapassagem', () => {
    expect(Motion.feedback.pressed.opacity).toBeGreaterThan(0);
    expect(Motion.feedback.pressed.opacity).toBeLessThan(1);
    expect(Motion.feedback.pressed.scale).toBeGreaterThan(0.95);
    expect(Motion.feedback.pressed.scale).toBeLessThan(1);
    expect(Motion.spring.press.overshootClamping).toBe(true);
    expect(Motion.spring.press.damping).toBeGreaterThan(0);
    expect(Motion.spring.press.stiffness).toBeGreaterThan(0);
  });
});
