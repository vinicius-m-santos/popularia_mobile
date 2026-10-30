import { httpsUrl, parseWall, zonedWallToIso } from './format';
import type { EventDraft, EventInput } from './types';

const SPAN_MS = 14 * 24 * 60 * 60 * 1000;

/** Validação local. O servidor continua sendo a autoridade. */
export function draftError(draft: EventDraft, creating: boolean, now = new Date()): string | null {
  const title = draft.title.trim();
  if (!title || title.length > 120) return 'O título precisa ter entre 1 e 120 caracteres.';
  if (draft.description.trim().length > 2000) return 'A descrição passa de 2000 caracteres.';
  if (draft.format !== 'online') {
    const place = draft.placeName.trim();
    if (!place || place.length > 120) return 'Informe o nome do local.';
    if (draft.address.trim().length > 240) return 'O endereço está longo demais.';
  }
  if (draft.format !== 'in_person' && (draft.onlineUrl.trim().length > 500 || !httpsUrl(draft.onlineUrl))) {
    return 'O link precisa ser um endereço https.';
  }
  if (!draft.timeZone) return 'Não foi possível identificar o fuso deste aparelho.';
  const start = parseWall(draft.date, draft.time);
  if (!start) return 'Use a data como 05/11/2026 e a hora como 19:00.';
  let startsAt: string;
  try {
    startsAt = zonedWallToIso(start, draft.timeZone);
  } catch {
    return 'Fuso horário inválido.';
  }
  const startMs = Date.parse(startsAt);
  if (Number.isNaN(startMs)) return 'Data ou hora inválida.';
  if (creating && startMs <= now.getTime()) return 'O início precisa ser no futuro.';
  if (draft.endDate.trim() !== '' || draft.endTime.trim() !== '') {
    const end = parseWall(draft.endDate, draft.endTime);
    if (!end) return 'Informe a data e a hora de término.';
    let endsAt: string;
    try {
      endsAt = zonedWallToIso(end, draft.timeZone);
    } catch {
      return 'Fuso horário inválido.';
    }
    const endMs = Date.parse(endsAt);
    if (Number.isNaN(endMs) || endMs <= startMs) return 'O fim precisa ser depois do início.';
    if (endMs - startMs > SPAN_MS) return 'A atividade pode durar no máximo 14 dias.';
  }
  return null;
}

export function draftToInput(draft: EventDraft): EventInput {
  const start = parseWall(draft.date, draft.time);
  if (!start) throw new Error('Data inválida.');
  const needsPlace = draft.format !== 'online';
  const needsUrl = draft.format !== 'in_person';
  const url = needsUrl ? httpsUrl(draft.onlineUrl) : null;
  if (needsUrl && !url) throw new Error('Link inválido.');
  const end = draft.endDate.trim() && draft.endTime.trim() ? parseWall(draft.endDate, draft.endTime) : null;
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    format: draft.format,
    placeName: needsPlace ? draft.placeName.trim() : null,
    address: needsPlace && draft.address.trim() ? draft.address.trim() : null,
    onlineUrl: url,
    timeZone: draft.timeZone,
    startsAt: zonedWallToIso(start, draft.timeZone),
    endsAt: end ? zonedWallToIso(end, draft.timeZone) : null,
  };
}
