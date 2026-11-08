import type { ChamadoCardData } from './chamado-card';
import type { User } from '@/types/models';

/** Participante já resolvido para a pilha de avatares do cartão. */
export type ChamadoFace = {
  key: string;
  id?: string;
  initials: string;
  tone: User['tone'];
  avatarUrl?: string | null;
  viewer?: boolean;
};

/** Pilha de rostos do cartão: a própria pessoa primeiro quando confirmou presença. */
export function facesFor(people: User[], going: boolean, me: User, limit: number): ChamadoFace[] {
  const unique = new Map<string, ChamadoFace>();
  if (going) unique.set('me', { key: 'me', initials: me.initials, tone: 'red', viewer: true });
  for (const person of people) {
    if (person.id === me.id || unique.has(person.id)) continue;
    unique.set(person.id, { key: person.id, id: person.id, initials: person.initials, tone: person.tone, avatarUrl: person.avatarUrl });
    if (unique.size >= limit) break;
  }
  return [...unique.values()].slice(0, limit);
}

/** Primeiros nomes de quem vai, sem repetir a própria pessoa. */
export function namesFor(people: User[], going: boolean, me: User): string[] {
  const names: string[] = [];
  if (going) names.push('Você');
  for (const person of people) {
    if (person.id === me.id) continue;
    const first = person.name.trim().split(/\s+/)[0];
    if (!first || names.includes(first)) continue;
    names.push(first);
    if (names.length >= 2) break;
  }
  return names;
}

/** Frase de presença do cartão ("Ana e mais 3 vão."). */
export function whoLabel(names: string[], extra: number, goingCount: number): string {
  if (goingCount === 0) return 'Ninguém confirmou ainda.';
  const verb = goingCount === 1 ? 'vai' : 'vão';
  if (names.length === 0) return `${goingCount} ${verb}.`;
  if (extra > 0) return `${names.join(', ')} e mais ${extra} ${verb}.`;
  if (names.length === 1) return `${names[0]} ${verb}.`;
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} ${verb}.`;
}

/** Alternativa sem o módulo nativo: Google Agenda com título, data, local e detalhes. */
export function googleCalendarUrl(data: ChamadoCardData): string | null {
  const start = new Date(data.startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = data.endsAt ? new Date(data.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = [
    ['action', 'TEMPLATE'],
    ['text', data.title],
    ['dates', `${stamp(start)}/${stamp(end)}`],
    ['details', data.description],
    ['location', [data.placeName, data.address].filter((value): value is string => !!value).join(' — ')],
  ].filter(([, value]) => !!value).map(([key, value]) => `${key}=${encodeURIComponent(value!)}`).join('&');
  return `https://calendar.google.com/calendar/render?${params}`;
}
