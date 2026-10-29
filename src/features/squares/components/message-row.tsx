import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';
import { absoluteMediaUrl } from '@/features/media/media-url';
import { initialsOf } from '@/lib/format';

import type { SquareMessage } from '../api';
import { StickerTile } from './sticker-tile';

export const QUICK_REACTIONS = ['❤️', '✊', '😂', '😮', '😢'];
export type MessageAnchor = { x: number; y: number; width: number; height: number };
type Props = {
  message: SquareMessage; separator: boolean;
  onOpenPicker: (m: SquareMessage, anchor: MessageAnchor) => void; onReply: (m: SquareMessage) => void;
  onReact: (m: SquareMessage, emoji: string) => void;
  onOriginal: (id: string) => void;
};

export const MessageRow = memo(function MessageRow({ message: m, separator, onOpenPicker, onReply, onReact, onOriginal }: Props) {
  const swipeable = useRef<SwipeableMethods>(null);
  const row = useRef<ComponentRef<typeof View>>(null);

  if ((m.status !== 'published' && m.status !== 'deleted') || !m.author) return <View style={styles.removed}><AppText variant="caption">{m.status === 'removed' ? 'Mensagem removida pela moderação' : 'Mensagem indisponível'}</AppText></View>;
  const deleted = m.status === 'deleted';
  const canAct = !deleted && !m.pending && (m.viewer.canReply || m.viewer.canReact || m.viewer.canDelete || m.viewer.canRemove || m.viewer.canReport);
  const openPicker = (event?: GestureResponderEvent) => {
    if (!canAct) return;
    const fallback = { x: event?.nativeEvent.pageX ?? 0, y: event?.nativeEvent.pageY ?? 0, width: 1, height: 1 };
    onOpenPicker(m, fallback);
    row.current?.measureInWindow((x, y, width, height) => onOpenPicker(m, { x, y, width, height }));
  };
  const content = <Pressable
    ref={row}
    onLongPress={canAct ? openPicker : undefined}
    delayLongPress={350}
    accessibilityLabel={`${m.author.displayName}, ${deleted ? 'Mensagem excluída' : m.body ?? `figurinha ${m.sticker?.label ?? ''}`}${m.pending ? ', enviando' : ''}`}
    accessibilityHint={canAct ? 'Segure para reações e opções. Deslize para a direita para responder.' : undefined}
    accessibilityActions={canAct ? [...(m.viewer.canReply ? [{ name: 'reply', label: 'Responder' }] : []), { name: 'options', label: 'Reações e opções' }] : []}
    onAccessibilityAction={(event) => event.nativeEvent.actionName === 'reply' ? onReply(m) : openPicker()}
    style={[styles.row, m.viewer.isAuthor && styles.mine]}>
    <Avatar initials={initialsOf(m.author.displayName)} tone={m.viewer.isAuthor ? 'black' : 'red'} size={34} userId={m.author.id} imageUrl={absoluteMediaUrl(m.author.avatarUrl)} />
    <View style={styles.content}>
      <View style={styles.meta}>
        <AppText variant="bodyStrong">{m.author.displayName}</AppText>
        <AppText variant="caption">@{m.author.handle}</AppText>
        <AppText variant="caption">· {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</AppText>
      </View>
      {deleted ? <AppText style={styles.deletedBody}>Mensagem excluída</AppText> : <>
        {m.replyTo ? <Pressable onPress={() => onOriginal(m.replyTo!.id)} accessibilityRole="button" accessibilityLabel="Ver mensagem respondida" style={styles.reply}>
          <AppText variant="caption" numberOfLines={2}>{m.replyTo.author ? `${m.replyTo.author.displayName}: ${m.replyTo.body ?? 'Figurinha'}` : 'Mensagem indisponível'}</AppText>
        </Pressable> : null}
        {m.body ? <AppText style={styles.body}>{m.body}</AppText> : null}
        {m.sticker ? <StickerTile sticker={m.sticker} /> : null}
        {m.pending ? <AppText variant="caption">Enviando…</AppText> : null}
        {m.reactions.length ? <View style={styles.reactions}>
          {m.reactions.map((r) => <Pressable key={r.emoji} onPress={() => onReact(m, r.emoji)} disabled={!m.viewer.canReact} accessibilityRole="button" accessibilityLabel={`${r.emoji}, ${r.count} reações`} accessibilityState={{ selected: r.mine, disabled: !m.viewer.canReact }} style={[styles.reaction, r.mine && styles.reacted]}><AppText variant="caption">{r.emoji} {r.count}</AppText></Pressable>)}
          {m.viewer.canReact ? <Pressable accessibilityRole="button" accessibilityLabel="Adicionar reação" onPress={openPicker} style={styles.addReaction}><Icon name="plus" size={16} /></Pressable> : null}
        </View> : null}
      </>}
    </View>
  </Pressable>;

  return <View>
    {separator ? <View style={styles.separator}><View style={styles.line} /><AppText variant="label" color={Colors.red}>Novas mensagens</AppText><View style={styles.line} /></View> : null}
    <ReanimatedSwipeable
      ref={swipeable}
      enabled={!deleted && !m.pending && m.viewer.canReply}
      dragOffsetFromLeft={14}
      leftThreshold={56}
      overshootLeft={false}
      renderLeftActions={() => <View style={styles.replyAction}><Icon name="reply" color={Colors.red} size={22} /></View>}
      onSwipeableOpen={(direction) => {
        if (direction === SwipeDirection.RIGHT) onReply(m);
        swipeable.current?.close();
      }}>
      {content}
    </ReanimatedSwipeable>
  </View>;
});
const styles = StyleSheet.create({
  replyAction: { width: 72, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.five, paddingVertical: 12, borderLeftWidth: 2, borderLeftColor: 'transparent' },
  mine: { backgroundColor: Colors.strawLight, borderLeftColor: Colors.red }, content: { flex: 1, minWidth: 0, gap: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 5 }, body: { fontSize: 14.5, lineHeight: 22 },
  deletedBody: { fontSize: 14.5, lineHeight: 22, fontStyle: 'italic', color: Colors.muted },
  reply: { paddingVertical: 5, paddingHorizontal: 10, borderLeftWidth: 2.5, borderLeftColor: Colors.red, backgroundColor: Colors.highlight, borderRadius: 4 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, reaction: { minHeight: 44, paddingHorizontal: 9, justifyContent: 'center', backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.rule, borderRadius: 18 }, reacted: { borderColor: Colors.red, backgroundColor: Colors.redSoft },
  addReaction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  removed: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' }, separator: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18 }, line: { flex: 1, height: 1, backgroundColor: Colors.redSoft },
});
