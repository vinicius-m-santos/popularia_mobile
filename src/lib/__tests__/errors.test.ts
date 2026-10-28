import { describe, expect, it } from '@jest/globals';

import { ApiError, describeError } from '@/lib/errors';

describe('describeError', () => {
  it('mostra o Retry-After curto em segundos', () => {
    expect(describeError(new ApiError(429, '/errors/too-many-requests', 'Muitas tentativas.', {}, 47)))
      .toBe('Muitas tentativas. Tente novamente em 47 s.');
  });

  it('arredonda esperas longas para minutos', () => {
    expect(describeError(new ApiError(429, '/errors/too-many-requests', 'Muitas tentativas.', {}, 601)))
      .toBe('Muitas tentativas. Tente novamente em 11 min.');
  });
});
