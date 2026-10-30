import { describe, expect, it } from '@jest/globals';

import { attendanceCount, formatPoster, mapsLink, wallFromIso, zonedWallToIso, zoneOffsetMinutes } from '../format';

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
