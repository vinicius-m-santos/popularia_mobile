/**
 * Datas dos mocks relativas ao momento em que o app abre, para que "há 2 h"
 * e "nesta semana" façam sentido em qualquer dia.
 */
const now = Date.now();
const MINUTE = 60_000;

export function minutesAgo(minutes: number): string {
  return new Date(now - minutes * MINUTE).toISOString();
}

export function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

export function daysAgo(days: number): string {
  return minutesAgo(days * 24 * 60);
}

/**
 * Próxima ocorrência do dia da semana (0 = domingo … 6 = sábado), no horário local,
 * para que "quinta tem ato" no texto do post bata com a data do chamado.
 */
export function nextWeekday(weekday: number, hour: number, minute = 0): string {
  const d = new Date(now);
  const ahead = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + ahead);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
