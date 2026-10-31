import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';
import { describeError } from '@/lib/errors';

import { sendSupportMessage } from './api';

export function ContactScreen() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const send = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      if (!DEMO_MODE) await sendSupportMessage(message.trim());
      setMessage('');
      toast.show('Mensagem enviada.');
    } catch (e) {
      toast.show(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardView style={styles.flex}>
        <EventBar title="Suporte e contato" />
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
          <AppText variant="heading">Fale com a Popularia</AppText>
          <AppText variant="caption">Escreva sua mensagem e ela será encaminhada ao suporte. Não envie senha, código de recuperação ou token.</AppText>
          <TextField
            appearance="editorial"
            label="Mensagem"
            placeholder="Ex.: Não consigo confirmar meu e-mail."
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={5000}
          />
          <EditorialAction
            label={busy ? 'Enviando…' : 'Enviar mensagem'}
            icon="send"
            labelVariant="button"
            tone="red"
            onPress={send}
            disabled={!message.trim() || busy}
            style={styles.action}
          />
        </ScrollView>
      </KeyboardView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.four,
  },
  action: {
    borderRadius: Radius.sm,
  },
});
