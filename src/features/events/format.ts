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
