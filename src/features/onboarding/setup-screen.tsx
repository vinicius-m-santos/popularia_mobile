import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { SelectField } from '@/components/select-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { BIO_MAX_LENGTH, useAccount } from '@/features/account/account-context';
import { ImageChangeSheet } from '@/features/media/image-change-sheet';
import type { PickedImage } from '@/features/media/pick-image';
import { uploadAvatar } from '@/features/media/upload-image';
import { ApiError, describeError } from '@/lib/errors';

import { checkHandleAvailable } from './api';
import { OnboardingFooter, OnboardingProgress } from './components/onboarding-chrome';
import { BrazilLocationFields } from '@/features/locations/brazil-location-fields';
import { getCountries, type Country } from '@/features/locations/api';

const HANDLE_MAX_LENGTH = 20;

/** Só minúsculas, números, ponto e sublinhado, como no design. */
function sanitizeHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, HANDLE_MAX_LENGTH);
}

/** Espera a pessoa parar de digitar antes de consultar o servidor. */
const HANDLE_CHECK_DELAY_MS = 400;

type HandleCheck = { handle: string; available: boolean | null };

/**
 * "Como você quer aparecer?" — etapa 2 do cadastro. Com a API, "Continuar" cria a
 * conta (com o e-mail e a senha da etapa 1) e entra nela; o @ é conferido no servidor.
 */
export default function SetupScreen() {
  const { profile, updateProfile, account, completeSignupProfile, completeSocialOnboarding, replaceAvatarUrl } = useAccount();
  const isSocialOnboarding = account?.pendingOnboarding === true;
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<PickedImage | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<HandleCheck | null>(null);
  const [countries, setCountries] = useState<Country[]>(DEMO_MODE ? [{ code: 'BR', name: 'Brasil' }] : []);
  const [countryError, setCountryError] = useState('');

  const nameMissing = profile.name.trim() === '';
  const handleShort = profile.handle.length < 3;
  // O @ que já é da própria conta (quem voltou a esta etapa) não precisa ser conferido.
  const ownHandle = account?.handle === profile.handle;

  useEffect(() => {
    if (handleShort || ownHandle) return;
    let cancelled = false;
    const handle = profile.handle;
    const timer = setTimeout(() => {
      checkHandleAvailable(handle).then(
        (available) => !cancelled && setCheck({ handle, available }),
        // Sem resposta, o servidor confere de novo ao criar a conta.
        () => !cancelled && setCheck({ handle, available: null }),
      );
    }, HANDLE_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile.handle, handleShort, ownHandle]);

  const checked = check?.handle === profile.handle ? check : null;
  const handleTaken = !handleShort && !ownHandle && checked?.available === false;
  const countryOptions = useMemo(() => countries.map((country) => ({ value: country.code, label: country.name })), [countries]);
  const locationMissing = !profile.countryCode || (profile.countryCode === 'BR' && (!profile.stateIbgeCode || !profile.municipalityIbgeCode));

  useEffect(() => {
    if (DEMO_MODE) return;
    getCountries().then(setCountries, () => setCountryError('Não conseguimos carregar os países.'));
  }, []);

  let handleHint = ownHandle || checked?.available ? '✓ Disponível' : checked ? '' : 'Conferindo…';
  let handleColor: string = Colors.ink;
  if (handleShort) {
    handleHint = 'Use pelo menos 3 caracteres';
    handleColor = submitted ? Colors.red : Colors.muted;
  } else if (handleTaken) {
    handleHint = 'Esse nome já está em uso';
    handleColor = Colors.red;
  } else if (fieldErrors.handle) {
    handleHint = fieldErrors.handle;
    handleColor = Colors.red;
  }

  // A conta só existe (e tem sessão) depois que completeSignupProfile/completeSocialOnboarding
  // responde; é só então que dá para enviar a foto. Opcional: uma falha aqui não trava o cadastro.
  const uploadDraftAvatar = async () => {
    if (!avatarDraft) return;
    try {
      const url = await uploadAvatar(avatarDraft);
      replaceAvatarUrl(url);
    } catch (error) {
      toast.show(describeError(error));
    }
  };

  const next = async () => {
    if (busyRef.current) return;
    if (nameMissing || handleShort || handleTaken || locationMissing) {
      setSubmitted(true);
      toast.show('Confira os campos destacados para continuar.');
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
        // Conta já existe (criada via social): só define handle/nome definitivos.
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

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardView style={styles.flex}>
        <OnboardingProgress step={2} />
        <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View>
            <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              Como você quer aparecer?
            </AppText>
            <AppText style={styles.sub} color={Colors.inkSoft}>
              Só o essencial. Dá para mudar depois.
            </AppText>
          </View>

          <View style={styles.photoRow}>
            <Pressable
              onPress={() => setPhotoSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={avatarDraft ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
              accessibilityHint="Abre a escolha de uma foto"
              style={({ pressed }) => [styles.photo, pressed && styles.pressed]}>
              {avatarDraft ? (
                <Image source={{ uri: avatarDraft.uri }} contentFit="cover" cachePolicy="memory-disk" style={styles.photoImage} />
              ) : (
                <Icon name="camera" size={30} />
              )}
            </Pressable>
            <View style={styles.photoText}>
              <AppText style={styles.photoTitle}>{avatarDraft ? 'Trocar foto' : 'Adicionar foto'}</AppText>
              <AppText style={styles.photoSub} color={Colors.muted}>
                Opcional. Um rosto ajuda a criar confiança nas comunas.
              </AppText>
            </View>
          </View>
          <ImageChangeSheet
            visible={photoSheetOpen}
            title="Foto de perfil"
            kind="avatar"
            busy={false}
            onClose={() => setPhotoSheetOpen(false)}
            onConfirm={(image) => { setPhotoSheetOpen(false); setAvatarDraft(image); }}
          />

          <TextField
            label="Nome"
            value={profile.name}
            onChangeText={(name) => updateProfile({ name })}
            placeholder="Como te chamam"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            hint={submitted && nameMissing ? 'Preencha seu nome' : fieldErrors.displayName}
            hintColor={Colors.red}
          />
          <TextField
            label="Nome de usuário"
            prefix="@"
            value={profile.handle}
            onChangeText={(value) => {
              updateProfile({ handle: sanitizeHandle(value) });
              setFieldErrors((prev) => ({ ...prev, handle: '' }));
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            maxLength={HANDLE_MAX_LENGTH}
            hint={handleHint}
            hintColor={handleColor}
          />
          <SelectField label="País" value={profile.countryCode} placeholder="Selecione o país" loading={!DEMO_MODE && countries.length === 0 && !countryError} error={countryError || (submitted && !profile.countryCode ? 'Escolha um país.' : undefined)} options={countryOptions} onChange={(countryCode) => {
            const country = countries.find((item) => item.code === countryCode);
            updateProfile({ countryCode, country: country?.name ?? '', ...(countryCode === 'BR' ? {} : { city: '', state: '', stateIbgeCode: '', municipalityIbgeCode: '' }) });
          }} />
          {profile.countryCode === 'BR' ? <BrazilLocationFields stateId={profile.stateIbgeCode} municipalityId={profile.municipalityIbgeCode} city={profile.city} state={profile.state} onChange={updateProfile} /> : <AppText color={Colors.muted}>Para outros países, cidade e estado ficam ocultos por enquanto.</AppText>}
          {submitted && locationMissing && profile.countryCode === 'BR' ? <AppText color={Colors.red}>Escolha seu estado e sua cidade.</AppText> : null}
          <TextField
            label="Bio"
            labelAside={`opcional · ${profile.bio.length}/${BIO_MAX_LENGTH}`}
            value={profile.bio}
            onChangeText={(bio) => updateProfile({ bio })}
            placeholder="O que você faz, onde atua, o que te move"
            maxLength={BIO_MAX_LENGTH}
            multiline
          />
        </ScrollView>
        <OnboardingFooter label={busy ? 'Criando conta…' : 'Continuar'} onPress={next} disabled={busy} />
      </KeyboardView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: 6,
    paddingHorizontal: Spacing.five + 2,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 50,
    lineHeight: 46,
    paddingTop: 6,
    textTransform: 'uppercase',
  },
  sub: {
    marginTop: Spacing.two,
    fontSize: 15.5,
    lineHeight: 21,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  photo: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
  photoText: {
    flex: 1,
  },
  photoTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  photoSub: {
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 2,
  },
});
