import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AuthorDto } from '@/lib/api/dto';
import { ApiError, describeError } from '@/lib/errors';

import * as api from './api';
import { mergeMessages, optimisticReaction } from './message-state';

export function useSquare(id: string, author: AuthorDto) {
  const [square, setSquare] = useState<api.Square | null>(null);
  const [messages, setMessages] = useState<api.SquareMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const unreadNew = useRef(0);
  const gap = useRef(false);
  const [hasRecentGap, setHasRecentGap] = useState(false);
  const [separatorId, setSeparatorId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const rows = useRef(messages);
  const detail = useRef(square);
  const before = useRef<string | null>(null);
  const change = useRef(0);
  const openingLatestId = useRef('');
  const observedNewIds = useRef(new Set<string>());
  const atBottom = useRef(true);
  const focused = useRef(false);
  const generation = useRef(0);
  const contentEpoch = useRef(0);
  const sendLock = useRef(false);
  const olderLock = useRef(false);
  const recentLock = useRef(false);
  const reactionLocks = useRef(new Set<string>());
  const retryPayload = useRef<{ key: string; clientId: string } | null>(null);
  const sync = useRef<() => Promise<void>>(async () => {});
  const readId = useRef('');
  const readBusy = useRef(false);

  const update = useCallback((next: api.SquareMessage[] | ((old: api.SquareMessage[]) => api.SquareMessage[])) => {
    const result = typeof next === 'function' ? next(rows.current) : next;
    rows.current = result;
    setMessages(result);
  }, []);
  const noteSquare = useCallback((next: api.Square | null) => { detail.current = next; setSquare(next); }, []);
  const noteCursor = useCallback((cursor: string | null) => { before.current = cursor; setNextCursor(cursor); }, []);
  const live = useCallback((g: number) => generation.current === g && focused.current && AppState.currentState === 'active', []);

  const readVisible = useCallback(async () => {
    if (!focused.current || AppState.currentState !== 'active' || !atBottom.current || gap.current || unreadNew.current > 0 || readBusy.current) return;
    const latest = rows.current.find((m) => !m.pending && m.author && m.status === 'published');
    if (!latest || latest.id <= readId.current) return;
    readBusy.current = true;
    try { await api.markRead(id, latest.id); readId.current = latest.id; } catch { /* Tenta novamente no próximo ciclo. */ }
    finally { readBusy.current = false; }
  }, [id]);

  const loadRecent = useCallback(async (g: number, preserveSeparator = false) => {
    const epoch = ++contentEpoch.current;
    const s = await api.getSquare(id);
    if (!live(g) || epoch !== contentEpoch.current) return false;
    noteSquare(s);
    if (!s.viewer.canRead) { update([]); noteCursor(null); return true; }
    const page = await api.getMessages(id);
    if (!live(g) || epoch !== contentEpoch.current) return false;
    noteSquare(page.square);
    change.current = page.changeCursor;
    openingLatestId.current = page.items[0]?.id ?? '';
    observedNewIds.current.clear();
    readId.current = s.lastReadId ?? '';
    update(page.items);
    noteCursor(page.nextCursor);
    setNewCount(0); unreadNew.current = 0; gap.current = false; setHasRecentGap(false);
    if (!preserveSeparator) {
      const unread = [...page.items].reverse().find((m) => m.status === 'published' && !m.viewer.isAuthor && m.id > (s.lastReadId ?? ''));
      setSeparatorId(s.unread ? unread?.id ?? null : null);
    }
    return true;
  }, [id, live, noteSquare, noteCursor, update]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    const g = ++generation.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let initialized = false;
    let lastHeartbeat = 0;
    let delay = 3000;
    const tick = async () => {
      if (busy || !live(g)) return;
      busy = true;
      clearTimeout(timer);
      try {
        if (!initialized) {
          initialized = await loadRecent(g);
        } else if (detail.current?.viewer.canRead) {
          const epoch = contentEpoch.current;
          const page = await api.getMessages(id, { after: change.current, refreshIds: rows.current.filter((m) => !m.pending).map((m) => m.id) });
          if (!live(g) || epoch !== contentEpoch.current) return;
          noteSquare(page.square);
          change.current = Math.max(change.current, page.changeCursor);
          const fresh = page.items.filter((m) => m.id > openingLatestId.current && !observedNewIds.current.has(m.id) && m.status === 'published' && !m.viewer.isAuthor);
          for (const m of page.items) if (m.id > openingLatestId.current) observedNewIds.current.add(m.id);
          if (!atBottom.current && fresh.length) { unreadNew.current += fresh.length; setNewCount(unreadNew.current); }
          const incoming = atBottom.current ? page.items : page.items.filter((m) => rows.current.some((old) => old.id === m.id || (old.pending && old.clientId === m.clientId)));
          update((old) => {
            const combined = mergeMessages(old, [...page.refreshed, ...incoming], 250);
            const merged = combined.slice(0, 200);
            if (combined.length > 200 && atBottom.current) noteCursor(merged[merged.length - 1].id);
            return merged.map((m) => {
              const previous = old.find((o) => o.id === m.id);
              return reactionLocks.current.has(m.id) && m.status === 'published' && previous ? { ...m, reactions: previous.reactions } : m;
            });
          });
          if (page.hasMoreChanges) delay = 100;
          else delay = 3000;
        } else {
          // Um pedido pode ser aceito por outro aparelho enquanto o estado bloqueado está aberto.
          const epoch = contentEpoch.current;
          const fresh = await api.getSquare(id);
          if (!live(g) || epoch !== contentEpoch.current) return;
          noteSquare(fresh);
          if (fresh.viewer.canRead) await loadRecent(g);
        }
        if (!live(g)) return;
        if (detail.current?.viewer.canRead && detail.current.status === 'active' && Date.now() - lastHeartbeat > 30000) {
          const epoch = contentEpoch.current;
          const presence = await api.heartbeat(id);
          if (!live(g) || epoch !== contentEpoch.current) return;
          lastHeartbeat = Date.now();
          if (detail.current) noteSquare({ ...detail.current, presence: presence.count });
        }
        if (delay !== 100) await readVisible();
        if (live(g)) { setSyncError(null); setError(null); }
      } catch (e) {
        if (!live(g)) return;
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
          // Invalida imediatamente todo conteúdo/stickers/replies após revogação de acesso.
          update([]); noteSquare(null); initialized = false;
          setError(describeError(e));
        } else if (!initialized) setError(describeError(e));
        else setSyncError('Sem atualização da conversa. Tentando reconectar…');
        delay = Math.min(delay * 2, 15000);
      } finally {
        busy = false;
        if (live(g)) { setLoading(false); timer = setTimeout(tick, delay); }
      }
    };
    sync.current = tick;
    setLoading(true);
    void tick();
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') void tick();
      else contentEpoch.current++;
    });
    return () => { focused.current = false; generation.current++; clearTimeout(timer); subscription.remove(); };
  }, [id, live, loadRecent, noteSquare, noteCursor, update, readVisible]));

  // Dá tempo para a lista exibir a mensagem antes de avançar a leitura.
  useEffect(() => { const timer = setTimeout(() => { void readVisible(); }, 900); return () => clearTimeout(timer); }, [messages, readVisible]);

  const loadOlder = useCallback(async () => {
    if (!before.current || olderLock.current || !focused.current) return;
    olderLock.current = true; setLoadingOlder(true); setOlderError(null);
    const g = generation.current;
    const epoch = contentEpoch.current;
    try {
      const page = await api.getMessages(id, { cursor: before.current });
      if (!live(g) || epoch !== contentEpoch.current) return;
      noteCursor(page.nextCursor);
      // Janela limitada; ao ler longe do final, preserva o trecho antigo e oferece voltar às recentes.
      const merged = mergeMessages(rows.current, page.items, 230);
      if (merged.length > 200) { gap.current = true; atBottom.current = false; setHasRecentGap(true); }
      update(merged.length > 200 ? merged.slice(-200) : merged);
    } catch (e) { if (live(g)) setOlderError(describeError(e)); }
    finally { olderLock.current = false; setLoadingOlder(false); }
  }, [id, live, noteCursor, update]);

  const jumpRecent = useCallback(async () => {
    if (recentLock.current) return;
    recentLock.current = true;
    const g = generation.current;
    try { if (await loadRecent(g, true)) { atBottom.current = true; setSyncError(null); } }
    catch (e) { if (live(g)) setSyncError(describeError(e)); }
    finally { recentLock.current = false; }
  }, [loadRecent, live]);

  const send = useCallback(async (payload: Omit<api.NewMessage, 'clientId'>, sticker?: api.Sticker): Promise<boolean> => {
    if (sendLock.current || !detail.current?.viewer.canWrite) return false;
    sendLock.current = true; setSending(true); setSendError(null);
    const key = JSON.stringify(payload);
    const clientId = retryPayload.current?.key === key ? retryPayload.current.clientId : `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
    retryPayload.current = { key, clientId };
    const localId = `local_${clientId}`;
    const parent = rows.current.find((m) => m.id === payload.replyToId);
    const optimistic: api.SquareMessage = {
      id: localId, squareId: id, status: 'published', body: payload.body ?? null, sticker: sticker ?? null,
      author, replyTo: parent ? { id: parent.id, author: parent.author, body: parent.body ?? 'Figurinha', status: parent.status } : null,
      reactions: [], createdAt: new Date().toISOString(), editedAt: null, revision: 0, clientId, pending: true,
      viewer: { isAuthor: true, canDelete: false, canRemove: false, canReport: false, canReact: false, canReply: false },
    };
    const g = generation.current;
    update((old) => mergeMessages(old, [optimistic]));
    try {
      const created = await api.sendMessage(id, { ...payload, clientId });
      if (live(g)) { update((old) => mergeMessages(old, [created])); setSyncError(null); }
      retryPayload.current = null;
      return true;
    } catch (e) {
      if (live(g)) { update((old) => old.filter((m) => m.id !== localId)); setSendError(`Não foi possível enviar. ${describeError(e)}`); void sync.current(); }
      return false;
    } finally { sendLock.current = false; setSending(false); }
  }, [id, author, live, update]);

  const react = useCallback(async (message: api.SquareMessage, emoji: string) => {
    const key = message.id;
    if (!message.viewer.canReact || reactionLocks.current.has(key)) return;
    reactionLocks.current.add(key);
    const previous = rows.current.find((m) => m.id === message.id);
    if (!previous) { reactionLocks.current.delete(key); return; }
    const g = generation.current;
    const active = !previous.reactions.find((r) => r.emoji === emoji)?.mine;
    update((old) => old.map((m) => m.id === key ? { ...m, reactions: optimisticReaction(m.reactions, emoji) } : m));
    try {
      const result = await api.setReaction(id, key, emoji, active);
      if (live(g)) update((old) => old.some((m) => m.id === key && m.status === 'published') ? mergeMessages(old, [result]) : old);
    } catch (e) {
      if (live(g)) { update((old) => old.map((m) => m.id === key && m.status === 'published' ? { ...m, reactions: previous.reactions } : m)); setSyncError(describeError(e)); }
    } finally { reactionLocks.current.delete(key); }
  }, [id, live, update]);

  return {
    square, messages, loading, error, syncError: sendError ?? syncError, olderError, loadingOlder, sending, newCount, hasRecentGap, separatorId, nextCursor,
    reload: () => sync.current(), loadOlder, jumpRecent, send, react,
    onBottom: (bottom: boolean) => {
      atBottom.current = bottom && !gap.current && unreadNew.current === 0;
      if (bottom && unreadNew.current > 0 && !gap.current) void jumpRecent();
      else if (atBottom.current) void readVisible();
    },
  };
}
