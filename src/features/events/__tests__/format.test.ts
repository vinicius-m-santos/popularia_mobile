import { describe, expect, it } from '@jest/globals';

import { attendanceCount, callCapacitySummary, callSchedule, countdownLabel, formatPoster, mapsLink, mapsQueryUrl, splitCallDetails, wallFromIso, zonedWallToIso, zoneOffsetMinutes } from '../format';

describe('horário anunciado', () => {
  it('grava 19:00 em Manaus com offset -04:00 e relê o mesmo horário', () => {
    const iso = zonedWallToIso({ year: 2026, month: 11, day: 5, hour: 19, minute: 0 }, 'America/Manaus');
    expect(iso).toBe('2026-11-05T19:00:00-04:00');
    expect(wallFromIso(iso, 'America/Manaus')).toEqual({ date: '05/11/2026', time: '19:00' });
    expect(formatPoster(iso, 'America/Noronha').time).not.toBe('19:00');
    expect(formatPoster(iso, 'America/Manaus')).toMatchObject({ day: '05', month: 'NOV', time: '19:00' });
  });

  it('usa o offset do fuso no instante, não um fuso fixo do produto', () => {
    const summer = new Date('2026-01-15T15:00:00Z');
    expect(zoneOffsetMinutes(summer, 'America/Manaus')).toBe(-240);
    expect(zoneOffsetMinutes(summer, 'America/Noronha')).toBe(-120);
  });

  it('conta presença sem listar quem não vai', () => {
    expect(attendanceCount(32, 8)).toBe('32 vão · 8 talvez');
  });

  it('só abre um link https de mapa conhecido', () => {
    expect(mapsLink('Sindicato, https://maps.google.com/place')).toBe('https://maps.google.com/place');
    expect(mapsLink('https://maps.google.com/a https://maps.google.com/b')).toBeNull();
    expect(mapsLink('https://evil.test/maps')).toBeNull();
    expect(mapsLink('https://www.google.com/search?q=rua')).toBeNull();
    expect(mapsLink('Rua X, 123')).toBeNull();
  });
});

describe('cartão de chamado', () => {
  const start = '2026-11-06T19:00:00-03:00';
  const zone = 'America/Sao_Paulo';

  it('mostra dia, mês e horário como no cartão', () => {
    expect(callSchedule(start, zone)).toMatchObject({
      weekdayShort: 'SEX',
      weekdayLong: 'Sexta',
      day: '06',
      monthShort: 'NOV',
      monthLong: 'novembro',
      time: '19h',
      label: 'Sexta, 6 de novembro · 19h',
    });
    expect(callSchedule('2026-11-07T19:30:00-03:00', zone)).toMatchObject({ time: '19h30' });
  });

  it('conta os dias no fuso do chamado', () => {
    const now = Date.parse('2026-11-03T12:00:00-03:00');
    expect(countdownLabel(start, zone, now)).toBe('EM 3 DIAS');
    expect(countdownLabel('2026-11-04T19:00:00-03:00', zone, now)).toBe('AMANHÃ');
    expect(countdownLabel('2026-11-03T23:30:00-03:00', zone, now)).toBe('HOJE');
    expect(countdownLabel('2026-11-02T19:00:00-03:00', zone, now)).toBe('JÁ ACONTECEU');
  });

  it('descreve vagas, lotação e meta', () => {
    expect(callCapacitySummary('spots', 8, 6)).toMatchObject({ kind: 'spots', left: '6 DE 8 VAGAS', right: 'SOBRAM 2', alert: true, full: false });
    expect(callCapacitySummary('spots', 8, 7)).toMatchObject({ right: 'SÓ 1 VAGA', alert: true });
    expect(callCapacitySummary('spots', 8, 8)).toMatchObject({ right: 'LOTOU', full: true, fill: 1 });
    expect(callCapacitySummary('goal', 10, 5)).toMatchObject({ kind: 'goal', left: 'META: 10 PESSOAS', right: 'FALTAM 5 PRA CONFIRMAR', met: false });
    expect(callCapacitySummary('goal', 10, 11)).toMatchObject({ right: 'META BATIDA ✓', met: true, fill: 1 });
    expect(callCapacitySummary(null, null, 3)).toEqual({ kind: 'free' });
  });

  it('lê a capacidade gravada no texto por chamados antigos', () => {
    expect(splitCallDetails('Detalhes do encontro.\n\nVagas: 8\n\nCada um leva: um jogo')).toEqual({
      text: 'Detalhes do encontro.\n\nCada um leva: um jogo',
      capacityMode: 'spots',
      capacity: 8,
    });
    expect(splitCallDetails('Meta mínima: 10 pessoas')).toEqual({ text: '', capacityMode: 'goal', capacity: 10 });
    expect(splitCallDetails('Vagas: 4\nMeta mínima: 10 pessoas')).toMatchObject({ capacityMode: 'spots', capacity: 4 });
    expect(splitCallDetails('Sem metadados')).toEqual({ text: 'Sem metadados', capacityMode: null, capacity: null });
  });

  it('abre o mapa pelo endereço, sem inventar coordenadas', () => {
    expect(mapsQueryUrl('Praça Sete', 'Rua X, 123')).toBe('https://www.google.com/maps/search/?api=1&query=Pra%C3%A7a%20Sete%2C%20Rua%20X%2C%20123');
    expect(mapsQueryUrl('Praça Sete', null)).toContain('query=Pra%C3%A7a%20Sete');
    expect(mapsQueryUrl(null, null)).toBeNull();
  });
});
