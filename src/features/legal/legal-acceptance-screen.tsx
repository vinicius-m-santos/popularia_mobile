import { DeletionPanel } from '@/features/account/deletion-panel';
import { useRef, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { CheckboxMark } from '@/components/choice-marks';
import { useAccount } from '@/features/account/account-context';
import { acceptLegal } from '@/features/account/api';
import { describeError } from '@/lib/errors';
import { LegalLinks } from './legal-links';

export default function LegalAcceptanceScreen({ onDefer }: { onDefer?: () => void }) {
  const { account, reloadAccount, signOut } = useAccount();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const submit = async () => {
    if (!accepted || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await acceptLegal(); await reloadAccount(); onDefer?.(); }
    catch (e) { setError(describeError(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Screen><ScrollView contentContainerStyle={{ padding: 24, gap: 24, maxWidth: 680, alignSelf: 'center', width: '100%' }}>
    <AppText variant="heading" accessibilityRole="header">Antes de participar</AppText>
    <AppText>Leia os documentos antes de publicar. O beta do Popularia é para maiores de 18 anos. A Política explica como seus dados são tratados.</AppText>
    <LegalLinks />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} disabled={busy} onPress={() => setAccepted(!accepted)} style={{ flexDirection: 'row', gap: 12 }}>
      <CheckboxMark checked={accepted} /><AppText style={{ flex: 1 }}>Declaro ter 18 anos ou mais, li e aceito os Termos de Uso e as Regras da Comunidade e tomei conhecimento da Política de Privacidade.</AppText>
    </Pressable>
    {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    <PillButton label={busy ? 'Salvando…' : 'Aceitar e continuar'} disabled={!accepted || busy} onPress={submit} />
    {onDefer && !account?.pendingOnboarding ? <PillButton label="Continuar apenas para gerenciar a conta" variant="outline" disabled={busy} onPress={onDefer} /> : null}
    <PillButton label="Sair da conta" variant="outline" disabled={busy} onPress={() => signOut().catch((e) => setError(describeError(e)))} />
    <AppText variant="caption">Você pode excluir a conta sem aceitar os documentos.</AppText>
    <DeletionPanel />
  </ScrollView></Screen>;
}
