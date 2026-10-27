import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Colors, Fonts } from '@/constants/theme';
import type { SquareMessage } from '../api';

export function SquareComposer({ inputRef, reply, sending, onCancel, onSend, onStickers }: {
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>; reply: SquareMessage | null; sending: boolean;
  onCancel: () => void; onSend: (text: string) => Promise<boolean>; onStickers: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [emojis, setEmojis] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const lock = useRef(false);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const submit = async () => {
    if (lock.current || sending || !draft.trim()) return;
    lock.current = true;
    const submitted = draft;
    try { if (await onSend(submitted.trim())) setDraft((current) => current === submitted ? '' : current); }
    finally { lock.current = false; }
  };
  return <View style={[styles.root, { paddingBottom: keyboard ? 8 : Math.max(insets.bottom, 8) }]}>
    {reply ? <View style={styles.reply}>
      <View style={styles.flex}><AppText variant="caption" color={Colors.red}>Respondendo a {reply.author?.displayName ?? 'mensagem'}</AppText><AppText variant="caption" numberOfLines={1}>{reply.body ?? reply.sticker?.label ?? 'Mensagem indisponível'}</AppText></View>
      <IconButton icon="close" accessibilityLabel="Cancelar resposta" onPress={onCancel} />
    </View> : null}
    {emojis ? <View style={styles.emojis}>{['😀', '😂', '😍', '🤔', '😮', '😢', '🤝', '✊', '❤️', '🔥', '👏', '👍'].map((emoji) => <Pressable key={emoji} onPress={() => { setDraft((d) => (d + emoji).slice(0, 2000)); setEmojis(false); inputRef.current?.focus(); }} accessibilityRole="button" accessibilityLabel={`Inserir ${emoji}`} style={styles.emoji}><AppText style={styles.emojiText}>{emoji}</AppText></Pressable>)}</View> : null}
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher emoji" onPress={() => setEmojis((value) => !value)} style={styles.emoji}><AppText style={styles.emojiText}>☺</AppText></Pressable>
      <TextInput ref={inputRef} value={draft} onChangeText={setDraft} placeholder="Conversar na praça..." placeholderTextColor={Colors.placeholder} accessibilityLabel="Conversar na praça" multiline maxLength={2000} style={styles.input} textAlignVertical="center" />
      <IconButton icon="sticker" accessibilityLabel="Figurinhas" onPress={onStickers} color={Colors.muted} />
      <Pressable accessibilityRole="button" accessibilityLabel={sending ? 'Enviando mensagem' : 'Enviar mensagem'} disabled={sending || !draft.trim()} accessibilityState={{ disabled: sending || !draft.trim() }} onPress={() => { void submit(); }} style={styles.send}><Icon name="send" color={sending || !draft.trim() ? Colors.placeholder : Colors.red} /></Pressable>
    </View>
    {draft.length > 1800 ? <AppText variant="caption" style={styles.count}>{draft.length}/2000</AppText> : null}
  </View>;
}
const styles = StyleSheet.create({ root: { borderTopWidth: 1, borderTopColor: Colors.rule, backgroundColor: Colors.cream }, flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'flex-end', gap: 0, paddingHorizontal: 4, paddingTop: 8 }, input: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 132, borderRadius: 22, backgroundColor: Colors.strawLight, paddingHorizontal: 14, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 22, color: Colors.ink }, reply: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, backgroundColor: Colors.strawLight }, emojis: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 }, emoji: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, emojiText: { fontSize: 23, lineHeight: 30 }, send: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, count: { textAlign: 'right', paddingHorizontal: 18 } });
