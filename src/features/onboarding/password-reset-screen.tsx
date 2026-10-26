import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { confirmPasswordReset, requestPasswordReset } from '@/features/account/api';
import { describeError } from '@/lib/errors';
import { isValidEmail, PASSWORD_MIN_LENGTH } from '@/lib/validation';

import { OnboardingFooter } from './components/onboarding-chrome';

type Step = 'email' | 'code';

/**
 * "Esqueci minha senha": pede um código por e-mail e cria uma senha nova com ele.
 * A resposta do pedido é a mesma exista ou não a conta. Trocar a senha encerra
 * todas as sessões abertas (inclusive as de quem tivesse invadido a conta).
 */
export default function PasswordResetScreen() {
  const toast = useToast();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const sendCode = () => {
    if (!isValidEmail(email)) {
      setError('Confira o e-mail: falta algo como “@” ou “.com”');
      return;
    }
    void run(async () => {
      await requestPasswordReset(email);
      setStep('code');
    });
  };

  const savePassword = () => {
    if (!/^\d{6}$/.test(code)) {
      setError('O código tem 6 números.');
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres`);
      return;
    }
    void run(async () => {
      await confirmPasswordReset(email, code, password);
      toast.show('Senha nova criada. Entre com ela.');
      router.back();
    });
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardView style={styles.flex}>
        <View style={styles.backRow}>
          <IconButton icon="back" accessibilityLabel="Voltar" onPress={() => router.back()} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View>
            <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              Nova senha
            </AppText>
            <AppText style={styles.sub} color={Colors.inkSoft}>
              {step === 'email'
                ? 'Informe o e-mail da sua conta. Se ele estiver cadastrado, mandamos um código.'
                : `Se ${email.trim()} tiver conta, o código chega em instantes. Ele vale por 30 minutos.`}
            </AppText>
          </View>

          {step === 'email' ? (
            <TextField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              hint={error ?? undefined}
              hintColor={Colors.red}
            />
          ) : (
            <>
              <TextField
                label="Código"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
              />
              <TextField
                label="Senha nova"
                value={password}
                onChangeText={setPassword}
                placeholder={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                hint={error ?? undefined}
                hintColor={Colors.red}
              />
            </>
          )}
        </ScrollView>
        <OnboardingFooter
          disabled={busy}
          label={busy ? 'Enviando…' : step === 'email' ? 'Enviar código' : 'Salvar senha nova'}
          onPress={step === 'email' ? sendCode : savePassword}
          hint={step === 'code' ? 'Ao salvar, todas as sessões abertas da conta são encerradas.' : undefined}
        />
      </KeyboardView>
    </Screen>
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
});
