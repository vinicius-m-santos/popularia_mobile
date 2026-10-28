import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { resendVerificationCode } from '@/features/account/api';
import { describeError } from '@/lib/errors';

import { OnboardingFooter, OnboardingProgress } from './components/onboarding-chrome';

let lastAutomaticSend: { address: string; at: number } | null = null;

/**
 * Confirmação do e-mail com o código de 6 dígitos. No cadastro fica entre o perfil e os
 * assuntos, e dá para deixar para depois: entrar e ler funcionam sem confirmar; publicar,
 * comentar e denunciar exigem o e-mail confirmado (regra do servidor).
 * Também abre pela tela Conta (`/verificar-email`).
 */
export default function VerifyEmailScreen({ inOnboarding = false }: { inOnboarding?: boolean }) {
  const { email, sent } = useLocalSearchParams<{ email?: string; sent?: string }>();
  const { account, confirmEmail } = useAccount();
  const toast = useToast();
  const address = account?.email ?? email ?? 'seu e-mail';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const busyRef = useRef(false);
  const autoSendStarted = useRef(false);
  const [cooldown, setCooldown] = useState(() => {
    const elapsed = lastAutomaticSend?.address === address ? Date.now() - lastAutomaticSend.at : Number.POSITIVE_INFINITY;
    return elapsed < 60_000 ? Math.ceil((60_000 - elapsed) / 1000) : 60;
  });

  useEffect(() => {
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (account?.emailVerified || autoSendStarted.current) return;
    autoSendStarted.current = true;
    // O cadastro já emite o primeiro código no backend; entrar nesta rota logo depois
    // apenas inicia o cooldown, sem invalidá-lo com um segundo e-mail.
    if (sent === '1') {
      lastAutomaticSend = { address, at: Date.now() };
      return;
    }
    const elapsed = lastAutomaticSend?.address === address ? Date.now() - lastAutomaticSend.at : Number.POSITIVE_INFINITY;
    if (elapsed < 60_000) return;
    lastAutomaticSend = { address, at: Date.now() };
    resendVerificationCode()
      .catch((e) => toast.show(describeError(e)));
  }, [account?.emailVerified, address, sent, toast]);

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
      await confirmEmail(code);
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
    if (busyRef.current || cooldown > 0) return;
    busyRef.current = true;
    setResending(true);
    setCooldown(60);
    lastAutomaticSend = { address, at: Date.now() };
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
            <IconButton icon="back" size={20} accessibilityLabel="Voltar" onPress={leave} />
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
            <Pressable onPress={resend} disabled={busy || resending || cooldown > 0} accessibilityState={{ busy: resending, disabled: busy || resending || cooldown > 0 }} accessibilityRole="button" style={styles.link}>
              <AppText style={styles.linkLabel} color={Colors.red}>
                {resending ? 'Enviando…' : cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
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
