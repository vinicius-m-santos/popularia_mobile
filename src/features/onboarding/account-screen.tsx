import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { describeError } from '@/lib/errors';
import { isValidEmail, PASSWORD_MIN_LENGTH } from '@/lib/validation';

import { OnboardingFooter, OnboardingProgress } from './components/onboarding-chrome';

type Mode = 'cadastro' | 'entrar';

/**
 * Criar conta ou entrar (etapa 1 do cadastro).
 * - Cadastro: e-mail e senha ficam só na memória até a etapa 2, que cria a conta na API.
 * - Entrar: login real (POST /auth/login); a sessão fica guardada com segurança no aparelho.
 * Sem API configurada (modo demonstração), nada é enviado e o login entra no perfil fictício.
 * Não pedimos CPF: a conta não precisa de documento civil.
 */
export default function AccountScreen() {
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  const mode: Mode = modo === 'entrar' ? 'entrar' : 'cadastro';
  const signup = mode === 'cadastro';
  const { startSignup, setSignupCredentials, signIn } = useAccount();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailError = !email.trim()
    ? 'Informe seu e-mail'
    : !isValidEmail(email)
      ? 'Confira o e-mail: falta algo como “@” ou “.com”'
      : null;
  const passwordError =
    password.length < PASSWORD_MIN_LENGTH ? `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres` : null;
  const valid = !emailError && !passwordError;

  const switchMode = () => {
    setSubmitted(false);
    setServerError(null);
    if (signup) {
      router.setParams({ modo: 'entrar' });
    } else {
      startSignup();
      router.setParams({ modo: 'cadastro' });
    }
  };

  const soon = (what: string) => () => toast.show(`${what} chega numa próxima etapa.`);

  const submit = async () => {
    if (busy) return;
    setServerError(null);
    if (!valid) {
      setSubmitted(true);
      toast.show('Confira os campos destacados.');
      return;
    }
    if (signup) {
      setSignupCredentials(email, password);
      router.push('/boas-vindas/perfil');
      return;
    }
    setBusy(true);
    try {
      // Ao entrar, o guarda de rotas leva ao feed sozinho.
      await signIn(email, password);
      if (DEMO_MODE) toast.show('Modo demonstração: você entrou no perfil fictício.');
    } catch (error) {
      setServerError(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {signup ? (
        <OnboardingProgress step={1} />
      ) : (
        <View style={styles.backRow}>
          <IconButton icon="back" accessibilityLabel="Voltar" onPress={() => router.back()} />
        </View>
      )}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View>
            <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              {signup ? 'Crie sua conta' : 'Entrar'}
            </AppText>
            <AppText style={styles.sub} color={Colors.inkSoft}>
              {signup ? 'Leva menos de um minuto.' : 'Bom te ver de novo.'}
            </AppText>
          </View>

          <View style={styles.social}>
            <SocialButton label="Continuar com Google" mark="G" onPress={soon('Entrar com Google')} />
            <SocialButton
              label="Continuar com número de celular"
              icon="phone"
              onPress={soon('Entrar com celular')}
            />
          </View>

          <View style={styles.divider} accessible={false}>
            <View style={styles.dividerLine} />
            <AppText variant="label" color={Colors.muted} style={styles.dividerText}>
              ou com e-mail
            </AppText>
            <View style={styles.dividerLine} />
          </View>

          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType={signup ? 'username' : 'emailAddress'}
            returnKeyType="next"
            hint={submitted && emailError ? emailError : undefined}
            hintColor={Colors.red}
          />

          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={signup ? 'new-password' : 'current-password'}
            textContentType={signup ? 'newPassword' : 'password'}
            hint={submitted && passwordError ? passwordError : (serverError ?? undefined)}
            hintColor={Colors.red}
            accessory={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                hitSlop={8}
                style={styles.reveal}>
                <AppText style={styles.revealLabel} color={Colors.red}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </AppText>
              </Pressable>
            }
          />

          {!signup ? (
            <Pressable
              onPress={() => (DEMO_MODE ? soon('Recuperar senha')() : router.push('/boas-vindas/recuperar'))}
              accessibilityRole="button"
              style={styles.forgot}>
              <AppText style={styles.linkLabel} color={Colors.red}>
                Esqueci minha senha
              </AppText>
            </Pressable>
          ) : null}

          <View style={styles.switchRow}>
            <AppText style={styles.switchText} color={Colors.inkSoft}>
              {signup ? 'Já tem conta?' : 'Ainda não tem conta?'}
            </AppText>
            <Pressable onPress={switchMode} accessibilityRole="button" style={styles.switchButton}>
              <AppText style={styles.linkLabel} color={Colors.red}>
                {signup ? 'Entrar' : 'Criar conta'}
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
        <OnboardingFooter
          label={busy ? 'Entrando…' : signup ? 'Continuar' : 'Entrar'}
          onPress={submit}
          hint={
            DEMO_MODE
              ? 'Modo demonstração: nenhuma conta é criada ou verificada, e nada sai deste aparelho.'
              : signup
                ? 'Na próxima etapa você escolhe como aparecer. Depois enviamos um código para o seu e-mail.'
                : undefined
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

type SocialProps = {
  label: string;
  onPress: () => void;
  mark?: string;
  icon?: 'phone';
};

function SocialButton({ label, onPress, mark, icon }: SocialProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Ainda não disponível"
      style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}>
      {mark ? (
        <View style={styles.socialMark} accessible={false}>
          <AppText style={styles.socialMarkText} maxFontSizeMultiplier={1}>
            {mark}
          </AppText>
        </View>
      ) : null}
      {icon ? <Icon name={icon} size={20} /> : null}
      <AppText style={styles.socialLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backRow: {
    paddingTop: 2,
    paddingBottom: Spacing.two,
    paddingLeft: 6,
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
  social: {
    gap: Spacing.two,
  },
  socialButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two + 2,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  pressed: {
    opacity: 0.75,
  },
  socialMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialMarkText: {
    fontFamily: Fonts.extrabold,
    fontSize: 12,
    lineHeight: 15,
  },
  socialLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#BFAF94',
  },
  dividerText: {
    fontSize: 10.5,
  },
  reveal: {
    minHeight: 44,
    paddingHorizontal: Spacing.one,
    justifyContent: 'center',
  },
  revealLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 13,
    lineHeight: 17,
  },
  forgot: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    marginTop: -Spacing.two,
  },
  linkLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  switchText: {
    fontSize: 14,
    lineHeight: 19,
  },
  switchButton: {
    minHeight: 40,
    justifyContent: 'center',
  },
});
