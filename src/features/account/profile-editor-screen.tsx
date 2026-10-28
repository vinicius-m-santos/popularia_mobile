import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from './account-context';
import * as api from './api';
import { describeError } from '@/lib/errors';
import { BrazilLocationFields } from '@/features/locations/brazil-location-fields';

export function ProfileEditorScreen() {
  const { account, profile, updateProfile, reloadAccount } = useAccount(); const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [busy, setBusy] = useState(false);
  const [countryMode, setCountryMode] = useState(profile.country === 'Brasil' || profile.country === '' ? 'Brasil' : 'outro');
  const save = async () => { if (busy || !profile.name.trim() || !profile.handle.trim()) return; setBusy(true); try {
    const place = countryMode === 'Brasil' ? { city: profile.city.trim(), state: profile.state.trim(), country: 'Brasil', countryCode: 'BR', stateIbgeCode: profile.stateIbgeCode, municipalityIbgeCode: profile.municipalityIbgeCode } : { city: '', state: '', country: profile.country.trim(), countryCode: 'ZZ', stateIbgeCode: '', municipalityIbgeCode: '' };
    if (!DEMO_MODE) { await api.updateMe({ displayName: profile.name.trim(), handle: profile.handle.trim(), bio: profile.bio.trim(), ...place }); await reloadAccount(); }
    else updateProfile(place);
    if (newPassword) { if (DEMO_MODE) { toast.show('Dados salvos.'); } else { await api.changePassword(currentPassword, newPassword); toast.show('Dados e senha salvos.'); } } else toast.show('Dados salvos.');
  } catch (error) { toast.show(describeError(error)); } finally { setBusy(false); } };
  return <Screen><View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={() => router.back()} /><AppText style={styles.title}>Meus dados</AppText></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <AppText color={Colors.muted}>O e-mail é usado para entrar e não pode ser alterado por aqui.</AppText>
    <TextField label="E-mail" value={account?.email ?? 'Modo demonstração'} editable={false} />
    <TextField label="Nome" value={profile.name} onChangeText={(name) => updateProfile({ name })} />
    <TextField label="Nome de usuário" prefix="@" value={profile.handle} onChangeText={(handle) => updateProfile({ handle: handle.toLowerCase().replace(/[^a-z0-9._]/g, '') })} autoCapitalize="none" />
    <View style={styles.choice}><AppText style={styles.label}>País</AppText><View style={styles.row}><PillButton label="Brasil" variant={countryMode === 'Brasil' ? 'dark' : 'outline'} onPress={() => { setCountryMode('Brasil'); updateProfile({ country: 'Brasil', countryCode: 'BR' }); }} /><PillButton label="Outro país" variant={countryMode === 'outro' ? 'dark' : 'outline'} onPress={() => { setCountryMode('outro'); updateProfile({ city: '', state: '', countryCode: 'ZZ', stateIbgeCode: '', municipalityIbgeCode: '' }); }} /></View></View>
    {countryMode === 'Brasil' ? <BrazilLocationFields stateId={profile.stateIbgeCode} municipalityId={profile.municipalityIbgeCode} city={profile.city} state={profile.state} onChange={updateProfile} /> : <TextField label="País" value={profile.country === 'Brasil' ? '' : profile.country} onChangeText={(country) => updateProfile({ country, countryCode: 'ZZ' })} placeholder="Informe seu país" />}
    <TextField label="Bio" value={profile.bio} onChangeText={(bio) => updateProfile({ bio })} multiline maxLength={160} />
    <AppText variant="heading">Senha</AppText><AppText color={Colors.muted}>{account?.hasPassword === false ? 'Sua conta usa Google ou Apple; crie uma senha pelo fluxo de recuperação.' : 'Para trocar a senha, informe a senha atual.'}</AppText>
    <TextField label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry /><TextField label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
    <PillButton label={busy ? 'Salvando…' : 'Salvar alterações'} onPress={save} disabled={busy} size="lg" display />
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, borderBottomWidth: 1.5, borderBottomColor: Colors.ink }, title: { fontFamily: Fonts.condensed, fontSize: 21, textTransform: 'uppercase' }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.five, gap: Spacing.four }, choice: { gap: 8 }, label: { fontFamily: Fonts.bold, fontSize: 13.5 }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' } });
