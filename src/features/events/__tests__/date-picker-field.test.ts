import { describe, expect, it } from '@jest/globals';

import {
  formatPickerDate,
  formatPickerTime,
  pickerDateToWallStrings,
  wallStringsToPickerDate,
} from '../date-picker-field';

describe('wallStringsToPickerDate', () => {
  it('converte strings de rascunho para Date local', () => {
    const result = wallStringsToPickerDate('12/11/2026', '19:30');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(10); // novembro = 10
    expect(result!.getDate()).toBe(12);
    expect(result!.getHours()).toBe(19);
    expect(result!.getMinutes()).toBe(30);
  });

  it('retorna null para strings inválidas', () => {
    expect(wallStringsToPickerDate('', '')).toBeNull();
    expect(wallStringsToPickerDate('32/01/2026', '19:00')).toBeNull();
    expect(wallStringsToPickerDate('05/11/2026', '25:00')).toBeNull();
    expect(wallStringsToPickerDate('não-é-data', '19:00')).toBeNull();
  });

  it('vai e volta sem perda', () => {
    const original = wallStringsToPickerDate('05/11/2026', '19:00')!;
    const { dateStr, timeStr } = pickerDateToWallStrings(original);
    expect(dateStr).toBe('05/11/2026');
    expect(timeStr).toBe('19:00');
  });
});

describe('pickerDateToWallStrings', () => {
  it('converte Date para strings de rascunho com zero-pad', () => {
    const date = new Date(2026, 0, 5, 9, 5, 0, 0); // 05/01/2026 09:05
    const { dateStr, timeStr } = pickerDateToWallStrings(date);
    expect(dateStr).toBe('05/01/2026');
    expect(timeStr).toBe('09:05');
  });

  it('trata meia-noite corretamente', () => {
    const date = new Date(2026, 11, 31, 0, 0, 0, 0);
    const { dateStr, timeStr } = pickerDateToWallStrings(date);
    expect(dateStr).toBe('31/12/2026');
    expect(timeStr).toBe('00:00');
  });
});

describe('formatPickerDate', () => {
  it('formata data em pt-BR', () => {
    const date = new Date(2026, 10, 12, 0, 0); // 12 de novembro de 2026
    const result = formatPickerDate(date);
    expect(result).toContain('novembro');
    expect(result).toContain('2026');
    expect(result).toContain('12');
  });
});

describe('formatPickerTime', () => {
  it('formata hora com zero-pad', () => {
    expect(formatPickerTime(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(formatPickerTime(new Date(2026, 0, 1, 19, 30))).toBe('19:30');
    expect(formatPickerTime(new Date(2026, 0, 1, 0, 0))).toBe('00:00');
  });
});
