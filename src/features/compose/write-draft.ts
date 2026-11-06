import { activeMentionQuery, insertMention, mentionPayload, reconcileMentions, type DraftMention, type MentionQuery } from '@/features/mentions/text';
import type { MentionCandidate } from '@/features/mentions/api';
import type { ContentMention } from '@/types/models';

type Listener = () => void;

export type WriteDraftSnapshot = {
  text: string;
  title: string;
  titleEnabled: boolean;
  mentions: DraftMention[];
  cursor: number;
  selection: { start: number; end: number } | null;
  query: MentionQuery | null;
  composed: { body: string; mentions: ContentMention[] };
  /** Corpo normalizado ou título não vazios: alimenta rascunho sujo e o botão publicar. */
  hasContent: boolean;
};

/**
 * Rascunho do modo "Escrever" fora do estado do React.
 *
 * A tela do composer guarda destinos, enquete, chamado, mídia e as folhas. O
 * texto e o título mudam a cada tecla e não podem re-renderizar essa árvore
 * inteira. Em vez disso, o editor assina o snapshot completo e a tela assina só
 * `hasContent`, um booleano que muda quando o rascunho deixa de estar vazio.
 */
export type WriteDraftStore = {
  subscribe: (listener: Listener) => () => void;
  subscribeContent: (listener: Listener) => () => void;
  getSnapshot: () => WriteDraftSnapshot;
  getHasContent: () => boolean;
  onChangeText: (next: string) => void;
  onSelectionChange: (next: { start: number; end: number }) => void;
  insert: (person: MentionCandidate) => void;
  setTitle: (next: string) => void;
  setTitleEnabled: (enabled: boolean) => void;
  clearTitle: () => void;
  reset: () => void;
};

function snapshot(
  text: string,
  title: string,
  titleEnabled: boolean,
  mentions: DraftMention[],
  cursor: number,
  selection: { start: number; end: number } | null,
): WriteDraftSnapshot {
  const composed = mentionPayload(text, mentions);
  return {
    text,
    title,
    titleEnabled,
    mentions,
    cursor,
    selection,
    query: activeMentionQuery(text, cursor),
    composed,
    hasContent: composed.body.length > 0 || title.trim().length > 0,
  };
}

export function createWriteDraftStore(): WriteDraftStore {
  let state = snapshot('', '', false, [], 0, null);
  const listeners = new Set<Listener>();
  const contentListeners = new Set<Listener>();

  const notify = (bucket: Set<Listener>) => {
    // Copia a lista: um listener pode cancelar a assinatura durante a notificação.
    for (const listener of [...bucket]) listener();
  };

  const commit = (next: WriteDraftSnapshot) => {
    const previousHasContent = state.hasContent;
    state = next;
    notify(listeners);
    if (next.hasContent !== previousHasContent) notify(contentListeners);
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    subscribeContent: (listener) => {
      contentListeners.add(listener);
      return () => { contentListeners.delete(listener); };
    },
    getSnapshot: () => state,
    getHasContent: () => state.hasContent,
    onChangeText: (next) => {
      const current = state;
      const mentions = reconcileMentions(current.text, next, current.mentions);
      // O cursor acompanha o fim do texto, salvo quando a pessoa está editando no meio.
      const cursor = current.cursor === current.text.length ? next.length : current.cursor;
      commit(snapshot(next, current.title, current.titleEnabled, mentions, cursor, null));
    },
    onSelectionChange: (next) => {
      const current = state;
      const selection = current.selection && current.selection.start === next.start && current.selection.end === next.end
        ? null
        : current.selection;
      commit(snapshot(current.text, current.title, current.titleEnabled, current.mentions, next.start, selection));
    },
    insert: (person) => {
      const current = state;
      const next = insertMention(current.text, current.cursor, person, current.mentions);
      commit(snapshot(
        next.text,
        current.title,
        current.titleEnabled,
        next.mentions,
        next.cursor,
        { start: next.cursor, end: next.cursor },
      ));
    },
    setTitle: (next) => {
      const current = state;
      commit(snapshot(current.text, next, current.titleEnabled, current.mentions, current.cursor, current.selection));
    },
    setTitleEnabled: (enabled) => {
      const current = state;
      commit(snapshot(current.text, current.title, enabled, current.mentions, current.cursor, current.selection));
    },
    clearTitle: () => {
      const current = state;
      commit(snapshot(current.text, '', false, current.mentions, current.cursor, current.selection));
    },
    reset: () => {
      commit(snapshot('', '', false, [], 0, null));
    },
  };
}
