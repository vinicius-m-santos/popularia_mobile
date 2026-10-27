import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { BIO_MAX_LENGTH, useAccount } from '@/features/account/account-context';
import { ApiError, describeError } from '@/lib/errors';

import { checkHandleAvailable } from './api';
import { OnboardingFooter, OnboardingProgress } from './components/onboarding-chrome';

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
  const { profile, updateProfile, account, completeSignupProfile, completeSocialOnboarding } = useAccount();
  const isSocialOnboarding = account?.pendingOnboarding === true;
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<HandleCheck | null>(null);

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

  const next = async () => {
    if (busyRef.current) return;
    if (nameMissing || handleShort || handleTaken) {
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
        router.push('/boas-vindas/assuntos');
      } else {
        const alreadyVerified = account?.emailVerified ?? false;
        await completeSignupProfile();
        router.push(alreadyVerified ? '/boas-vindas/assuntos' : '/boas-vindas/verificar');
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
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
              onPress={() => toast.show('Foto de perfil chega numa próxima etapa.')}
              accessibilityRole="button"
              accessibilityLabel="Adicionar foto de perfil"
              accessibilityHint="Ainda não disponível"
              style={({ pressed }) => [styles.photo, pressed && styles.pressed]}>
              <Icon name="camera" size={30} />
            </Pressable>
            <View style={styles.photoText}>
              <AppText style={styles.photoTitle}>Adicionar foto</AppText>
              <AppText style={styles.photoSub} color={Colors.muted}>
                Opcional. Um rosto ajuda a criar confiança nas comunas.
              </AppText>
            </View>
          </View>

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
          <TextField
            label="Cidade"
            value={profile.city}
            onChangeText={(city) => updateProfile({ city })}
            placeholder="Cidade, UF"
            autoComplete="postal-address-locality"
            textContentType="addressCity"
          />
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
