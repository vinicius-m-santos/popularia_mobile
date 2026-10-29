import { useState } from 'react';

import type { ContentMention } from '@/types/models';

import { activeMentionQuery, insertMention, mentionPayload, reconcileMentions, type DraftMention, type MentionQuery } from './text';
import type { MentionCandidate } from './api';

export function useMentionDraft() {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<DraftMention[]>([]);
  const [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);

  const onChangeText = (next: string) => {
    setMentions((current) => reconcileMentions(text, next, current));
    setCursor((current) => (current === text.length ? next.length : current));
    setSelection(null);
    setText(next);
  };

  const onSelectionChange = (next: { start: number; end: number }) => {
    setCursor(next.start);
    setSelection((current) => (current && current.start === next.start && current.end === next.end ? null : current));
  };

  const query: MentionQuery | null = activeMentionQuery(text, cursor);

  const insert = (person: MentionCandidate) => {
    const next = insertMention(text, cursor, person, mentions);
    setText(next.text);
    setMentions(next.mentions);
    setCursor(next.cursor);
    setSelection({ start: next.cursor, end: next.cursor });
  };

  const reset = () => {
    setText('');
    setMentions([]);
    setCursor(0);
    setSelection(null);
  };

  const compose = (): { body: string; mentions: ContentMention[] } => mentionPayload(text, mentions);

  return { text, mentions, cursor, selection, query, onChangeText, onSelectionChange, insert, reset, compose };
}
