import { codePointRangeToUtf16 } from '@/features/mentions/text';
import type { ContentMention } from '@/types/models';

const URL = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
const TRAILING = /[),.!?:;]+$/;
const HASHTAG = /(?<![\p{L}\p{M}\p{N}_#@])#([\p{L}\p{M}\p{N}_]+)/gu;

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
export function tokenizePostText(text: string, mentions: ContentMention[] = [], hashtagsEnabled = true): TextMark[] {
  const marks: TextMark[] = [];
  // URLs own their full span, including fragments. Mentions use authoritative code-point
  // offsets; hashtags are only considered in the remaining plain-text spans.
  for (const match of text.matchAll(new RegExp(URL.source, 'gi'))) {
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
