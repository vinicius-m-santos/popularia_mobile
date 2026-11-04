import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, PopulariaBottomSheetFlatList, PopulariaBottomSheetTextInput } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { BIO_MAX_LENGTH, useAccount, useMe } from '@/features/account/account-context';
import { pickProfileImage, type PickedImage } from '@/features/media/pick-image';
import { uploadAvatar } from '@/features/media/upload-image';
import { BrazilLocationFields } from '@/features/locations/brazil-location-fields';
import { getCountries, type Country } from '@/features/locations/api';
import { ApiError, describeError } from '@/lib/errors';
import { initialsOf } from '@/lib/format';

import { checkHandleAvailable } from './api';
import { OnboardingFooter, OnboardingHeader } from './components/onboarding-chrome';
import { useSuggestedHandle } from './use-suggested-handle';

const SETUP = {
  bg: '#F2EADB',
  surface: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  redText: '#A3261C',
  secondary: '#5E554A',
  subtitle: '#3E3630',
  placeholder: '#6E6458',
  yellow: '#F4C534',
} as const;

const HANDLE_MAX_LENGTH = 20;
const HANDLE_CHECK_DELAY_MS = 400;

function sanitizeHandle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, HANDLE_MAX_LENGTH);
}

type HandleCheck = { handle: string; available: boolean | null };

/** Etapa 2: identidade, @ e país. A conta só é criada ao tocar em Continuar. */
export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, account, completeSignupProfile, completeSocialOnboarding, replaceAvatarUrl } = useAccount();
  const me = useMe();
  const toast = useToast();
  const isSocialOnboarding = account?.pendingOnboarding === true;

  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [focused, setFocused] = useState<'name' | 'handle' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<HandleCheck | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<PickedImage | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [countries, setCountries] = useState<Country[]>(DEMO_MODE ? [{ code: 'BR', name: 'Brasil' }] : []);
  const [countryError, setCountryError] = useState('');
  const handleRef = useRef<ComponentRef<typeof TextInput>>(null);

  const nameMissing = profile.name.trim() === '';
  const handleShort = profile.handle.length < 3;
  const ownHandle = account?.handle === profile.handle;
  const locationMissing = profile.countryCode === 'BR' && (!profile.stateIbgeCode || !profile.municipalityIbgeCode);

  useSuggestedHandle({ account, handle: profile.handle, update: updateProfile });

  useEffect(() => {
    if (DEMO_MODE) return;
    getCountries().then(setCountries, () => setCountryError('Não conseguimos carregar os países.'));
  }, []);

  useEffect(() => {
    if (handleShort || ownHandle) return;
    let cancelled = false;
    const handle = profile.handle;
    const timer = setTimeout(() => {
      checkHandleAvailable(handle).then(
        (available) => !cancelled && setCheck({ handle, available }),
        () => !cancelled && setCheck({ handle, available: null }),
      );
    }, HANDLE_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile.handle, handleShort, ownHandle]);

  const checked = check?.handle === profile.handle ? check : null;
  const checking = !handleShort && !ownHandle && checked === null;
  const handleTaken = !handleShort && !ownHandle && checked?.available === false;
  const handleAvailable = ownHandle || checked?.available === true;
  const handleError = handleShort && (profile.handle.length > 0 || submitted) || handleTaken;
  const canContinue = !nameMissing && !handleShort && !handleTaken && handleAvailable && !!profile.countryCode && !busy && !photoBusy;

  const countryLabel = countries.find((country) => country.code === profile.countryCode)?.name ?? profile.country ?? 'Brasil';
  const countryOptions = useMemo(() => {
    const term = countryQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return countries.filter((country) => !term || country.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term));
  }, [countries, countryQuery]);

  const photoUri = avatarDraft?.uri ?? (photoRemoved ? null : me.avatarUrl ?? null);
  const hasPhoto = !!photoUri;
  const initials = initialsOf(profile.name);

  const uploadDraftAvatar = async () => {
    if (!avatarDraft) return;
    try {
      const url = await uploadAvatar(avatarDraft);
      replaceAvatarUrl(url);
    } catch (error) {
      toast.show(describeError(error));
    }
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const image = await pickProfileImage('avatar', source);
      if (image) {
        setAvatarDraft(image);
        setPhotoRemoved(false);
        setPhotoSheetOpen(false);
      }
    } catch (error) {
      toast.show(describeError(error));
      setPhotoSheetOpen(false);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () => {
    setAvatarDraft(null);
    setPhotoRemoved(true);
    setPhotoSheetOpen(false);
  };

  const next = async () => {
    if (busyRef.current) return;
    setSubmitted(true);
    if (!canContinue) return;
    if (locationMissing) {
      toast.show('Escolha seu estado e sua cidade.');
      return;
    }
    if (DEMO_MODE) {
      router.push('/boas-vindas/assuntos');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFieldErrors({});
    try {
      if (isSocialOnboarding) {
        await completeSocialOnboarding();
        await uploadDraftAvatar();
        router.push('/boas-vindas/assuntos');
      } else {
        const alreadyVerified = account?.emailVerified ?? false;
        const registrationSendsCode = !account;
        await completeSignupProfile();
        await uploadDraftAvatar();
        router.push(alreadyVerified ? '/boas-vindas/assuntos' : { pathname: '/boas-vindas/verificar', params: registrationSendsCode ? { sent: '1' } : {} });
      }
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.violations).length > 0) {
        setFieldErrors(error.violations);
        setSubmitted(true);
      }
      toast.show(describeError(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const chooseCountry = (code: string) => {
    const country = countries.find((item) => item.code === code);
    updateProfile({ countryCode: code, country: country?.name ?? '' });
    setCountryOpen(false);
    setCountryQuery('');
  };

  return (
    <Screen edges={['left', 'right']} backgroundColor={SETUP.bg}>
      <KeyboardView style={styles.flex} keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.flex}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 54) }]}>
          <OnboardingHeader step={2} />

          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.1}>COMO VOCÊ QUER{'\n'}APARECER?</Text>
          <Text style={styles.subtitle}>Só o essencial. Dá pra mudar depois.</Text>

          <Pressable
            onPress={() => setPhotoSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={hasPhoto ? 'Trocar foto' : 'Adicionar foto'}
            accessibilityHint="Abre opções para tirar uma foto ou escolher da galeria"
            style={({ pressed }) => [styles.photoRow, pressed && styles.pressed]}>
            <View style={[styles.photoSquare, hasPhoto && styles.photoSquareFilled, initials && !hasPhoto && styles.photoInitials]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} contentFit="cover" style={styles.photoImage} />
              ) : initials ? (
                <Text style={styles.initials} maxFontSizeMultiplier={1}>{initials}</Text>
              ) : (
                <Icon name="camera" size={28} />
              )}
              <View style={styles.photoBadge}>
                {photoBusy ? <ActivityIndicator size="small" color={SETUP.ink} /> : <Icon name={hasPhoto ? 'edit' : 'plus'} size={14} />}
              </View>
            </View>
            <View style={styles.photoCopy}>
              <Text style={styles.photoTitle}>{hasPhoto ? 'Trocar foto' : 'Adicionar foto'}</Text>
              <Text style={styles.photoSub}>Opcional. Um rosto ajuda a criar confiança nas comunas.</Text>
            </View>
          </Pressable>

          <View style={[styles.field, styles.firstField]}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              value={profile.name}
              onChangeText={(name) => { updateProfile({ name }); setFieldErrors((current) => ({ ...current, displayName: '' })); }}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              placeholder="Como te chamam"
              placeholderTextColor={SETUP.placeholder}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => handleRef.current?.focus()}
              accessibilityLabel="Nome"
              style={[styles.input, (focused === 'name' ? styles.inputFocused : null), submitted && nameMissing && styles.inputError]}
            />
            {submitted && nameMissing ? <Text style={styles.error}>Preencha seu nome</Text> : null}
            {fieldErrors.displayName ? <Text style={styles.error}>{fieldErrors.displayName}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nome de usuário</Text>
            <View style={[styles.handleBox, handleError && styles.handleBoxError, focused === 'handle' && !handleError && styles.handleBoxFocused]}>
              <Text style={styles.prefix}>@</Text>
              <TextInput
                ref={handleRef}
                value={profile.handle}
                onChangeText={(value) => { updateProfile({ handle: sanitizeHandle(value) }); setFieldErrors((current) => ({ ...current, handle: '' })); }}
                onFocus={() => setFocused('handle')}
                onBlur={() => setFocused(null)}
                placeholder="seu.nome"
                placeholderTextColor={SETUP.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                maxLength={HANDLE_MAX_LENGTH}
                onSubmitEditing={() => setCountryOpen(true)}
                accessibilityLabel="Nome de usuário"
                style={styles.handleInput}
              />
            </View>
            <View style={styles.handleStatus} accessibilityLiveRegion="polite">
              {handleShort && (profile.handle.length > 0 || submitted) ? (
                <>
                  <StatusIcon error />
                  <Text style={styles.statusError}>Use pelo menos 3 caracteres</Text>
                </>
              ) : checking ? (
                <>
                  <ActivityIndicator size="small" color={SETUP.secondary} />
                  <Text style={styles.statusMuted}>Verificando…</Text>
                </>
              ) : handleTaken ? (
                <>
                  <StatusIcon error />
                  <Text style={styles.statusError}>Já está em uso</Text>
                </>
              ) : handleAvailable ? (
                <>
                  <StatusIcon />
                  <Text style={styles.statusOk}>Disponível</Text>
                  <Text style={styles.statusLink} numberOfLines={1}>popularia.com.br/@{profile.handle}</Text>
                </>
              ) : null}
            </View>
            {fieldErrors.handle ? <Text style={styles.error}>{fieldErrors.handle}</Text> : null}
          </View>

          <View style={[styles.field, styles.countryField]}>
            <Text style={styles.label}>País</Text>
            <Pressable
              onPress={() => { setCountryQuery(''); setCountryOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={`País: ${countryLabel}`}
              accessibilityState={{ expanded: countryOpen }}
              style={({ pressed }) => [styles.select, pressed && styles.pressed]}>
              <Text style={styles.selectValue}>{countryLabel}</Text>
              <Icon name="chevronDown" size={18} color={SETUP.secondary} />
            </Pressable>
            {countryError ? <Text style={styles.error}>{countryError}</Text> : null}
          </View>

          {profile.countryCode === 'BR' ? (
            <View style={[styles.field, styles.locationField]}>
              <BrazilLocationFields
                appearance="setup"
                stateId={profile.stateIbgeCode}
                municipalityId={profile.municipalityIbgeCode}
                city={profile.city}
                state={profile.state}
                onChange={updateProfile}
              />
              {submitted && locationMissing ? <Text style={styles.error}>Escolha seu estado e sua cidade.</Text> : null}
            </View>
          ) : null}

          <View style={[styles.field, styles.bioField]}>
            <View style={styles.bioLabelRow}>
              <Text style={styles.label}>Bio</Text>
              <Text style={styles.bioCount}>opcional · {profile.bio.length}/{BIO_MAX_LENGTH}</Text>
            </View>
            <TextInput
              value={profile.bio}
              onChangeText={(bio) => updateProfile({ bio })}
              placeholder="O que você faz, onde atua, o que te move"
              placeholderTextColor={SETUP.placeholder}
              multiline
              maxLength={BIO_MAX_LENGTH}
              accessibilityLabel="Bio"
              style={[styles.input, styles.bioInput]}
            />
          </View>
        </ScrollView>

        <OnboardingFooter label={busy ? 'Criando conta…' : 'Continuar'} onPress={() => { void next(); }} disabled={!canContinue} />
      </KeyboardView>

      <BottomSheet visible={photoSheetOpen} onClose={() => setPhotoSheetOpen(false)} title="Foto de perfil" scrollable={false}>
        <View style={styles.sheetActions}>
          <EditorialAction label="Tirar foto" icon="camera" tone="red" labelVariant="button" disabled={photoBusy} onPress={() => { void choosePhoto('camera'); }} />
          <EditorialAction label="Escolher da galeria" icon="image" labelVariant="button" disabled={photoBusy} onPress={() => { void choosePhoto('library'); }} />
          {hasPhoto ? <EditorialAction label="Remover foto" icon="trash" labelVariant="button" disabled={photoBusy} onPress={removePhoto} /> : null}
          <EditorialAction label="Cancelar" icon="close" tone="ghost" labelVariant="button" disabled={photoBusy} onPress={() => setPhotoSheetOpen(false)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={countryOpen} onClose={() => setCountryOpen(false)} title="País" scrollable={false} virtualized>
        <PopulariaBottomSheetTextInput
          value={countryQuery}
          onChangeText={setCountryQuery}
          placeholder="Buscar país"
          placeholderTextColor={SETUP.placeholder}
          autoCapitalize="words"
          accessibilityLabel="Buscar país"
          style={styles.countrySearch}
        />
        <PopulariaBottomSheetFlatList
          data={countryOptions}
          keyExtractor={(country) => country.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => chooseCountry(item.code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: item.code === profile.countryCode }}
              style={({ pressed }) => [styles.countryOption, item.code === profile.countryCode && styles.countrySelected, pressed && styles.pressed]}>
              <Text style={styles.countryOptionText}>{item.name}</Text>
              {item.code === profile.countryCode ? <Icon name="check" size={18} /> : null}
            </Pressable>
          )}
          ListEmptyComponent={countries.length === 0 ? <Text style={styles.countryEmpty}>Carregando países…</Text> : <Text style={styles.countryEmpty}>Nenhum país encontrado.</Text>}
        />
      </BottomSheet>
    </Screen>
  );
}

function StatusIcon({ error = false }: { error?: boolean }) {
  return (
    <View style={[styles.statusIcon, error && styles.statusIconError]}>
      <Icon name={error ? 'close' : 'check'} size={11} color={SETUP.surface} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  title: { marginTop: 18, paddingTop: 4, fontFamily: Fonts.anton, fontSize: 50, lineHeight: 64, textTransform: 'uppercase', color: SETUP.ink },
  subtitle: { marginTop: 8, fontFamily: Fonts.regular, fontSize: 17, lineHeight: 24, color: SETUP.subtitle },
  photoRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoSquare: { width: 84, height: 84, borderRadius: 6, borderWidth: 2, borderStyle: 'dashed', borderColor: SETUP.ink, backgroundColor: SETUP.surface, alignItems: 'center', justifyContent: 'center' },
  photoSquareFilled: { borderStyle: 'solid', overflow: 'visible' },
  photoInitials: { backgroundColor: SETUP.red },
  photoImage: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 4 },
  initials: { fontFamily: Fonts.anton, fontSize: 34, lineHeight: 40, color: SETUP.surface },
  photoBadge: { position: 'absolute', right: -8, bottom: -8, width: 26, height: 26, borderWidth: 2, borderColor: SETUP.ink, borderRadius: 4, backgroundColor: SETUP.yellow, alignItems: 'center', justifyContent: 'center' },
  photoCopy: { flex: 1 },
  photoTitle: { fontFamily: Fonts.extrabold, fontSize: 17, lineHeight: 25, color: SETUP.ink },
  photoSub: { marginTop: 3, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 22, color: SETUP.secondary },
  field: { marginTop: 14 },
  firstField: { marginTop: 22 },
  label: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 23, color: SETUP.ink },
  input: { height: 52, marginTop: 6, paddingHorizontal: 14, borderWidth: 2, borderColor: SETUP.ink, borderRadius: 6, backgroundColor: SETUP.surface, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24, color: SETUP.ink, outlineWidth: 0 },
  inputFocused: { borderColor: SETUP.red },
  inputError: { borderColor: SETUP.redText },
  error: { marginTop: 5, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22, color: SETUP.redText },
  handleBox: { height: 52, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 14, borderWidth: 2, borderColor: SETUP.ink, borderRadius: 6, backgroundColor: SETUP.surface },
  handleBoxFocused: { borderColor: SETUP.red },
  handleBoxError: { borderColor: SETUP.redText },
  prefix: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 24, color: SETUP.placeholder },
  handleInput: { flex: 1, height: 48, paddingVertical: 0, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24, color: SETUP.ink, outlineWidth: 0 },
  handleStatus: { minHeight: 24, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusIcon: { width: 18, height: 18, borderRadius: 4, backgroundColor: SETUP.ink, alignItems: 'center', justifyContent: 'center' },
  statusIconError: { backgroundColor: SETUP.redText },
  statusOk: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22, color: SETUP.ink },
  statusError: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22, color: SETUP.redText },
  statusMuted: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 22, color: SETUP.secondary },
  statusLink: { flex: 1, minWidth: 0, fontFamily: Fonts.mono, fontSize: 11, lineHeight: 16, color: SETUP.secondary },
  countryField: { marginTop: 14 },
  locationField: { marginTop: 14, gap: 12 },
  bioField: { marginTop: 14 },
  bioLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  bioCount: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 20, color: SETUP.secondary },
  select: { height: 52, marginTop: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: SETUP.ink, borderRadius: 6, backgroundColor: SETUP.surface },
  selectValue: { flex: 1, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24, color: SETUP.ink },
  bioInput: { height: 88, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  sheetActions: { gap: 8, paddingBottom: 16 },
  countrySearch: { minHeight: 48, marginHorizontal: 4, marginBottom: 8, paddingHorizontal: 14, borderWidth: 2, borderColor: SETUP.ink, borderRadius: 6, backgroundColor: SETUP.surface, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24, color: SETUP.ink },
  countryOption: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#D9CFBF' },
  countrySelected: { backgroundColor: '#EBE1CF' },
  countryOptionText: { flex: 1, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24, color: SETUP.ink },
  countryEmpty: { padding: 16, fontFamily: Fonts.regular, fontSize: 14, color: SETUP.secondary },
  pressed: { opacity: 0.72 },
});
