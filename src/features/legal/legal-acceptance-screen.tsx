import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { CheckboxMark } from '@/components/choice-marks';
import { useAccount } from '@/features/account/account-context';
import { acceptLegal } from '@/features/account/api';
import { describeError } from '@/lib/errors';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { LegalAppLink } from './legal-links';

export default function LegalAcceptanceScreen() {
  const { reloadAccount, signOut } = useAccount();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const submit = async () => {
    if (!accepted || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await acceptLegal(); await reloadAccount(); }
    catch (e) { setError(describeError(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Screen><ScrollView
    contentInsetAdjustmentBehavior="never"
    automaticallyAdjustContentInsets={false}
    automaticallyAdjustsScrollIndicatorInsets={false}
    contentContainerStyle={styles.content}>
    <AppText variant="heading" accessibilityRole="header">Antes de participar</AppText>
    <AppText>Leia os documentos antes de publicar. O beta do Popularia é para maiores de 18 anos. A Política explica como seus dados são tratados.</AppText>
    <LegalAppLink />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} disabled={busy} onPress={() => setAccepted(!accepted)} style={{ flexDirection: 'row', gap: 12 }}>
      <CheckboxMark checked={accepted} /><AppText style={{ flex: 1 }}>Declaro ter 18 anos ou mais, li e aceito os Termos de Uso e as Regras da Comunidade e tomei conhecimento da Política de Privacidade.</AppText>
    </Pressable>
    {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    <PillButton label={busy ? 'Salvando…' : 'Aceitar e continuar'} disabled={!accepted || busy} onPress={submit} />
    <PillButton label="Sair da conta" variant="outline" disabled={busy} onPress={() => signOut().catch((e) => setError(describeError(e)))} />
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
});
