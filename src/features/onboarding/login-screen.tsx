import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { SvgXml } from 'react-native-svg';

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

const APPLE_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#15120F" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>`;

type SocialProps = { label: string; icon: ReactNode; onPress: () => void; disabled?: boolean };

function SocialButton({ label, icon, onPress, disabled }: SocialProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.socialButton, (pressed || disabled) && styles.socialMuted]}>
      <View style={styles.socialIcon}>{icon}</View>
      <AppText style={styles.socialLabel}>{label}</AppText>
    </Pressable>
  );
}

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
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const busyRef = useRef(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); return () => setStatusBarStyle('dark'); }, []));

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

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
            <SocialButton
              label="Continuar com Google"
              icon={<Image source={require('@/assets/onboarding/google-g.png')} style={styles.socialLogo} resizeMode="contain" />}
              onPress={() => { void handleGoogle(); }}
              disabled={busy || socialBusy}
            />
            {Platform.OS === 'ios' && appleAvailable ? (
              <View pointerEvents={busy || socialBusy ? 'none' : 'auto'} style={busy || socialBusy ? styles.socialMuted : undefined}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                  cornerRadius={6}
                  style={styles.appleButton}
                  onPress={() => { void handleApple(); }}
                />
              </View>
            ) : (
              <SocialButton
                label="Continuar com a Apple"
                icon={<SvgXml xml={APPLE_SVG} width={20} height={20} />}
                onPress={() => { void handleApple(); }}
                disabled={busy || socialBusy}
              />
            )}
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
  social: { marginTop: 20, gap: 10 },
  socialButton: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 2, borderColor: LOGIN.ink, borderRadius: 6, backgroundColor: LOGIN.surface },
  socialIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  socialLogo: { width: 20, height: 20 },
  socialLabel: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22, color: LOGIN.ink },
  socialMuted: { opacity: 0.55 },
  appleButton: { height: 52, width: '100%' },
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
