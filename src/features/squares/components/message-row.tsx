import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { absoluteMediaUrl } from '@/features/media/media-url';
import { initialsOf } from '@/lib/format';

import type { SquareMessage } from '../api';
import { StickerTile } from './sticker-tile';

export const QUICK_REACTIONS = ['❤️', '✊', '😂', '😮', '😢', '👍'];
export type MessageAnchor = { x: number; y: number; width: number; height: number };
type Props = {
  message: SquareMessage;
  separator: boolean;
  /** Lista invertida: o separador é renderizado depois para aparecer acima. */
  inverted?: boolean;
  /** Primeira mensagem de um grupo do mesmo autor: mostra nome e avatar. */
  showAuthor?: boolean;
  onOpenPicker: (m: SquareMessage, anchor: MessageAnchor) => void;
  onReply: (m: SquareMessage) => void;
  onReact: (m: SquareMessage, emoji: string) => void;
  onOriginal: (id: string) => void;
};

export const MessageRow = memo(function MessageRow({ message: m, separator, inverted = false, showAuthor = true, onOpenPicker, onReply, onReact, onOriginal }: Props) {
  const swipeable = useRef<SwipeableMethods>(null);
  const row = useRef<ComponentRef<typeof View>>(null);

  if ((m.status !== 'published' && m.status !== 'deleted') || !m.author) return <View style={styles.removed}><AppText variant="caption">{m.status === 'removed' ? 'Mensagem removida pela moderação' : 'Mensagem indisponível'}</AppText></View>;
  const deleted = m.status === 'deleted';
  const mine = m.viewer.isAuthor;
  const canAct = !deleted && !m.pending && (m.viewer.canReply || m.viewer.canReact || m.viewer.canDelete || m.viewer.canRemove || m.viewer.canReport);
  const openPicker = (event?: GestureResponderEvent) => {
    if (!canAct) return;
    const fallback = { x: event?.nativeEvent.pageX ?? 0, y: event?.nativeEvent.pageY ?? 0, width: 1, height: 1 };
    onOpenPicker(m, fallback);
    row.current?.measureInWindow((x, y, width, height) => onOpenPicker(m, { x, y, width, height }));
  };
  const time = new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const content = <Pressable
    ref={row}
    onLongPress={canAct ? openPicker : undefined}
    delayLongPress={350}
    accessibilityLabel={`${m.author.displayName}, ${deleted ? 'Mensagem excluída' : m.body ?? `figurinha ${m.sticker?.label ?? ''}`}${m.pending ? ', enviando' : ''}`}
    accessibilityHint={canAct ? 'Segure para reações e opções. Deslize para a direita para responder.' : undefined}
    accessibilityActions={canAct ? [...(m.viewer.canReply ? [{ name: 'reply', label: 'Responder' }] : []), { name: 'options', label: 'Reações e opções' }] : []}
    onAccessibilityAction={(event) => event.nativeEvent.actionName === 'reply' ? onReply(m) : openPicker()}
    style={[styles.row, showAuthor && styles.rowGroup, mine && styles.rowMine]}>
    {mine ? null : <View style={[styles.avatarCol, showAuthor && styles.avatarColWithAuthor]}>
      {showAuthor ? <Avatar
        initials={initialsOf(m.author.displayName)}
        tone="red"
        size={28}
        shape="square"
        outline
        userId={m.author.id}
        imageUrl={absoluteMediaUrl(m.author.avatarUrl)}
      /> : null}
    </View>}
    <View style={[styles.content, mine && styles.contentMine]}>
      {!mine && showAuthor ? <View style={styles.authorLine}>
        <AppText style={styles.authorName} numberOfLines={1}>{m.author.displayName}</AppText>
        <AppText variant="caption" numberOfLines={1}>@{m.author.handle}</AppText>
      </View> : null}
      {deleted ? <View style={styles.deletedBox}>
        <AppText style={styles.deletedText}>Mensagem apagada · {time}</AppText>
      </View> : <>
        {m.sticker ? <View style={[styles.stickerWrap, mine && styles.stickerWrapMine]}>
          <StickerTile sticker={m.sticker} />
          <AppText style={[styles.stickerTime, mine && styles.timeMine]}>{time}</AppText>
        </View> : <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {m.replyTo ? <Pressable onPress={() => onOriginal(m.replyTo!.id)} accessibilityRole="button" accessibilityLabel="Ver mensagem respondida" style={styles.reply}>
            <AppText style={styles.replyName} numberOfLines={1}>{m.replyTo.author?.displayName ?? 'Mensagem'}</AppText>
            <AppText style={styles.replyText} numberOfLines={2}>{m.replyTo.body ?? 'Figurinha'}</AppText>
          </Pressable> : null}
          {m.body ? <AppText style={[styles.body, mine && styles.bodyMine]}>{m.body}</AppText> : null}
          <View style={styles.timeRow}>
            {m.pending ? <AppText style={[styles.pending, mine && styles.timeMine]}>Enviando…</AppText> : null}
            <AppText style={[styles.time, mine && styles.timeMine]}>{time}</AppText>
          </View>
        </View>}
        {m.reactions.length ? <View style={[styles.reactions, mine && styles.reactionsMine]}>
          {m.reactions.map((r) => <Pressable key={r.emoji} onPress={() => onReact(m, r.emoji)} disabled={!m.viewer.canReact} accessibilityRole="button" accessibilityLabel={`${r.emoji}, ${r.count} reações`} accessibilityState={{ selected: r.mine, disabled: !m.viewer.canReact }} style={[styles.reaction, r.mine && styles.reacted]}><AppText variant="caption" style={styles.reactionText}>{r.emoji} {r.count}</AppText></Pressable>)}
          {m.viewer.canReact ? <Pressable accessibilityRole="button" accessibilityLabel="Adicionar reação" onPress={openPicker} style={styles.addReaction}><Icon name="plus" size={14} /></Pressable> : null}
        </View> : null}
      </>}
    </View>
  </Pressable>;

  const separatorRule = separator ? <View style={styles.separator}><View style={styles.line} /><AppText variant="label" color={Colors.red}>Novas mensagens</AppText><View style={styles.line} /></View> : null;

  return <View>
    {!inverted ? separatorRule : null}
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
    {inverted ? separatorRule : null}
  </View>;
});

const styles = StyleSheet.create({
  replyAction: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.redSoft,
    borderRightWidth: 1,
    borderRightColor: Colors.rule,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: 2,
    backgroundColor: Colors.cream,
  },
  rowGroup: {
    paddingTop: Spacing.three,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  avatarCol: {
    width: 28,
    flexShrink: 0,
  },
  avatarColWithAuthor: {
    marginTop: 23,
  },
  content: {
    maxWidth: '82%',
    minWidth: 0,
    gap: 3,
    alignItems: 'flex-start',
  },
  contentMine: {
    alignItems: 'flex-end',
  },
  authorLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 5,
    paddingLeft: 2,
    paddingBottom: 1,
  },
  authorName: {
    fontFamily: Fonts.extrabold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  bubble: {
    minWidth: 104,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 2,
    paddingBottom: Spacing.one + 2,
    borderRadius: Radius.sm,
    gap: 3,
  },
  bubbleOther: {
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  bubbleMine: {
    backgroundColor: Colors.ink,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: 15.5,
    lineHeight: 22,
  },
  bodyMine: {
    color: Colors.cream,
  },
  reply: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: Colors.highlight,
    gap: 1,
  },
  replyName: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  replyText: {
    fontSize: 13.5,
    lineHeight: 18,
    color: Colors.inkSoft,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: 1,
  },
  time: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.muted,
  },
  timeMine: {
    color: Colors.onInkMuted,
  },
  pending: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.muted,
  },
  deletedBox: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.strawDark,
    borderRadius: Radius.sm,
  },
  deletedText: {
    fontSize: 13.5,
    lineHeight: 18,
    fontStyle: 'italic',
    color: Colors.muted,
  },
  stickerWrap: {
    alignItems: 'flex-start',
    gap: 2,
  },
  stickerWrapMine: {
    alignItems: 'flex-end',
  },
  stickerTime: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.muted,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  reactionsMine: {
    justifyContent: 'flex-end',
  },
  reaction: {
    minHeight: 34,
    paddingHorizontal: 9,
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  reacted: {
    borderColor: Colors.red,
    backgroundColor: Colors.redSoft,
  },
  reactionText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  addReaction: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
  },
  removed: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.redSoft,
  },
});
