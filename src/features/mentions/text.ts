import type { ContentMention } from '@/types/models';

/** Menção ainda no rascunho. Os índices são unidades UTF-16, como o cursor do campo. */
export type DraftMention = ContentMention;

export type MentionQuery = { start: number; query: string };

const HANDLE_CHAR = /[a-z0-9._]/i;
const PHP_TRIM = /[ \t\n\r\0\v]/;

/** Mesma normalização do servidor: trim do PHP, quebras `\n` e Unicode NFC. */
export function normalizeContentText(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && PHP_TRIM.test(text[start] ?? '')) start += 1;
  while (end > start && PHP_TRIM.test(text[end - 1] ?? '')) end -= 1;
  return text.slice(start, end).replace(/\r\n/g, '\n').replace(/\r/g, '\n').normalize('NFC');
}

export function codePointLength(text: string): number {
  return [...text].length;
}

/** `@` no começo ou depois de espaço. No meio de `teste@email.com`, não. */
export function activeMentionQuery(text: string, cursor: number): MentionQuery | null {
  if (cursor < 0 || cursor > text.length) return null;
  const at = text.slice(0, cursor).lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !PHP_TRIM.test(text[at - 1] ?? '')) return null;
  const query = text.slice(at + 1, cursor);
  if (query.length > 20 || (query.length > 0 && ![...query].every((char) => HANDLE_CHAR.test(char)))) return null;
  return { start: at, query };
}

export function reconcileMentions(previous: string, next: string, mentions: DraftMention[]): DraftMention[] {
  if (previous === next) return mentions;
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start += 1;
  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > start && nextEnd > start && previous[previousEnd - 1] === next[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }
  const delta = nextEnd - previousEnd;
  return mentions.flatMap((mention) => {
    if (mention.end <= start) return [mention];
    if (mention.start >= previousEnd) {
      const shifted = { ...mention, start: mention.start + delta, end: mention.end + delta };
      return next.slice(shifted.start, shifted.end) === `@${mention.handle}` ? [shifted] : [];
    }
    return [];
  });
}

export function insertMention(
  text: string,
  cursor: number,
  person: Pick<DraftMention, 'userId' | 'handle' | 'displayName' | 'avatarUrl'>,
  mentions: DraftMention[],
  limit = 10,
): { text: string; mentions: DraftMention[]; cursor: number } {
  const active = activeMentionQuery(text, cursor);
  if (!active) return { text, mentions, cursor };
  let tokenEnd = cursor;
  while (tokenEnd < text.length && HANDLE_CHAR.test(text[tokenEnd] ?? '')) tokenEnd += 1;
  const token = `@${person.handle}`;
  const replacement = `${token} `;
  const nextText = text.slice(0, active.start) + replacement + text.slice(tokenEnd);
  const delta = replacement.length - (tokenEnd - active.start);
  const kept = mentions.flatMap((mention) => {
    if (mention.end <= active.start) return [mention];
    if (mention.start >= tokenEnd) {
      const shifted = { ...mention, start: mention.start + delta, end: mention.end + delta };
      return nextText.slice(shifted.start, shifted.end) === `@${mention.handle}` ? [shifted] : [];
    }
    return [];
  });
  const mention: DraftMention = {
    userId: person.userId,
    handle: person.handle,
    displayName: person.displayName,
    avatarUrl: person.avatarUrl ?? null,
    start: active.start,
    end: active.start + token.length,
  };
  const nextMentions = kept.length >= limit || kept.some((item) => item.userId === person.userId && item.start === mention.start)
    ? kept
    : [...kept, mention].sort((a, b) => a.start - b.start);
  return { text: nextText, mentions: nextMentions, cursor: mention.end + 1 };
}

function offsetInNormalized(original: string, utf16Index: number): number | null {
  let trimStart = 0;
  while (trimStart < original.length && PHP_TRIM.test(original[trimStart] ?? '')) trimStart += 1;
  let trimEnd = original.length;
  while (trimEnd > trimStart && PHP_TRIM.test(original[trimEnd - 1] ?? '')) trimEnd -= 1;
  if (utf16Index < trimStart || utf16Index > trimEnd) return null;
  const prefix = original.slice(trimStart, utf16Index).replace(/\r\n/g, '\n').replace(/\r/g, '\n').normalize('NFC');
  return codePointLength(prefix);
}

/** Converte o rascunho para o corpo normalizado e offsets em pontos de código. */
export function mentionPayload(text: string, drafts: DraftMention[]): { body: string; mentions: ContentMention[] } {
  const body = normalizeContentText(text);
  const characters = [...body];
  const mentions: ContentMention[] = [];
  for (const draft of [...drafts].sort((left, right) => left.start - right.start)) {
    if (text.slice(draft.start, draft.end) !== `@${draft.handle}`) continue;
    const start = offsetInNormalized(text, draft.start);
    if (start === null) continue;
    const end = start + codePointLength(`@${draft.handle}`);
    if (characters.slice(start, end).join('') !== `@${draft.handle}`) continue;
    mentions.push({ ...draft, avatarUrl: draft.avatarUrl ?? null, start, end });
  }
  return { body, mentions };
}

/** Converte offsets do servidor (pontos de código) para o índice UTF-16 do texto. */
export function codePointRangeToUtf16(text: string, start: number, end: number): { start: number; end: number } | null {
  if (start < 0 || end < start) return null;
  let unit = 0;
  let point = 0;
  let utf16Start: number | null = null;
  while (point <= end) {
    if (point === start) utf16Start = unit;
    if (point === end) return utf16Start === null ? null : { start: utf16Start, end: unit };
    if (unit >= text.length) return null;
    const code = text.codePointAt(unit);
    if (code === undefined) return null;
    unit += code > 0xffff ? 2 : 1;
    point += 1;
  }
  return null;
}
