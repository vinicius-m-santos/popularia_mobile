import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { resendVerificationCode, verifyEmail } from '@/features/account/api';
import { describeError } from '@/lib/errors';

import { OnboardingFooter, OnboardingProgress } from './components/onboarding-chrome';

/**
 * Confirmação do e-mail com o código de 6 dígitos. No cadastro fica entre o perfil e os
 * assuntos, e dá para deixar para depois: entrar e ler funcionam sem confirmar; publicar,
 * comentar e denunciar exigem o e-mail confirmado (regra do servidor).
 * Também abre pela tela Conta (`/verificar-email`).
 */
export default function VerifyEmailScreen({ inOnboarding = false }: { inOnboarding?: boolean }) {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { account, reloadAccount } = useAccount();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const busyRef = useRef(false);

  const address = account?.email ?? email ?? 'seu e-mail';

  const leave = () => {
    if (inOnboarding) router.push('/boas-vindas/assuntos');
    else if (router.canGoBack()) router.back();
    else router.replace('/perfil');
  };

  const confirm = async () => {
    if (busyRef.current) return;
    if (!/^\d{6}$/.test(code)) {
      setError('O código tem 6 números.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(code);
      await reloadAccount();
      toast.show('E-mail confirmado.');
      leave();
    } catch (e) {
      setError(describeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setResending(true);
    try {
      await resendVerificationCode();
      toast.show('Enviamos um novo código. O anterior deixou de valer.');
    } catch (e) {
      toast.show(describeError(e));
    } finally {
      busyRef.current = false;
      setResending(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardView style={styles.flex}>
        {inOnboarding ? (
          <OnboardingProgress step={2} />
        ) : (
          <View style={styles.backRow}>
            <IconButton icon="close" size={20} accessibilityLabel="Fechar" onPress={leave} />
          </View>
        )}
        <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View>
            <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              Confira seu e-mail
            </AppText>
            <AppText style={styles.sub} color={Colors.inkSoft}>
              Mandamos um código de 6 números para {address}. Ele vale por 24 horas.
            </AppText>
          </View>

          <TextField
            label="Código"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            hint={error ?? undefined}
            hintColor={Colors.red}
          />

          <View style={styles.links}>
            <Pressable onPress={resend} disabled={busy || resending} accessibilityState={{ busy: resending, disabled: busy || resending }} accessibilityRole="button" style={styles.link}>
              <AppText style={styles.linkLabel} color={Colors.red}>
                {resending ? 'Reenviando…' : 'Reenviar código'}
              </AppText>
            </Pressable>
            {inOnboarding ? (
              <Pressable onPress={leave} accessibilityRole="button" style={styles.link}>
                <AppText style={styles.linkLabel} color={Colors.inkSoft}>
                  Confirmar depois
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
        <OnboardingFooter
          disabled={busy || resending}
          label={busy ? 'Confirmando…' : 'Confirmar e-mail'}
          onPress={confirm}
          hint="Sem confirmar, você pode ler, mas ainda não pode publicar nem comentar."
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
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -Spacing.two,
  },
  link: {
    minHeight: 40,
    justifyContent: 'center',
  },
  linkLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
});
