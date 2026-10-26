import { useRef, useState, type ComponentRef, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { PillButton } from '@/components/pill-button';
import { Colors, Fonts, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import type { User } from '@/types/models';

export const MAX_COMMENT_LENGTH = 2000;

/** Aviso no lugar do campo quando a pessoa ainda não pode comentar (e o que fazer). */
export type ComposerNotice = { message: string; actionLabel?: string; onAction?: () => void };

type CommentComposerProps = {
  me: User;
  replyingTo: string | null;
  onCancelReply: () => void;
  /** Envia o comentário; devolve `true` se deu certo (o rascunho só é apagado nesse caso). */
  onSend: (text: string) => boolean | Promise<boolean>;
  /** Quando presente, substitui o campo (e-mail não confirmado, fora da comuna). */
  notice?: ComposerNotice | null;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
};

/** Campo fixo no rodapé da discussão para comentar ou responder. */
export function CommentComposer({ me, replyingTo, onCancelReply, onSend, notice, inputRef }: CommentComposerProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const insets = useSafeAreaInsets();
  const canSend = draft.trim().length > 0 && !sending;

  const send = async () => {
    const text = draft.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      // Se falhar (sem rede, por exemplo), o texto continua no campo para tentar de novo.
      if (await onSend(text)) setDraft('');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const padding = { paddingBottom: Math.max(insets.bottom, Spacing.three) };

  if (notice) {
    return (
      <View style={[styles.bar, styles.noticeBar, padding]} accessibilityLiveRegion="polite">
        <AppText style={styles.noticeText} color={Colors.inkSoft}>
          {notice.message}
        </AppText>
        {notice.actionLabel && notice.onAction ? (
          <PillButton label={notice.actionLabel} onPress={notice.onAction} variant="outline" size="sm" />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.bar, padding]}>
      {replyingTo ? (
        <View style={styles.replying}>
          <AppText style={styles.replyingText} color={Colors.inkSoft} numberOfLines={1}>
            Respondendo a <AppText style={[styles.replyingText, styles.bold]}>{replyingTo}</AppText>
          </AppText>
          <Pressable
            onPress={onCancelReply}
            accessibilityRole="button"
            accessibilityLabel="Cancelar resposta"
            hitSlop={8}
            style={styles.cancel}>
            <Icon name="close" size={16} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.row}>
        <Avatar initials={me.initials} tone={me.tone} size={34} />
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder={replyingTo ? 'Escreva sua resposta…' : 'Entre na discussão…'}
          placeholderTextColor={Colors.muted}
          accessibilityLabel={replyingTo ? `Resposta para ${replyingTo}` : 'Escrever comentário'}
          multiline
          editable={!sending}
          maxLength={MAX_COMMENT_LENGTH}
          style={styles.input}
          // Sem sugestões aprendidas pelo teclado: textos políticos podem ser sensíveis.
          autoCorrect
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={sending ? 'Enviando comentário' : 'Enviar comentário'}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={({ pressed }) => [styles.send, !canSend && !sending && styles.sendDisabled, pressed && styles.pressed]}>
          {sending ? (
            <ActivityIndicator color={Colors.paper} />
          ) : (
            <Icon name="send" size={20} color={Colors.paper} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.paper,
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
    paddingTop: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  noticeText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
  replying: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.one,
  },
  replyingText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  bold: {
    fontFamily: Fonts.bold,
  },
  cancel: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: MinTouchTarget,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.cream,
    paddingHorizontal: Spacing.four,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  send: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: Radius.pill,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
