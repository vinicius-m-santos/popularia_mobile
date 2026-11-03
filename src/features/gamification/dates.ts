/**
 * O dia civil da Popularia vira à meia-noite de Brasília. A semana da sequência
 * vai de segunda a domingo e é derivada da sequência atual, não de um histórico.
 */
export const STREAK_TIME_ZONE = 'America/Sao_Paulo';

const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const;
const DAY_MS = 86_400_000;

function readPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

/** Hoje no fuso da Popularia, como AAAA-MM-DD. */
export function todayInStreakZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STREAK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return `${readPart(parts, 'year')}-${readPart(parts, 'month')}-${readPart(parts, 'day')}`;
}

function toUtc(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}

function fromUtc(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Soma dias a uma data civil AAAA-MM-DD, sem depender do fuso do aparelho. */
export function addDays(day: string, amount: number): string {
  return fromUtc(toUtc(day) + amount * DAY_MS);
}

export type StreakDay = {
  /** Data civil AAAA-MM-DD. */
  day: string;
  weekday: string;
  /** Dia do mês com dois dígitos. */
  label: string;
  active: boolean;
  today: boolean;
  future: boolean;
};

/**
 * Segunda a domingo da semana de `today`. Os dias ativos são os últimos
 * `streak` dias terminando em `lastActivityOn`; dias futuros ficam tracejados.
 */
export function streakWeek(input: { today: string; streak: number; lastActivityOn: string | null }): StreakDay[] {
  const { today, streak, lastActivityOn } = input;
  const weekday = new Date(toUtc(today)).getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  const last = lastActivityOn && streak > 0 && lastActivityOn <= today ? lastActivityOn : null;
  const first = last ? addDays(last, -(streak - 1)) : null;
  const isActive = (day: string) => null !== last && null !== first && day >= first && day <= last && day <= today;

  return WEEKDAYS.map((label, index) => {
    const day = addDays(monday, index);
    return {
      day,
      weekday: label,
      label: day.slice(8, 10),
      active: isActive(day),
      today: day === today,
      future: day > today,
    };
  });
}

/** Selo da conquista: HOJE quando desbloqueou no dia civil atual, senão a data. */
export function achievementUnlockedLabel(unlockedAt: string | null, today: string): string {
  if (!unlockedAt) return 'DESBLOQUEADA';
  const date = new Date(unlockedAt);
  if (todayInStreakZone(date) === today) return 'DESBLOQUEADA HOJE';
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: STREAK_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date);
  return `DESBLOQUEADA EM ${readPart(parts, 'day')}/${readPart(parts, 'month')}/${readPart(parts, 'year')}`;
}
