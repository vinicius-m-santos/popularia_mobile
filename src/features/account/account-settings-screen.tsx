import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { describeError } from '@/lib/errors';

import { useAccount } from './account-context';

/**
 * Conta (engrenagem do próprio perfil): e-mail, confirmação e saída.
 * "Sair de todos os aparelhos" encerra no servidor todas as sessões da conta.
 */
export default function AccountSettingsScreen() {
  const { account, signOut } = useAccount();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const leave = async (everywhere: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      // Ao sair, o guarda de rotas volta para as boas-vindas.
      await signOut(everywhere);
    } catch (error) {
      toast.show(describeError(error));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.bar}>
        <IconButton icon="close" size={20} accessibilityLabel="Fechar" onPress={() => router.back()} />
        <AppText style={styles.barTitle} accessibilityRole="header">
          Conta
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {account ? (
          <View style={styles.section}>
            <AppText variant="label" color={Colors.muted}>
              E-mail · só você vê
            </AppText>
            <AppText style={styles.value}>{account.email}</AppText>
            <AppText style={styles.status} color={account.emailVerified ? Colors.ink : Colors.red}>
              {account.emailVerified ? '✓ Confirmado' : 'Ainda não confirmado: confirme para publicar e comentar.'}
            </AppText>
            {!account.emailVerified ? (
              <PillButton label="Confirmar e-mail" onPress={() => router.push('/verificar-email')} variant="outline" />
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <AppText style={styles.value}>Modo demonstração</AppText>
            <AppText style={styles.status} color={Colors.inkSoft}>
              Sem servidor configurado: nada desta conta é guardado nem enviado.
            </AppText>
          </View>
        )}

        <View style={styles.section}>
          <PillButton label="Sair deste aparelho" onPress={() => leave(false)} variant="outline" size="lg" display />
          {account ? (
            <>
              <PillButton label="Sair de todos os aparelhos" onPress={() => leave(true)} variant="dark" size="lg" display />
              <AppText style={styles.status} color={Colors.muted}>
                Use se perdeu um aparelho ou acha que alguém entrou na sua conta. Depois, troque a senha em
                “Esqueci minha senha”.
              </AppText>
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
  },
  barTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five + 2,
    paddingBottom: Spacing.six,
    gap: Spacing.six,
  },
  section: {
    gap: Spacing.two + 2,
  },
  value: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  status: {
    fontSize: 13.5,
    lineHeight: 18,
  },
});
