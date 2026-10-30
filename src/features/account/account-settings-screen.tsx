import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { describeError } from '@/lib/errors';
import { openPlatformModeration } from '@/lib/routes';
import { useAccount } from './account-context';

const ITEMS = [['meus-dados', 'Meus dados', 'Nome, @, endereço, bio e senha'], ['privacidade', 'Privacidade', 'Perfil público, privado e solicitações'], ['bloqueados', 'Pessoas bloqueadas', 'Gerencie quem você bloqueou'], ['sobre-e-legal', 'Sobre e legal', 'Regras, termos, privacidade e suporte'], ['exclusao', 'Exclusão de conta', 'Apague sua conta e seus dados']] as const;

export default function AccountSettingsScreen() {
  const { account, signOut } = useAccount(); const toast = useToast(); const [busy, setBusy] = useState(false);
  const leave = async (everywhere = false) => { if (busy) return; setBusy(true); try { await signOut(everywhere); } catch (error) { toast.show(describeError(error)); setBusy(false); } };
  return <Screen edges={['top', 'left', 'right', 'bottom']}><View style={styles.bar}><IconButton icon="back" size={20} accessibilityLabel="Voltar" onPress={() => router.back()} /><AppText style={styles.barTitle} accessibilityRole="header">Conta</AppText></View><ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
    {account ? <View style={styles.email}><AppText variant="label" color={Colors.muted}>E-mail · não editável</AppText><AppText style={styles.value}>{account.email}</AppText><AppText style={styles.status} color={account.emailVerified ? Colors.ink : Colors.red}>{account.emailVerified ? '✓ Confirmado' : 'Ainda não confirmado'}</AppText>{!account.emailVerified ? <PillButton label="Confirmar e-mail" onPress={() => router.push('/verificar-email')} variant="outline" /> : null}</View> : <AppText color={Colors.muted}>Modo demonstração</AppText>}
    {account && (account.platformRole === 'platform_moderator' || account.platformRole === 'admin') ? <PillButton label={'Fila da plataforma\nDenúncias globais e escaladas'} display variant="outline" size="lg" onPress={openPlatformModeration} /> : null}
    <View style={styles.menu}>{ITEMS.map(([path, label, description]) => <PillButton key={path} label={`${label}\n${description}`} display variant="outline" size="lg" onPress={() => router.push((`/conta/${path}`) as never)} />)}</View>
    <View style={styles.logout}><PillButton label="Sair deste aparelho" onPress={() => leave(false)} variant="outline" size="lg" display />{account ? <PillButton label="Sair de todos os aparelhos" onPress={() => leave(true)} variant="dark" size="lg" display /> : null}</View>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, borderBottomWidth: 1.5, borderBottomColor: Colors.ink }, barTitle: { fontFamily: Fonts.condensed, fontSize: 21, lineHeight: 24, textTransform: 'uppercase' }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingTop: Spacing.five, paddingHorizontal: Spacing.five + 2, paddingBottom: Spacing.six, gap: Spacing.five }, email: { gap: Spacing.two }, value: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 }, status: { fontSize: 13.5, lineHeight: 18 }, menu: { gap: Spacing.two }, logout: { gap: Spacing.two } });
