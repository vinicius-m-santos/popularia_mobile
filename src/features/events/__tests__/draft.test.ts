import { describe, expect, it } from '@jest/globals';

import { draftError, draftToInput } from '../draft';
import type { EventDraft } from '../types';

const now = new Date('2026-11-01T15:00:00Z');
const draft: EventDraft = {
  title: 'Assembleia mensal', description: 'Pauta.', format: 'in_person',
  placeName: 'Sindicato dos Bancários', address: 'Rua X, 123', onlineUrl: '',
  date: '05/11/2026', time: '19:00', endDate: '', endTime: '', timeZone: 'America/Manaus',
};

describe('validação do evento', () => {
  it('aceita presencial no futuro e omite o link', () => {
    expect(draftError(draft, true, now)).toBeNull();
    expect(draftToInput(draft).onlineUrl).toBeNull();
    expect(draftToInput(draft).startsAt).toBe('2026-11-05T19:00:00-04:00');
  });

  it('recusa título vazio, fim antes do início, link inválido e presencial sem local', () => {
    expect(draftError({ ...draft, title: '  ' }, true, now)).toMatch(/título/);
    expect(draftError({ ...draft, date: '01/11/2026', time: '10:00' }, true, now)).toMatch(/futuro/);
    expect(draftError({ ...draft, endDate: '05/11/2026', endTime: '18:00' }, true, now)).toMatch(/fim/);
    expect(draftError({ ...draft, format: 'online', onlineUrl: 'http://meet.example.org/sala' }, true, now)).toMatch(/https/);
    expect(draftError({ ...draft, placeName: '' }, true, now)).toMatch(/local/);
  });

  it('híbrido exige local e link, e online não envia endereço', () => {
    const hybrid = { ...draft, format: 'hybrid' as const, onlineUrl: 'https://meet.example.org/sala' };
    expect(draftError(hybrid, true, now)).toBeNull();
    expect(draftToInput(hybrid).placeName).toBe('Sindicato dos Bancários');
    expect(draftToInput({ ...draft, format: 'online', onlineUrl: 'https://meet.example.org/sala', placeName: 'Ignorado', address: 'Rua' }).placeName).toBeNull();
  });

  it('edição pode manter um início que já passou', () => {
    expect(draftError({ ...draft, date: '01/11/2026', time: '10:00' }, false, now)).toBeNull();
  });
});
