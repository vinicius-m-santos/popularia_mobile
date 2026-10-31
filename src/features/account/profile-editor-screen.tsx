import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { SelectField } from '@/components/select-field';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';
import { BrazilLocationFields } from '@/features/locations/brazil-location-fields';
import { getCountries, type Country } from '@/features/locations/api';
import { describeError } from '@/lib/errors';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation';

import * as api from './api';
import { BIO_MAX_LENGTH, type AccountProfile, useAccount } from './account-context';

const HANDLE_CHECK_DELAY_MS = 400;

export function ProfileEditorScreen() {
  const { account, profile, updateProfile, reloadAccount } = useAccount();
  const toast = useToast();
  // Rascunho local: nenhum cabeçalho, avatar ou perfil recebe mudanças antes do PATCH concluir.
  const [draft, setDraft] = useState<AccountProfile>(() => ({ ...profile }));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryError, setCountryError] = useState('');
  const [handleCheck, setHandleCheck] = useState<{ handle: string; state: 'checking' | 'available' | 'taken' | 'error' }>({ handle: '', state: 'checking' });
  const busyRef = useRef(false);

  const patchDraft = (patch: Partial<AccountProfile>) => setDraft((current) => ({ ...current, ...patch }));
  const normalizedHandle = draft.handle.trim().toLowerCase();
  const ownHandle = normalizedHandle === account?.handle;
  const handleValid = /^[a-z0-9._]{3,20}$/.test(normalizedHandle);
  const passwordError = newPassword && newPassword.length < PASSWORD_MIN_LENGTH ? `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` : '';
  const passwordMissingCurrent = !!newPassword && !currentPassword;

  useEffect(() => {
    if (DEMO_MODE) return;
    getCountries().then(setCountries, () => setCountryError('Não conseguimos carregar os países.'));
  }, []);

  useEffect(() => {
    if (!handleValid || ownHandle) return;
    let active = true;
    const timer = setTimeout(() => {
      setHandleCheck({ handle: normalizedHandle, state: 'checking' });
      api.isHandleAvailable(normalizedHandle).then(
        (available) => { if (active) setHandleCheck({ handle: normalizedHandle, state: available ? 'available' : 'taken' }); },
        () => { if (active) setHandleCheck({ handle: normalizedHandle, state: 'error' }); },
      );
    }, HANDLE_CHECK_DELAY_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [handleValid, normalizedHandle, ownHandle]);

  const handleState = !handleValid || ownHandle ? 'idle' : handleCheck.handle === normalizedHandle ? handleCheck.state : 'checking';

  const handleHint = !handleValid
    ? 'Use 3 a 20 caracteres: letras minúsculas, números, ponto ou _.'
    : ownHandle
      ? 'Este é seu nome de usuário atual.'
      : handleState === 'checking'
        ? 'Verificando disponibilidade…'
        : handleState === 'available'
          ? '✓ Disponível'
          : handleState === 'taken'
            ? 'Indisponível'
            : handleState === 'error'
              ? 'Não foi possível verificar agora; o servidor validará ao salvar.'
              : undefined;
  const handleHintColor = handleState === 'taken' || !handleValid ? Colors.red : Colors.muted;
  const locationValid = draft.countryCode !== 'BR' || (!!draft.stateIbgeCode && !!draft.municipalityIbgeCode);
  const canSave = !!draft.name.trim() && handleValid && handleState !== 'checking' && handleState !== 'taken'
    && draft.bio.length <= BIO_MAX_LENGTH && locationValid && !passwordError && !passwordMissingCurrent && !busy;

  const countryOptions = useMemo(() => countries.map((country) => ({ value: country.code, label: country.name })), [countries]);

  const save = async () => {
    if (busyRef.current || !canSave) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const country = countries.find((item) => item.code === draft.countryCode);
      const place = draft.countryCode === 'BR'
        ? { city: draft.city.trim(), state: draft.state.trim(), country: 'Brasil', countryCode: 'BR', stateIbgeCode: draft.stateIbgeCode, municipalityIbgeCode: draft.municipalityIbgeCode }
        : { city: '', state: '', country: country?.name ?? draft.country.trim(), countryCode: draft.countryCode, stateIbgeCode: '', municipalityIbgeCode: '' };
      if (!DEMO_MODE) {
        await api.updateMe({ displayName: draft.name.trim(), handle: normalizedHandle, bio: draft.bio.trim(), ...place });
        if (newPassword) await api.changePassword(currentPassword, newPassword);
        await reloadAccount();
      } else {
        updateProfile({ ...draft, ...place, handle: normalizedHandle });
      }
      setCurrentPassword('');
      setNewPassword('');
      toast.show(newPassword ? 'Dados e senha salvos.' : 'Dados salvos.');
    } catch (error) {
      toast.show(describeError(error));
      if (error instanceof Error && 'type' in error && error.type === '/errors/handle-taken') setHandleCheck({ handle: normalizedHandle, state: 'taken' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <Screen edges={['top', 'left', 'right']}>
    <KeyboardView style={styles.flex}>
      <EventBar title="Meus dados" />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
        <AppText variant="caption">O e-mail é usado para entrar e não pode ser alterado por aqui.</AppText>

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Identidade" />
          <TextField appearance="editorial" label="E-mail" value={account?.email ?? 'Modo demonstração'} editable={false} />
          <TextField appearance="editorial" label="Nome" placeholder="Ex.: Camila Rocha" value={draft.name} onChangeText={(name) => patchDraft({ name })} maxLength={50} />
          <TextField appearance="editorial" label="Nome de usuário" prefix="@" placeholder="Ex.: camilarocha" value={draft.handle} onChangeText={(handle) => patchDraft({ handle: handle.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20) })} autoCapitalize="none" autoCorrect={false} hint={handleHint} hintColor={handleHintColor} />
          <TextField appearance="editorial" label="Bio" labelAside={`${draft.bio.length}/${BIO_MAX_LENGTH}`} placeholder="Ex.: Professora, escrevo sobre educação pública." value={draft.bio} onChangeText={(bio) => patchDraft({ bio })} multiline maxLength={BIO_MAX_LENGTH} />
        </View>

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Localização" />
          <SelectField appearance="editorial" label="País" value={draft.countryCode} placeholder="Selecione o país" loading={!DEMO_MODE && countries.length === 0 && !countryError} error={countryError || undefined} options={countryOptions} onChange={(countryCode) => {
            const country = countries.find((item) => item.code === countryCode);
            patchDraft({ countryCode, country: country?.name ?? '', ...(countryCode === 'BR' ? {} : { city: '', state: '', stateIbgeCode: '', municipalityIbgeCode: '' }) });
          }} />
          {draft.countryCode === 'BR' ? <BrazilLocationFields appearance="editorial" stateId={draft.stateIbgeCode} municipalityId={draft.municipalityIbgeCode} city={draft.city} state={draft.state} onChange={patchDraft} /> : null}
        </View>

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Senha" />
          <AppText variant="caption">{account?.hasPassword === false ? 'Sua conta usa Google ou Apple; crie uma senha pelo fluxo de recuperação.' : 'Para trocar a senha, informe a senha atual.'}</AppText>
          <TextField appearance="editorial" label="Senha atual" placeholder="Digite sua senha atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" textContentType="password" hint={passwordMissingCurrent ? 'Informe a senha atual.' : undefined} hintColor={Colors.red} />
          <TextField appearance="editorial" label="Nova senha" placeholder={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={passwordError || (newPassword ? 'Senha válida.' : `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`)} hintColor={passwordError ? Colors.red : Colors.muted} />
        </View>

        <EditorialAction
          label={busy ? 'Salvando…' : 'Salvar alterações'}
          icon="check"
          labelVariant="button"
          tone="red"
          disabled={!canSave}
          onPress={save}
          style={styles.save}
        />
      </ScrollView>
    </KeyboardView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.three,
  },
  save: {
    borderRadius: Radius.sm,
  },
});
