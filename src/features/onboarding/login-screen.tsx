import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { ApiError, describeError } from '@/lib/errors';
import { goBack } from '@/lib/routes';
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
  const keyboardVisible = useKeyboardVisible();
  const { signIn, signInWithGoogle, signInWithApple, startSignup } = useAccount();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
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

  const borderFor = (field: 'email' | 'password') => {
    if (fieldErrors[field] || authFailed) return LOGIN.redText;
    return focused === field ? LOGIN.red : LOGIN.ink;
  };

  return (
    <Screen edges={['left', 'right']} backgroundColor={LOGIN.bg}>
      <KeyboardView style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 54) }]}>
          <View style={styles.topBar}>
            <IconButton icon="back" size={22} accessibilityLabel="Voltar" onPress={goBack} />
            <Pressable onPress={() => router.push('/sobre-e-legal')} accessibilityRole="link" accessibilityLabel="Sobre e legal" style={styles.topLegal}>
              <Text style={styles.topLegalText}>SOBRE E LEGAL</Text>
            </Pressable>
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

          <View style={styles.field}>
            <AppText style={styles.label}>E-mail</AppText>
            <View style={[styles.inputBox, { borderColor: borderFor('email') }]}>
              <TextInput
                value={email}
                onChangeText={changeEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="voce@email.com"
                placeholderTextColor={LOGIN.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabel="E-mail"
                style={styles.input}
              />
            </View>
            {fieldErrors.email ? <AppText style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.email}</AppText> : null}
          </View>

          <View style={[styles.field, styles.passwordField]}>
            <AppText style={styles.label}>Senha</AppText>
            <View style={[styles.inputBox, { borderColor: borderFor('password') }]}>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={changePassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="Sua senha"
                placeholderTextColor={LOGIN.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => { void submit(); }}
                accessibilityLabel="Senha"
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                accessibilityState={{ selected: showPassword }}
                style={styles.showButton}>
                <AppText style={styles.showLabel}>{showPassword ? 'Ocultar' : 'Mostrar'}</AppText>
              </Pressable>
            </View>
            {fieldErrors.password ? <AppText style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.password}</AppText> : null}
          </View>

          <Pressable
            onPress={() => (DEMO_MODE ? toast.show('Recuperar senha chega numa próxima etapa.') : router.push('/boas-vindas/recuperar'))}
            accessibilityRole="link"
            style={styles.forgot}>
            <AppText style={styles.forgotText}>Esqueci minha senha</AppText>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, {
          paddingTop: keyboardVisible ? 8 : 14,
          paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 26),
        }]}>
          {formError ? (
            <View style={styles.formError} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <Icon name="alert" size={18} color={LOGIN.redText} />
              <AppText style={styles.formErrorText}>{formError}</AppText>
            </View>
          ) : null}
          <View style={styles.buttonWrap}>
            {!busy ? <View pointerEvents="none" style={styles.buttonShadow} /> : null}
            <Pressable
              onPress={() => { void submit(); }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Entrar"
              accessibilityState={{ busy, disabled: busy }}
              style={({ pressed }) => [styles.primary, busy && styles.primaryDisabled, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryLabel} maxFontSizeMultiplier={1.2}>ENTRAR</Text>
              {busy ? <ActivityIndicator color={LOGIN.buttonText} /> : <Icon name="arrowRight" size={18} color={LOGIN.buttonText} />}
            </Pressable>
          </View>
          {!keyboardVisible ? (
            <Pressable onPress={createAccount} accessibilityRole="link" accessibilityLabel="Ainda não tem conta? Criar conta" style={styles.createLink}>
              <AppText style={styles.createText}>
                Ainda não tem conta? <AppText style={styles.createStrong}>Criar conta</AppText>
              </AppText>
            </Pressable>
          ) : null}
        </View>
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
  topLegal: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  topLegalText: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 16, letterSpacing: 0.88, textTransform: 'uppercase', color: LOGIN.secondary },
  title: { marginTop: 12, paddingTop: 4, fontFamily: Fonts.anton, fontSize: 58, lineHeight: 66, textTransform: 'uppercase', color: LOGIN.ink },
  subtitle: { marginTop: 6, fontFamily: Fonts.regular, fontSize: 17, lineHeight: 24, color: LOGIN.ink },
  social: { marginTop: 20 },
  divider: { marginTop: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: LOGIN.line },
  dividerText: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 15, letterSpacing: 1.1, color: LOGIN.secondary },
  field: { gap: 0 },
  passwordField: { marginTop: 14 },
  label: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 21, color: LOGIN.ink },
  inputBox: { position: 'relative', height: 52, marginTop: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 6, backgroundColor: LOGIN.surface, paddingHorizontal: 14 },
  input: { flex: 1, height: 48, paddingVertical: 0, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22, color: LOGIN.ink, outlineWidth: 0 },
  passwordInput: { paddingRight: 92 },
  showButton: { position: 'absolute', right: 4, top: 4, height: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  showLabel: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 20, color: LOGIN.ink, textDecorationLine: 'underline' },
  fieldError: { marginTop: 6, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 20, color: LOGIN.redText },
  forgot: { alignSelf: 'flex-start', minHeight: 44, marginTop: 4, justifyContent: 'center' },
  forgotText: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 21, color: LOGIN.redText },
  footer: { borderTopWidth: 2, borderTopColor: LOGIN.ink, backgroundColor: LOGIN.bg, paddingTop: 14, paddingHorizontal: 24, gap: 4 },
  formError: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  formErrorText: { flex: 1, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 20, color: LOGIN.redText },
  buttonWrap: { position: 'relative' },
  buttonShadow: { position: 'absolute', top: 3, left: 3, width: '100%', height: '100%', borderRadius: 6, backgroundColor: LOGIN.ink },
  primary: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 2, borderColor: LOGIN.ink, borderRadius: 6, backgroundColor: LOGIN.red },
  primaryDisabled: { opacity: 0.6 },
  primaryPressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  primaryLabel: { fontFamily: Fonts.anton, fontSize: 22, lineHeight: 26, letterSpacing: 0.88, textTransform: 'uppercase', color: LOGIN.buttonText },
  createLink: { minHeight: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  createText: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: LOGIN.ink, textAlign: 'center' },
  createStrong: { fontFamily: Fonts.extrabold, color: LOGIN.redText, textDecorationLine: 'underline' },
});
