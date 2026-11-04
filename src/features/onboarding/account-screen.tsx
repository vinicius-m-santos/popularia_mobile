import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';

import { describeError } from '@/lib/errors';
import { isValidEmail, PASSWORD_MIN_LENGTH } from '@/lib/validation';

import { AuthEmailField, AuthPasswordField } from './components/auth-fields';
import { AuthFooter } from './components/auth-footer';
import { OnboardingHeader } from './components/onboarding-chrome';
import { SocialAuthButtons } from './components/social-auth-buttons';

const SIGNUP = {
  bg: '#F2EADB',
  ink: '#15120F',
  redText: '#A3261C',
  secondary: '#5E554A',
  line: '#D9CFBF',
  paper: '#FBF7EF',
} as const;

/** Etapa 1 do cadastro: credenciais, com o mesmo visual e componentes do login. */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { setSignupCredentials, setLegalAcceptedDraft, signInWithGoogle, signInWithApple } = useAccount();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const emailError = !email.trim() ? 'Preencha o e-mail' : !isValidEmail(email) ? 'Confira o e-mail' : undefined;
  const passwordError = !password ? 'Preencha a senha' : password.length < PASSWORD_MIN_LENGTH ? `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres` : undefined;
  const valid = !emailError && !passwordError;

  const toggleAccepted = () => {
    const next = !accepted;
    setAccepted(next);
    setLegalAcceptedDraft(next);
  };

  const openLegal = (id: 'termos' | 'regras' | 'privacidade') => {
    router.push({ pathname: '/documento-legal/[id]', params: { id } } as never);
  };

  const submit = () => {
    setSubmitted(true);
    if (!accepted || !valid) return;
    setSignupCredentials(email, password);
    router.push('/boas-vindas/perfil');
  };

  const switchToLogin = () => {
    router.setParams({ modo: 'entrar' });
  };

  const handleGoogle = async () => {
    if (socialBusy) return;
    if (DEMO_MODE) { toast.show('Google indisponível no modo demonstração.'); return; }
    setSocialBusy(true);
    try { await signInWithGoogle(); }
    catch (error) { toast.show(describeError(error)); }
    finally { setSocialBusy(false); }
  };

  const handleApple = async () => {
    if (socialBusy) return;
    if (DEMO_MODE) { toast.show('Apple indisponível no modo demonstração.'); return; }
    setSocialBusy(true);
    try { await signInWithApple(); }
    catch (error) { toast.show(describeError(error)); }
    finally { setSocialBusy(false); }
  };

  return (
    <Screen edges={['left', 'right']} backgroundColor={SIGNUP.bg}>
      <KeyboardView style={styles.flex} keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.flex}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 54) }]}>
          <OnboardingHeader step={1} />

          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.1}>CRIAR CONTA</Text>
          <Text style={styles.subtitle}>Leva menos de um minuto.</Text>

          <View style={styles.social}>
            <SocialAuthButtons
              disabled={socialBusy}
              onGoogle={() => { void handleGoogle(); }}
              onApple={() => { void handleApple(); }}
            />
          </View>

          <View style={styles.divider} accessible={false}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OU COM E-MAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          <AuthEmailField
            value={email}
            onChangeText={(value) => { setEmail(value); setSubmitted(false); }}
            error={submitted ? emailError : undefined}
            onSubmitEditing={() => passwordRef.current?.focus()}
            returnKeyType="next"
          />

          <AuthPasswordField
            value={password}
            onChangeText={(value) => { setPassword(value); setSubmitted(false); }}
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((current) => !current)}
            error={submitted ? passwordError : undefined}
            onSubmitEditing={submit}
            inputRef={passwordRef}
            placeholder={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`}
            returnKeyType="go"
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <View style={styles.consentCard}>
            <Pressable
              onPress={toggleAccepted}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              accessibilityLabel="Tenho 18 anos ou mais e aceito os termos de uso, as regras da comunidade e a política de privacidade"
              hitSlop={6}
              style={styles.consentCheckboxTouch}>
              <View style={[styles.consentCheckbox, accepted && styles.consentCheckboxOn]}>
                {accepted ? <Icon name="check" size={16} color={SIGNUP.paper} /> : null}
              </View>
            </Pressable>
            <Text style={styles.consentText}>
              Tenho <Text style={styles.consentStrong}>18 anos ou mais</Text> e aceito os{' '}
              <Text style={styles.consentLink} accessibilityRole="link" onPress={() => openLegal('termos')}>Termos de Uso</Text> e as{' '}
              <Text style={styles.consentLink} accessibilityRole="link" onPress={() => openLegal('regras')}>Regras da Comunidade</Text>. Li a{' '}
              <Text style={styles.consentLink} accessibilityRole="link" onPress={() => openLegal('privacidade')}>Política de Privacidade</Text>.
            </Text>
          </View>
        </ScrollView>

        <AuthFooter
          label="Continuar"
          onPress={submit}
          disabled={!accepted}
          secondaryText="Já tem conta?"
          secondaryAction="Entrar"
          onSecondary={switchToLogin}
        />
      </KeyboardView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  title: { marginTop: 18, paddingTop: 4, fontFamily: Fonts.anton, fontSize: 50, lineHeight: 64, textTransform: 'uppercase', color: SIGNUP.ink },
  subtitle: { marginTop: 8, fontFamily: Fonts.regular, fontSize: 17, lineHeight: 24, color: SIGNUP.ink },
  social: { marginTop: 20 },
  divider: { marginTop: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: SIGNUP.line },
  dividerText: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 15, letterSpacing: 1.1, color: SIGNUP.secondary },
  consentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 14, padding: 16, borderWidth: 2, borderColor: SIGNUP.ink, borderRadius: 6, backgroundColor: SIGNUP.paper },
  consentCheckboxTouch: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  consentCheckbox: { width: 28, height: 28, borderWidth: 2, borderColor: SIGNUP.ink, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: SIGNUP.paper },
  consentCheckboxOn: { backgroundColor: SIGNUP.ink },
  consentText: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 23, color: SIGNUP.ink },
  consentStrong: { fontFamily: Fonts.extrabold },
  consentLink: { fontFamily: Fonts.extrabold, textDecorationLine: 'underline' },
});
