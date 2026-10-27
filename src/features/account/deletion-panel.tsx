import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { TextField } from '@/components/text-field';
import { describeError } from '@/lib/errors';
import { useAccount } from './account-context';
import { getAuthIdentities, type DeletionProof, type SocialProvider } from './api';

export function DeletionPanel() {
  const { account, deleteAccount } = useAccount();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [providers, setProviders] = useState<SocialProvider[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    getAuthIdentities().then((data) => { if (active) setProviders(data.identities.map((i) => i.provider)); })
      .catch((e) => { if (active) setError(describeError(e)); });
    return () => { active = false; };
  }, [open]);
  if (!account) return null;
  const hasApple = providers?.includes('apple');
  const perform = async (provider?: SocialProvider) => {
    if (pending.current || confirmation !== 'EXCLUIR' || !providers) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const proof: DeletionProof = { confirmation: 'EXCLUIR' };
      if (provider === 'google') {
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        // Força nova escolha/autenticação; o backend confere que o subject pertence à conta atual.
        await GoogleSignin.signOut();
        const result = await GoogleSignin.signIn();
        if (!result.data?.idToken) return;
        proof.provider = provider; proof.idToken = result.data.idToken;
      } else if (provider === 'apple') {
        const Apple = await import('expo-apple-authentication');
        const Crypto = await import('expo-crypto');
        proof.nonce = Crypto.randomUUID();
        const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, proof.nonce);
        const result = await Apple.signInAsync({ requestedScopes: [], nonce });
        if (!result.identityToken || !result.authorizationCode) throw new Error('Confirmação Apple incompleta. Tente novamente.');
        proof.provider = provider; proof.idToken = result.identityToken; proof.authorizationCode = result.authorizationCode;
      } else proof.password = password;
      await deleteAccount(proof);
    } catch (e) { setError(describeError(e)); }
    finally { pending.current = false; setBusy(false); setPassword(''); }
  };
  const confirm = (provider?: SocialProvider) => Alert.alert('Excluir a conta para sempre?', 'Seu perfil e conteúdo pessoal serão apagados, e todas as sessões encerradas. Esta ação não pode ser desfeita.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir definitivamente', style: 'destructive', onPress: () => void perform(provider) },
  ]);
  if (!open) return <PillButton label="Excluir conta" variant="outline" onPress={() => setOpen(true)} />;
  return <View style={{ gap: 12 }}>
    <AppText variant="heading">Excluir conta</AppText>
    <AppText>Seus textos, perfil, sessões, relações e PDFs pessoais serão apagados. Respostas mantêm marcadores sem texto. Documentos cuja origem é uma Comuna permanecem com ela. Backups e registros justificados de segurança seguem a Política de Privacidade.</AppText>
    <AppText>Transfira a propriedade ou arquive suas Comunas ativas antes de continuar. Não há período de recuperação.</AppText>
    <TextField label="Digite EXCLUIR para confirmar" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} />
    {account.hasPassword && !hasApple ? <TextField label="Confirme sua senha atual" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} /> : null}
    {providers === null ? <AppText>Carregando meios de confirmação…</AppText> : null}
    {hasApple ? <AppText>Confirme com Apple para revogar a autorização vinculada.{Platform.OS !== 'ios' ? ' Abra o Popularia no iOS para essa confirmação ou fale com o suporte para assistência.' : ''}</AppText> : null}
    {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    {account.hasPassword && !hasApple ? <PillButton label={busy ? 'Excluindo…' : 'Excluir com senha'} disabled={busy || confirmation !== 'EXCLUIR' || !password || !providers} onPress={() => confirm()} /> : null}
    {providers?.filter((p) => !hasApple || p === 'apple').map((provider) => <PillButton key={provider} label={`Confirmar com ${provider === 'apple' ? 'Apple' : 'Google'} e excluir`} disabled={busy || confirmation !== 'EXCLUIR' || (provider === 'apple' && Platform.OS !== 'ios')} onPress={() => confirm(provider)} />)}
    <PillButton label="Cancelar exclusão" variant="outline" disabled={busy} onPress={() => { setOpen(false); setPassword(''); setConfirmation(''); setError(''); }} />
  </View>;
}
