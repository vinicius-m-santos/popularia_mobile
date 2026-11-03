import { describe, expect, it } from '@jest/globals';

import { achievementUnlockedLabel, addDays, streakWeek, todayInStreakZone } from '../dates';

describe('dia civil da sequência', () => {
  it('usa o fuso de Brasília, não o do aparelho', () => {
    expect(todayInStreakZone(new Date('2026-06-16T01:30:00Z'))).toBe('2026-06-15');
    expect(todayInStreakZone(new Date('2026-11-01T02:59:00Z'))).toBe('2026-10-31');
    expect(todayInStreakZone(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-10-31', -5)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('desenha a semana de segunda a domingo com os dias da sequência', () => {
    const week = streakWeek({ today: '2026-10-31', streak: 2, lastActivityOn: '2026-10-31' });
    expect(week.map((day) => day.weekday)).toEqual(['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']);
    expect(week.map((day) => day.label)).toEqual(['26', '27', '28', '29', '30', '31', '01']);
    expect(week.map((day) => day.active)).toEqual([false, false, false, false, true, true, false]);
    expect(week.map((day) => day.today)).toEqual([false, false, false, false, false, true, false]);
    expect(week.map((day) => day.future)).toEqual([false, false, false, false, false, false, true]);
  });

  it('não marca nada sem sequência ou com a última participação fora da semana', () => {
    expect(streakWeek({ today: '2026-10-31', streak: 0, lastActivityOn: '2026-10-31' }).some((day) => day.active)).toBe(false);
    expect(streakWeek({ today: '2026-10-31', streak: 2, lastActivityOn: null }).some((day) => day.active)).toBe(false);
    expect(streakWeek({ today: '2026-10-31', streak: 3, lastActivityOn: '2026-10-01' }).some((day) => day.active)).toBe(false);
  });

  it('não pinta o futuro quando a última participação é hoje e a semana vira', () => {
    const week = streakWeek({ today: '2026-11-02', streak: 3, lastActivityOn: '2026-11-02' });
    expect(week.map((day) => day.active)).toEqual([true, false, false, false, false, false, false]);
    expect(week[0]).toMatchObject({ weekday: 'SEG', label: '02', active: true, today: true, future: false });
    expect(week[6].future).toBe(true);
  });
});

describe('selo da conquista', () => {
  it('diz HOJE quando desbloqueou no dia civil atual', () => {
    expect(achievementUnlockedLabel('2026-10-31T15:00:00-03:00', '2026-10-31')).toBe('DESBLOQUEADA HOJE');
  });

  it('usa a data de Brasília quando é outro dia', () => {
    expect(achievementUnlockedLabel('2026-06-02T15:00:00-03:00', '2026-10-31')).toBe('DESBLOQUEADA EM 02/06/2026');
  });

  it('não inventa data sem registro', () => {
    expect(achievementUnlockedLabel(null, '2026-10-31')).toBe('DESBLOQUEADA');
  });
});
