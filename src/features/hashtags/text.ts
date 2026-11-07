import { codePointRangeToUtf16 } from '@/features/mentions/text';
import type { ContentMention } from '@/types/models';

const URL = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
const TRAILING = /[),.!?:;]+$/;
const HASHTAG = /(?<![\p{L}\p{M}\p{N}_#@])#([\p{L}\p{M}\p{N}_]+)/gu;

// O mesmo texto é tokenizado no feed, na descoberta, no detalhe e na busca. O
// cache curto evita repetir a varredura/regex a cada commit sem guardar o
// conteúdo por mais tempo do que a lista que ainda pode voltar à tela.
const MAX_CACHED_TEXTS = 200;
const MAX_CACHED_VARIANTS_PER_TEXT = 4;
const EMPTY_MENTIONS: ContentMention[] = [];
const tokenizeCache = new Map<string, Map<string, TextMark[]>>();

export type TextMark = {
  start: number;
  end: number;
  label: string;
  mention?: ContentMention;
  href?: string;
  hashtag?: string;
};

export function normalizedHashtag(name: string): string {
  return name.normalize('NFD').replace(/\p{Mn}+/gu, '').normalize('NFC').toLowerCase();
}

/** Shared tokenizer for display, demo discovery, and targeted cache invalidation. */
export function tokenizePostText(text: string, mentions: ContentMention[] = EMPTY_MENTIONS, hashtagsEnabled = true): TextMark[] {
  const key = cacheKey(mentions, hashtagsEnabled);
  const cached = tokenizeCache.get(text)?.get(key);
  if (cached) return cached;
  const marks = tokenize(text, mentions, hashtagsEnabled);
  cacheMarks(text, key, marks);
  return marks;
}

function cacheKey(mentions: ContentMention[], hashtagsEnabled: boolean): string {
  // O objeto da menção também carrega nome/avatar para o toque; incluir o JSON
  // completo evita devolver uma referência antiga depois de uma edição de perfil.
  return `${hashtagsEnabled ? '1' : '0'}:${mentions.length ? JSON.stringify(mentions) : ''}`;
}

function cacheMarks(text: string, key: string, marks: TextMark[]): void {
  let variants = tokenizeCache.get(text);
  if (!variants) {
    if (tokenizeCache.size >= MAX_CACHED_TEXTS) {
      const oldest = tokenizeCache.keys().next().value;
      if (oldest !== undefined) tokenizeCache.delete(oldest);
    }
    variants = new Map();
    tokenizeCache.set(text, variants);
  } else if (variants.size >= MAX_CACHED_VARIANTS_PER_TEXT && !variants.has(key)) {
    const oldest = variants.keys().next().value;
    if (oldest !== undefined) variants.delete(oldest);
  }
  variants.set(key, marks);
}

/** Os chamadores tratam os marks como somente leitura; por isso a lista pode ser compartilhada. */
function tokenize(text: string, mentions: ContentMention[], hashtagsEnabled: boolean): TextMark[] {
  const marks: TextMark[] = [];
  // URLs own their full span, including fragments. Mentions use authoritative code-point
  // offsets; hashtags are only considered in the remaining plain-text spans.
  for (const match of text.matchAll(URL)) {
    const index = match.index ?? 0;
    const label = match[0].replace(TRAILING, '');
    const href = label.startsWith('www.') ? `https://${label}` : label;
    marks.push({ start: index, end: index + label.length, label, href });
  }
  for (const mention of mentions) {
    const range = codePointRangeToUtf16(text, mention.start, mention.end);
    if (!range) continue;
    const label = text.slice(range.start, range.end);
    if (!label.startsWith('@')) continue;
    if (marks.some((mark) => range.start < mark.end && range.end > mark.start)) continue;
    marks.push({ start: range.start, end: range.end, label, mention });
  }
  for (const match of hashtagsEnabled ? text.matchAll(HASHTAG) : []) {
    const index = match.index ?? 0;
    const label = match[0];
    const end = index + label.length;
    if (!/[\p{L}\p{N}]/u.test(match[1])) continue;
    if ([...match[1]].length > 50) continue;
    if (marks.some((mark) => index < mark.end && end > mark.start)) continue;
    marks.push({ start: index, end, label, hashtag: normalizedHashtag(match[1]) });
  }
  marks.sort((left, right) => left.start - right.start);
  return marks;
}
