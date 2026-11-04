import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { ApiError, describeError } from '@/lib/errors';
import { goBack } from '@/lib/routes';
import { SobreELegalLink } from '@/features/legal/sobre-e-legal-link';
import { AuthEmailField, AuthPasswordField } from './components/auth-fields';
import { AuthFooter } from './components/auth-footer';
import { SocialAuthButtons } from './components/social-auth-buttons';
import { isValidEmail } from '@/lib/validation';

const LOGIN = {
  bg: '#F2EADB',
  surface: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  redText: '#A3261C',
  secondary: '#5E554A',
  placeholder: '#6E6458',
  line: '#D9CFBF',
  buttonText: '#FBF7EF',
} as const;

/** Login por e-mail ou provedores sociais, com rodapé fixo e ações de recuperação/criação. */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, signInWithApple, startSignup } = useAccount();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const busyRef = useRef(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); return () => setStatusBarStyle('dark'); }, []));


  const clearFormError = () => {
    if (!formError && !authFailed) return;
    setFormError(null);
    setAuthFailed(false);
  };

  const changeEmail = (value: string) => {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    clearFormError();
  };

  const changePassword = (value: string) => {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    clearFormError();
  };

  const submit = async () => {
    if (busyRef.current) return;
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Preencha o e-mail';
    else if (!isValidEmail(email)) next.email = 'Confira o e-mail';
    if (!password) next.password = 'Preencha a senha';
    setFieldErrors(next);
    setFormError(null);
    setAuthFailed(false);
    if (Object.keys(next).length > 0) return;

    busyRef.current = true;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError('E-mail ou senha incorretos.');
        setAuthFailed(true);
      } else {
        setFormError(describeError(error));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (busy || socialBusy) return;
    setSocialBusy(true);
    try {
      if (DEMO_MODE) toast.show('Google indisponível no modo demonstração.');
      else await signInWithGoogle();
    } catch (error) {
      toast.show(describeError(error));
    } finally {
      setSocialBusy(false);
    }
  };

  const handleApple = async () => {
    if (busy || socialBusy) return;
    setSocialBusy(true);
    try {
      if (DEMO_MODE) toast.show('Apple indisponível no modo demonstração.');
      else await signInWithApple();
    } catch (error) {
      toast.show(describeError(error));
    } finally {
      setSocialBusy(false);
    }
  };

  const createAccount = () => {
    startSignup();
    router.setParams({ modo: 'cadastro' });
  };

  return (
    <Screen edges={['left', 'right']} backgroundColor={LOGIN.bg}>
      <KeyboardView style={styles.flex} keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.flex}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 54) }]}>
          <View style={styles.topBar}>
            <IconButton icon="back" size={22} accessibilityLabel="Voltar" onPress={goBack} />
            <SobreELegalLink />
          </View>

          <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>ENTRAR</AppText>
          <AppText style={styles.subtitle}>Que bom te ver de novo.</AppText>

          <View style={styles.social} accessibilityLabel="Entrar com provedor">
            <SocialAuthButtons
              disabled={busy || socialBusy}
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
            onChangeText={changeEmail}
            error={fieldErrors.email}
            failed={authFailed}
            onSubmitEditing={() => passwordRef.current?.focus()}
            returnKeyType="next"
          />

          <AuthPasswordField
            value={password}
            onChangeText={changePassword}
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((current) => !current)}
            error={fieldErrors.password}
            failed={authFailed}
            onSubmitEditing={() => { void submit(); }}
            inputRef={passwordRef}
            returnKeyType="go"
          />

          <Pressable
            onPress={() => (DEMO_MODE ? toast.show('Recuperar senha chega numa próxima etapa.') : router.push('/boas-vindas/recuperar'))}
            accessibilityRole="link"
            style={styles.forgot}>
            <AppText style={styles.forgotText}>Esqueci minha senha</AppText>
          </Pressable>
        </ScrollView>

        <AuthFooter
          label="Entrar"
          onPress={() => { void submit(); }}
          busy={busy}
          error={formError}
          secondaryText="Ainda não tem conta?"
          secondaryAction="Criar conta"
          onSecondary={createAccount}
        />
      </KeyboardView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -10 },
  title: { marginTop: 12, paddingTop: 4, fontFamily: Fonts.anton, fontSize: 58, lineHeight: 66, textTransform: 'uppercase', color: LOGIN.ink },
  subtitle: { marginTop: 6, fontFamily: Fonts.regular, fontSize: 17, lineHeight: 24, color: LOGIN.ink },
  social: { marginTop: 20 },
  divider: { marginTop: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: LOGIN.line },
  dividerText: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 15, letterSpacing: 1.1, color: LOGIN.secondary },
  forgot: { alignSelf: 'flex-start', minHeight: 44, marginTop: 4, justifyContent: 'center' },
  forgotText: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 21, color: LOGIN.redText },
});
