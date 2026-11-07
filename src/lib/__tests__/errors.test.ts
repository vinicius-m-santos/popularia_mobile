import { describe, expect, it } from '@jest/globals';

import { ApiError, describeError, isEmailNotVerifiedError } from '@/lib/errors';

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

describe('isEmailNotVerifiedError', () => {
  it('reconhece o tipo estável da API em IRI relativa ou absoluta', () => {
    expect(isEmailNotVerifiedError(new ApiError(403, '/errors/email-not-verified', 'Confirme seu e-mail.'))).toBe(true);
    expect(isEmailNotVerifiedError(new ApiError(403, 'https://api.popularia.com.br/errors/email-not-verified', 'Confirme seu e-mail.'))).toBe(true);
    expect(isEmailNotVerifiedError(new ApiError(403, 'https://api.popularia.com.br/errors/email-not-verified/', 'Confirme seu e-mail.'))).toBe(true);
  });

  it('não confunde erros reais de rede ou servidor com a restrição de e-mail', () => {
    expect(isEmailNotVerifiedError(new ApiError(500, '/errors/server', 'Falhou'))).toBe(false);
    expect(isEmailNotVerifiedError(new Error('sem rede'))).toBe(false);
    expect(isEmailNotVerifiedError(null)).toBe(false);
  });
});
