export type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME = /^(\d{2}):(\d{2})$/;
const MAP_HOSTS = new Set(['maps.google.com', 'maps.app.goo.gl', 'openstreetmap.org', 'www.openstreetmap.org', 'maps.apple.com']);

/** Fuso do aparelho. O produto não assume America/Sao_Paulo. */
export function deviceTimeZone(): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return null;
  try {
    Intl.DateTimeFormat('pt-BR', { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return null;
  }
}

export function parseWall(date: string, time: string): WallClock | null {
  const dayMatch = DATE.exec(date.trim());
  const timeMatch = TIME.exec(time.trim());
  if (!dayMatch || !timeMatch) return null;
  const day = Number(dayMatch[1]);
  const month = Number(dayMatch[2]);
  const year = Number(dayMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || day < 1 || year < 2000) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return { year, month, day, hour, minute };
}

/** Offset, em minutos a leste de UTC, do fuso naquele instante. */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour') % 24, read('minute'), read('second'));
  return Math.round((wallAsUtc - instant.getTime()) / 60_000);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/**
 * Horário de parede no fuso informado, como ISO-8601 com o offset desse fuso naquele instante.
 * O texto guarda o horário anunciado (19:00 continua 19:00); o offset torna o instante inequívoco.
 */
export function zonedWallToIso(wall: WallClock, timeZone: string): string {
  const utcWall = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const first = zoneOffsetMinutes(new Date(utcWall), timeZone);
  const corrected = utcWall - first * 60_000;
  const offset = zoneOffsetMinutes(new Date(corrected), timeZone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:00${formatOffset(offset)}`;
}

export function wallFromIso(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { date: `${read('day')}/${read('month')}/${read('year')}`, time: `${read('hour')}:${read('minute')}` };
}

export type PosterWhen = { day: string; month: string; weekday: string; time: string };

export function formatPoster(iso: string, timeZone: string): PosterWhen {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone, weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: read('day'),
    month: read('month').replace('.', '').slice(0, 3).toUpperCase(),
    weekday: read('weekday').toUpperCase(),
    time: `${read('hour')}:${read('minute')}`,
  };
}

export function attendanceCount(going: number, maybe: number): string {
  const format = new Intl.NumberFormat('pt-BR');
  return `${format.format(going)} vão · ${format.format(maybe)} talvez`;
}

/** Um único link https de mapa conhecido dentro do endereço. Não pesquisa o texto. */
export function mapsLink(address: string | null): string | null {
  if (!address) return null;
  const matches = address.match(/https:\/\/[^\s]+/gi);
  if (!matches || matches.length !== 1) return null;
  try {
    const url = new URL(matches[0].replace(/[),.;]+$/, ''));
    if (url.username || url.password || url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'www.google.com') return url.pathname.startsWith('/maps') ? url.toString() : null;
    return MAP_HOSTS.has(host) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;
const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const;
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;

export type CallSchedule = {
  weekdayShort: string;
  weekdayLong: string;
  day: string;
  monthShort: string;
  monthLong: string;
  time: string;
  /** "Sexta, 6 de novembro · 19h" */
  label: string;
};

type CivilDate = { year: number; month: number; day: number; hour: number; minute: number };

/**
 * O horário de parede anunciado, lido do próprio ISO. A API manda `startsAt` já com o
 * offset do fuso do evento; um ISO em UTC (mocks) vale no fuso do aparelho.
 *
 * Evita `Intl.formatToParts` aqui: no Hermes/iOS a combinação de weekday com dia, mês e
 * hora devolvia só o weekday, e o cartão ficava com o bloco de data vazio.
 */
function civilFromIso(iso: string): CivilDate | null {
  const text = iso.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  if (!match) {
    // Qualquer outro formato válido para `Date` ainda mostra dia e mês.
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes() };
  }
  if (match[7] && match[7] !== 'Z') {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
    };
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes() };
}

/** Partes do horário do chamado no fuso anunciado, como no cartão do feed. */
export function callSchedule(iso: string, timeZone: string): CallSchedule {
  void timeZone;
  const civil = civilFromIso(iso);
  if (!civil) {
    return { weekdayShort: '', weekdayLong: '', day: '', monthShort: '', monthLong: '', time: '', label: '' };
  }
  const weekday = new Date(Date.UTC(civil.year, civil.month - 1, civil.day)).getUTCDay();
  const weekdayLong = WEEKDAYS_LONG[weekday] ?? '';
  const monthLong = MONTHS_LONG[civil.month - 1] ?? '';
  const day = String(civil.day).padStart(2, '0');
  const time = `${civil.hour}h${civil.minute ? String(civil.minute).padStart(2, '0') : ''}`;
  const weekdayLabel = weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1);
  return {
    weekdayShort: WEEKDAYS_SHORT[weekday] ?? '',
    weekdayLong: weekdayLabel,
    day,
    monthShort: monthLong.slice(0, 3).toUpperCase(),
    monthLong,
    time,
    label: `${weekdayLabel}, ${civil.day} de ${monthLong} · ${time}`,
  };
}

/** Dia civil no fuso, como um número comparável (sem horário de verão no meio). */
function civilDay(value: string | number | Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(read('year'), read('month') - 1, read('day')) / 86_400_000;
}

/** "HOJE", "AMANHÃ", "EM 3 DIAS" ou "JÁ ACONTECEU", no fuso do chamado. */
export function countdownLabel(iso: string, timeZone: string, now: number = Date.now()): string {
  const days = Math.round(civilDay(iso, timeZone) - civilDay(now, timeZone));
  if (days < 0) return 'JÁ ACONTECEU';
  if (days === 0) return 'HOJE';
  if (days === 1) return 'AMANHÃ';
  return `EM ${days} DIAS`;
}

export type CallCapacitySummary =
  | { kind: 'free' }
  | { kind: 'spots'; left: string; right: string; alert: boolean; fill: number; full: boolean }
  | { kind: 'goal'; left: string; right: string; met: boolean; fill: number };

/** Texto e preenchimento da barra conforme o tipo escolhido por quem convocou. */
export function callCapacitySummary(mode: 'spots' | 'goal' | null | undefined, capacity: number | null | undefined, going: number): CallCapacitySummary {
  if ((mode === 'spots' || mode === 'goal') && typeof capacity === 'number' && capacity > 0) {
    const clamped = Math.max(0, going);
    if (mode === 'spots') {
      const remaining = Math.max(0, capacity - clamped);
      const full = remaining === 0;
      return {
        kind: 'spots',
        left: `${clamped} DE ${capacity} VAGAS`,
        right: full ? 'LOTOU' : remaining === 1 ? 'SÓ 1 VAGA' : `SOBRAM ${remaining}`,
        alert: remaining <= 2,
        fill: Math.min(1, clamped / capacity),
        full,
      };
    }
    const met = clamped >= capacity;
    return {
      kind: 'goal',
      left: `META: ${capacity} PESSOAS`,
      right: met ? 'META BATIDA ✓' : `FALTAM ${capacity - clamped} PRA CONFIRMAR`,
      met,
      fill: Math.min(1, clamped / capacity),
    };
  }
  return { kind: 'free' };
}

/**
 * Publicações antigas gravavam "Vagas: N" / "Meta mínima: N" no próprio texto.
 * Lê essa linha como capacidade e tira do texto para o cartão não repetir a informação.
 */
export function splitCallDetails(text: string): { text: string; capacityMode: 'spots' | 'goal' | null; capacity: number | null } {
  if (!text) return { text: '', capacityMode: null, capacity: null };
  const kept: string[] = [];
  let capacityMode: 'spots' | 'goal' | null = null;
  let capacity: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const match = /^(vagas|meta m[íi]nima):\s*(\d{1,4})(?:\s+pessoas)?\s*$/i.exec(line.trim());
    if (match) {
      if (capacityMode === null) {
        capacityMode = match[1].toLowerCase().startsWith('vagas') ? 'spots' : 'goal';
        capacity = Number(match[2]);
      }
      continue;
    }
    kept.push(line);
  }
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), capacityMode, capacity };
}

/** Link de mapa para o ponto do chamado; um link de mapa no endereço tem prioridade. */
export function mapsQueryUrl(placeName: string | null | undefined, address: string | null | undefined): string | null {
  const known = mapsLink(address ?? null);
  if (known) return known;
  const query = [placeName, address].filter((value): value is string => !!value && value.trim().length > 0).join(', ');
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
