import { useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import type { SquareMessage } from '../api';

const EMOJIS = ['😀', '😂', '😍', '🤔', '😮', '😢', '🤝', '✊', '❤️', '🔥', '👏', '👍'];

export function SquareComposer({ inputRef, reply, sending, onCancel, onSend, onStickers }: {
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>; reply: SquareMessage | null; sending: boolean;
  onCancel: () => void; onSend: (text: string) => Promise<boolean>; onStickers: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [emojis, setEmojis] = useState(false);
  const keyboard = useKeyboardVisible();
  const lock = useRef(false);
  const insets = useSafeAreaInsets();
  const submit = async () => {
    if (lock.current || sending || !draft.trim()) return;
    lock.current = true;
    const submitted = draft;
    try { if (await onSend(submitted.trim())) setDraft((current) => current === submitted ? '' : current); }
    finally { lock.current = false; }
  };
  const disabled = sending || !draft.trim();

  return (
    <View style={[styles.root, { paddingBottom: keyboard ? 0 : Math.max(insets.bottom, Spacing.two) }]}>
      {reply ? (
        <View style={styles.reply}>
          <View style={styles.replyCopy}>
            <AppText variant="label" color={Colors.red}>Respondendo a {reply.author?.displayName ?? 'mensagem'}</AppText>
            <AppText variant="caption" numberOfLines={1}>{reply.body ?? reply.sticker?.label ?? 'Mensagem indisponível'}</AppText>
          </View>
          <IconButton icon="close" accessibilityLabel="Cancelar resposta" onPress={onCancel} />
        </View>
      ) : null}

      {emojis ? (
        <View style={styles.emojiPanel}>
          {EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => { setDraft((d) => (d + emoji).slice(0, 2000)); setEmojis(false); inputRef.current?.focus(); }}
              accessibilityRole="button"
              accessibilityLabel={`Inserir ${emoji}`}
              style={styles.emoji}>
              <AppText style={styles.emojiText}>{emoji}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.composer}>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Figurinhas" onPress={onStickers} hitSlop={4} style={({ pressed }) => [styles.squareButton, pressed && styles.pressed]}>
            <Icon name="plus" size={18} />
          </Pressable>
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Mensagem para a praça"
              placeholderTextColor={Colors.placeholder}
              accessibilityLabel="Conversar na praça"
              multiline
              numberOfLines={1}
              maxLength={2000}
              style={styles.input}
              textAlignVertical="center"
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Escolher emoji" onPress={() => setEmojis((value) => !value)} style={styles.emojiInline} hitSlop={6}>
              <Icon name="smile" size={18} color={Colors.ink} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sending ? 'Enviando mensagem' : 'Enviar mensagem'}
            disabled={disabled}
            accessibilityState={{ disabled }}
            hitSlop={4}
            onPress={() => { void submit(); }}
            style={({ pressed }) => [styles.send, disabled && styles.sendDisabled, pressed && styles.pressed]}>
            <Icon name="send" size={18} color={disabled ? Colors.placeholder : Colors.ink} />
          </Pressable>
        </View>
        {draft.length > 1800 ? <AppText variant="caption" style={styles.count}>{draft.length}/2000</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  replyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  emojiPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    padding: Spacing.two,
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  composer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  squareButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 33,
    maxHeight: 132,
    paddingVertical: 7,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.ink,
  },
  emojiInline: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 23,
    lineHeight: 30,
  },
  send: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.strawLight,
  },
  sendDisabled: {
    backgroundColor: Colors.strawLight,
    borderColor: Colors.strawDark,
  },
  pressed: {
    opacity: 0.65,
  },
  count: {
    textAlign: 'right',
    paddingHorizontal: Spacing.two,
  },
});
