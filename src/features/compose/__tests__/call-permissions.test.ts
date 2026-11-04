import { describe, expect, it } from '@jest/globals';

import { callBlockedComunaNames, canModerateComuna } from '../call-permissions';

describe('permissão de chamado', () => {
  it('só fundador e moderação podem convocar em uma comuna', () => {
    expect(canModerateComuna('founder')).toBe(true);
    expect(canModerateComuna('moderator')).toBe(true);
    expect(canModerateComuna('member')).toBe(false);
    expect(canModerateComuna(null)).toBe(false);
    expect(canModerateComuna(undefined)).toBe(false);
  });

  it('lista apenas as comunas bloqueadas e ignora o perfil', () => {
    expect(callBlockedComunaNames([
      { kind: 'perfil' },
      { kind: 'comuna', comuna: { name: 'Hortas', viewerRole: 'member' } },
      { kind: 'comuna', comuna: { name: 'Tarifa', viewerRole: 'moderator' } },
      { kind: 'comuna', comuna: { name: 'Saúde', viewerRole: null } },
    ])).toEqual(['Hortas', 'Saúde']);
  });
});
