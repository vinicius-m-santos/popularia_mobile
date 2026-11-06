import { useCallback, useState } from 'react';

import { clearScreenMemory, readScreenMemory, writeScreenMemory } from '@/lib/screen-memory';
import type { ContentMention } from '@/types/models';

import { activeMentionQuery, insertMention, mentionPayload, reconcileMentions, type DraftMention, type MentionQuery } from './text';
import type { MentionCandidate } from './api';

type DraftSnapshot = {
  text: string;
  mentions: DraftMention[];
  cursor: number;
  selection: { start: number; end: number } | null;
};

/**
 * Rascunho de texto com menções. Com `storageKey`, o texto, as menções e o
 * cursor sobrevivem à remontagem da tela (voltar de um detalhe, trocar de aba)
 * sem virar rascunho persistente entre sessões.
 */
export function useMentionDraft(storageKey?: string) {
  // `useState` em vez de `useRef`: o valor inicial é lido uma única vez e o
  // render pode usar o rascunho sem tocar em uma ref.
  const [saved] = useState<DraftSnapshot | undefined>(() =>
    storageKey ? readScreenMemory<DraftSnapshot>(storageKey) : undefined,
  );
  const [text, setText] = useState(saved?.text ?? '');
  const [mentions, setMentions] = useState<DraftMention[]>(saved?.mentions ?? []);
  const restoredCursor = Math.min(saved?.cursor ?? 0, saved?.text.length ?? 0);
  const [cursor, setCursor] = useState(restoredCursor);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(
    saved?.selection ??
      (restoredCursor > 0 ? { start: restoredCursor, end: restoredCursor } : null),
  );

  const persist = useCallback(
    (snapshot: DraftSnapshot) => {
      if (storageKey) writeScreenMemory(storageKey, snapshot);
    },
    [storageKey],
  );

  const onChangeText = (next: string) => {
    const nextMentions = reconcileMentions(text, next, mentions);
    const nextCursor = cursor === text.length ? next.length : Math.min(cursor, next.length);
    setMentions(nextMentions);
    setCursor(nextCursor);
    setSelection(null);
    setText(next);
    persist({ text: next, mentions: nextMentions, cursor: nextCursor, selection: null });
  };

  const onSelectionChange = (next: { start: number; end: number }) => {
    // Depois de restaurar o cursor, o primeiro movimento da pessoa solta o
    // controle de seleção: manter o valor antigo impediria o toque em outra posição.
    setCursor(next.start);
    setSelection(null);
    persist({ text, mentions, cursor: next.start, selection: null });
  };

  const query: MentionQuery | null = activeMentionQuery(text, cursor);

  const insert = (person: MentionCandidate) => {
    const next = insertMention(text, cursor, person, mentions);
    const nextSelection = { start: next.cursor, end: next.cursor };
    setText(next.text);
    setMentions(next.mentions);
    setCursor(next.cursor);
    setSelection(nextSelection);
    persist({ text: next.text, mentions: next.mentions, cursor: next.cursor, selection: nextSelection });
  };

  const reset = () => {
    setText('');
    setMentions([]);
    setCursor(0);
    setSelection(null);
    if (storageKey) clearScreenMemory(storageKey);
  };

  const compose = (): { body: string; mentions: ContentMention[] } => mentionPayload(text, mentions);

  return { text, mentions, cursor, selection, query, onChangeText, onSelectionChange, insert, reset, compose };
}
