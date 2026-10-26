const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Contagens como no design: 312 → "312"; 1204 → "1,2 mil"; 11600 → "11,6 mil". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const thousands = (Math.round(n / 100) / 10).toFixed(1).replace('.', ',').replace(',0', '');
  return `${thousands} mil`;
}

/** Contagem de pessoas como no design: 2418 → "2.418"; 11600 → "11,6 mil". */
export function formatPeople(n: number): string {
  if (n >= 10_000) return formatCount(n);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Tempo relativo curto: "agora", "12 min", "3 h", "2 d", ou a data se for antiga. */
export function formatRelative(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const diffMin = Math.floor((now - d.getTime()) / 60_000);
  if (Number.isNaN(diffMin)) return '';
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Data completa da publicação: "Qui, 7 nov · 14:32". */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Partes de data usadas nos cartões de chamado. */
export function eventDateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: pad(d.getDate()),
    month: MONTHS[d.getMonth()].toUpperCase(),
    weekday: WEEKDAYS[d.getDay()],
    hour: d.getMinutes() === 0 ? `${d.getHours()}h` : `${d.getHours()}h${pad(d.getMinutes())}`,
  };
}

/** "1 resposta" / "3 respostas". */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Iniciais do nome para o avatar: "Camila Rocha" → "CR". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'EU';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
