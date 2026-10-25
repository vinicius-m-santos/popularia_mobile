const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** 1204 → "1.204"; 11600 → "11,6 mil". Sem depender de Intl, que varia entre engines. */
export function formatCount(n: number): string {
  if (n >= 10_000) {
    const thousands = Math.round(n / 100) / 10;
    return `${String(thousands).replace('.', ',')} mil`;
  }
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "2024-11-07T14:32:00-03:00" → "7 nov · 14:32" (no fuso do aparelho). */
export function formatPostDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Partes de data usadas no cartão de chamado. */
export function eventDateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: pad(d.getDate()),
    month: MONTHS[d.getMonth()].toUpperCase(),
    weekday: WEEKDAYS[d.getDay()],
    hour: d.getMinutes() === 0 ? `${d.getHours()}h` : `${d.getHours()}h${pad(d.getMinutes())}`,
  };
}
