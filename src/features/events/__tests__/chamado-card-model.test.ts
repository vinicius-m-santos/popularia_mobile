import { describe, expect, it } from '@jest/globals';

import type { ChamadoCardData } from '../chamado-card';
import { facesFor, googleCalendarUrl, namesFor, whoLabel } from '../chamado-card-model';

const me = { id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red' as const };
const marina = { id: 'marina', name: 'Marina Alves', handle: 'marina', initials: 'MA', tone: 'cream' as const };
const rafael = { id: 'rafa', name: 'Rafael Prado', handle: 'rafa', initials: 'RP', tone: 'black' as const };
const outroRafael = { id: 'rafa-2', name: 'Rafael Souza', handle: 'rafasouza', initials: 'RS', tone: 'cream' as const };

function data(overrides: Partial<ChamadoCardData> = {}): ChamadoCardData {
  return {
    id: 'chamado-1',
    title: 'Ato pela Tarifa Zero',
    description: 'Concentração na Praça Sete.',
    startsAt: '2026-11-05T22:00:00.000Z',
    timeZone: 'America/Sao_Paulo',
    placeName: 'Praça Sete',
    address: 'Rua X, 123',
    cover: null,
    coverFit: 'cover',
    capacityMode: null,
    capacity: null,
    goingCount: 12,
    maybeCount: 4,
    goingUsers: [marina, rafael],
    viewerAttendance: null,
    past: false,
    cancelled: false,
    ...overrides,
  };
}

describe('modelo do cartão de chamado', () => {
  it('põe a própria pessoa na frente da pilha e limita os rostos', () => {
    const faces = facesFor([marina, me, rafael], true, me, 2);
    expect(faces.map((face) => face.key)).toEqual(['me', 'marina']);
    expect(faces[0]?.viewer).toBe(true);
  });

  it('não duplica pessoas e respeita o limite sem presença própria', () => {
    const faces = facesFor([marina, marina, rafael], false, me, 3);
    expect(faces.map((face) => face.key)).toEqual(['marina', 'rafa']);
  });

  it('usa só o primeiro nome, sem repetir, e inclui "Você" quando confirmado', () => {
    expect(namesFor([marina, rafael], true, me)).toEqual(['Você', 'Marina']);
    // "Você" já ocupa uma das duas posições e o primeiro nome repetido é ignorado.
    expect(namesFor([marina, rafael, outroRafael], true, me)).toEqual(['Você', 'Marina']);
    expect(namesFor([marina, rafael, outroRafael], false, me)).toEqual(['Marina', 'Rafael']);
  });

  it('flexiona a frase de presença em todos os casos', () => {
    expect(whoLabel([], 0, 0)).toBe('Ninguém confirmou ainda.');
    expect(whoLabel([], 0, 3)).toBe('3 vão.');
    expect(whoLabel(['Ana'], 0, 1)).toBe('Ana vai.');
    expect(whoLabel(['Ana', 'Bia'], 0, 2)).toBe('Ana e Bia vão.');
    expect(whoLabel(['Ana', 'Bia'], 5, 7)).toBe('Ana, Bia e mais 5 vão.');
  });

  it('monta o link do Google Agenda com título, data, local e detalhes', () => {
    const url = googleCalendarUrl(data());
    expect(url).toContain('https://calendar.google.com/calendar/render?');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Ato%20pela%20Tarifa%20Zero');
    expect(url).toContain('dates=20261105T220000Z%2F20261105T230000Z');
    expect(url).toContain('location=Pra%C3%A7a%20Sete%20%E2%80%94%20Rua%20X%2C%20123');
    expect(url).toContain('details=Concentra%C3%A7%C3%A3o%20na%20Pra%C3%A7a%20Sete.');
  });

  it('devolve null quando a data do chamado é inválida', () => {
    expect(googleCalendarUrl(data({ startsAt: 'não é data' }))).toBeNull();
  });
});
