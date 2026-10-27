import { memo, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Colors, Spacing } from '@/constants/theme';
import { initialsOf } from '@/lib/format';

import type { SquareMessage } from '../api';
import { StickerTile } from './sticker-tile';

export const QUICK_REACTIONS = ['❤️', '✊', '😂', '😮', '😢'];
type Props = {
  message: SquareMessage; selected: boolean; separator: boolean;
  onSelect: (id: string | null) => void; onReply: (m: SquareMessage) => void;
  onReact: (m: SquareMessage, emoji: string) => void; onActions: (m: SquareMessage) => void;
  onOriginal: (id: string) => void;
};

export const MessageRow = memo(function MessageRow({ message: m, selected, separator, onSelect, onReply, onReact, onActions, onOriginal }: Props) {
  const translation = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const responder = useMemo(() => {
    const reset = () => { setReady(false); Animated.spring(translation, { toValue: 0, useNativeDriver: true, speed: 25, bounciness: 2 }).start(); };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => m.viewer.canReply && !m.pending && gesture.dx > 14 && gesture.dx > Math.abs(gesture.dy) * 2,
      onPanResponderMove: (_, gesture) => { translation.setValue(Math.max(0, Math.min(64, gesture.dx * 0.8))); setReady(gesture.dx >= 64); },
      onPanResponderRelease: (_, gesture) => { if (gesture.dx >= 64 && Math.abs(gesture.dy) < gesture.dx / 2) onReply(m); reset(); },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => true,
    });
  }, [m, onReply, translation]);

  if (m.status !== 'published' || !m.author) return <View style={styles.removed}><AppText variant="caption">{m.status === 'removed' ? 'Mensagem removida pela moderação' : m.status === 'hidden' ? 'Mensagem indisponível' : 'Mensagem excluída'}</AppText></View>;
  const canAct = !m.pending && (m.viewer.canReply || m.viewer.canReact || m.viewer.canDelete || m.viewer.canRemove || m.viewer.canReport);
  return <View>
    {separator ? <View style={styles.separator}><View style={styles.line} /><AppText variant="label" color={Colors.red}>Novas mensagens</AppText><View style={styles.line} /></View> : null}
    <View style={styles.swipeTrack}>
      <Animated.View style={[styles.replyIcon, { opacity: translation.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' }) }]}><Icon name="reply" color={ready ? Colors.red : Colors.muted} size={22} /></Animated.View>
      <Animated.View style={{ transform: [{ translateX: translation }] }} {...responder.panHandlers}>
        <Pressable
          onLongPress={canAct ? () => onSelect(selected ? null : m.id) : undefined}
          delayLongPress={350}
          accessibilityLabel={`${m.author.displayName}, ${m.body ?? `figurinha ${m.sticker?.label ?? ''}`}${m.pending ? ', enviando' : ''}`}
          accessibilityHint={canAct ? 'Segure para reações e opções. Deslize para a direita para responder.' : undefined}
          accessibilityActions={canAct ? [...(m.viewer.canReply ? [{ name: 'reply', label: 'Responder' }] : []), { name: 'options', label: 'Reações e opções' }] : []}
          onAccessibilityAction={(event) => event.nativeEvent.actionName === 'reply' ? onReply(m) : onSelect(m.id)}
          style={[styles.row, m.viewer.isAuthor && styles.mine]}>
          <Avatar initials={initialsOf(m.author.displayName)} tone={m.viewer.isAuthor ? 'black' : 'red'} size={34} />
          <View style={styles.content}>
            {selected ? <View style={styles.quick} accessibilityLabel="Reações rápidas">
              {m.viewer.canReact ? QUICK_REACTIONS.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Reagir ${emoji}`} onPress={() => { onReact(m, emoji); onSelect(null); }} style={styles.emoji}><AppText style={styles.emojiText}>{emoji}</AppText></Pressable>) : null}
              <IconButton icon="plus" accessibilityLabel="Mais ações da mensagem" onPress={() => { onSelect(null); onActions(m); }} />
            </View> : null}
            <View style={styles.meta}>
              <AppText variant="bodyStrong">{m.author.displayName}</AppText>
              <AppText variant="caption">@{m.author.handle}</AppText>
              <AppText variant="caption">· {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</AppText>
            </View>
            {m.replyTo ? <Pressable onPress={() => onOriginal(m.replyTo!.id)} accessibilityRole="button" accessibilityLabel="Ver mensagem respondida" style={styles.reply}>
              <AppText variant="caption" numberOfLines={2}>{m.replyTo.author ? `${m.replyTo.author.displayName}: ${m.replyTo.body ?? 'Figurinha'}` : 'Mensagem indisponível'}</AppText>
            </Pressable> : null}
            {m.body ? <AppText style={styles.body}>{m.body}</AppText> : null}
            {m.sticker ? <StickerTile sticker={m.sticker} /> : null}
            {m.pending ? <AppText variant="caption">Enviando…</AppText> : null}
            {m.reactions.length ? <View style={styles.reactions}>
              {m.reactions.map((r) => <Pressable key={r.emoji} onPress={() => onReact(m, r.emoji)} disabled={!m.viewer.canReact} accessibilityRole="button" accessibilityLabel={`${r.emoji}, ${r.count} reações`} accessibilityState={{ selected: r.mine, disabled: !m.viewer.canReact }} style={[styles.reaction, r.mine && styles.reacted]}><AppText variant="caption">{r.emoji} {r.count}</AppText></Pressable>)}
              {m.viewer.canReact ? <IconButton icon="plus" size={14} accessibilityLabel="Adicionar reação" onPress={() => onSelect(m.id)} /> : null}
            </View> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  </View>;
});
const styles = StyleSheet.create({
  swipeTrack: { overflow: 'hidden' }, replyIcon: { position: 'absolute', left: 12, top: 24 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.five, paddingVertical: 12, borderLeftWidth: 2, borderLeftColor: 'transparent' },
  mine: { backgroundColor: Colors.strawLight, borderLeftColor: Colors.red }, content: { flex: 1, minWidth: 0, gap: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 5 }, body: { fontSize: 14.5, lineHeight: 22 },
  reply: { paddingVertical: 5, paddingHorizontal: 10, borderLeftWidth: 2.5, borderLeftColor: Colors.red, backgroundColor: Colors.highlight, borderRadius: 4 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, reaction: { minHeight: 44, paddingHorizontal: 9, justifyContent: 'center', backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.rule, borderRadius: 18 }, reacted: { borderColor: Colors.red, backgroundColor: Colors.redSoft },
  quick: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.rule, borderRadius: 24, paddingHorizontal: 4 }, emoji: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, emojiText: { fontSize: 22, lineHeight: 30 },
  removed: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' }, separator: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18 }, line: { flex: 1, height: 1, backgroundColor: Colors.redSoft },
});
