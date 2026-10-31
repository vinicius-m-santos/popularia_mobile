import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';
import { describeError } from '@/lib/errors';
import { openPlatformModeration } from '@/lib/routes';
import { useAccount } from './account-context';

type AccountItem = { path: string; title: string; description: string; icon: IconName };

const ITEMS: AccountItem[] = [
  { path: 'meus-dados', title: 'Meus dados', description: 'Nome, @, endereço, bio e senha', icon: 'user' },
  { path: 'privacidade', title: 'Privacidade', description: 'Perfil público, privado e solicitações', icon: 'shield' },
  { path: 'bloqueados', title: 'Pessoas bloqueadas', description: 'Gerencie quem você bloqueou', icon: 'mute' },
  { path: 'sobre-e-legal', title: 'Sobre e legal', description: 'Regras, termos, privacidade e suporte', icon: 'document' },
  { path: 'exclusao', title: 'Exclusão de conta', description: 'Apague sua conta e seus dados', icon: 'trash' },
];

export default function AccountSettingsScreen() {
  const { account, signOut } = useAccount();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const leave = async (everywhere = false) => {
    if (busy) return;
    setBusy(true);
    try { await signOut(everywhere); }
    catch (error) { toast.show(describeError(error)); setBusy(false); }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <EventBar title="Conta" />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={styles.content}>
        {account ? (
          <View style={styles.emailCard}>
            <AppText variant="label" color={Colors.muted}>E-mail · não editável</AppText>
            <AppText style={styles.email}>{account.email}</AppText>
            <View style={styles.statusRow}>
              <Icon name={account.emailVerified ? 'check' : 'bell'} size={16} color={account.emailVerified ? Colors.ink : Colors.red} />
              <AppText style={styles.status} color={account.emailVerified ? Colors.ink : Colors.red}>
                {account.emailVerified ? 'Confirmado' : 'Ainda não confirmado'}
              </AppText>
            </View>
            {!account.emailVerified ? (
              <EditorialAction
                label="Confirmar e-mail"
                icon="check"
                labelVariant="button"
                onPress={() => router.push('/verificar-email')}
                style={[styles.emailAction, styles.secondaryAction]}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.emailCard}>
            <AppText variant="label" color={Colors.muted}>Sessão local</AppText>
            <AppText style={styles.email}>Modo demonstração</AppText>
            <AppText variant="caption">Entre com uma conta conectada para alterar dados, privacidade e sessões.</AppText>
          </View>
        )}

        {account && (account.platformRole === 'platform_moderator' || account.platformRole === 'admin') ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fila da plataforma. Denúncias globais e escaladas"
            onPress={openPlatformModeration}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={[styles.itemIcon, styles.itemIconAccent]}><Icon name="flag" size={20} color={Colors.red} /></View>
            <View style={styles.itemCopy}>
              <AppText style={styles.itemTitle}>Fila da plataforma</AppText>
              <AppText variant="caption">Denúncias globais e escaladas</AppText>
            </View>
            <Icon name="chevronRight" size={18} color={Colors.muted} />
          </Pressable>
        ) : null}

        <View style={styles.menu}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.path}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.description}`}
              onPress={() => router.push((`/conta/${item.path}`) as never)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={[styles.itemIcon, (item.path === 'privacidade' || item.path === 'exclusao') && styles.itemIconAccent]}>
                <Icon name={item.icon} size={20} color={item.path === 'privacidade' || item.path === 'exclusao' ? Colors.red : Colors.ink} />
              </View>
              <View style={styles.itemCopy}>
                <AppText style={styles.itemTitle}>{item.title}</AppText>
                <AppText variant="caption">{item.description}</AppText>
              </View>
              <Icon name="chevronRight" size={18} color={Colors.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.logout}>
          <EditorialAction
            label="Sair deste aparelho"
            icon="close"
            labelVariant="button"
            disabled={busy}
            onPress={() => { void leave(false); }}
            style={styles.secondaryAction}
          />
          {account ? (
            <EditorialAction
              label="Sair de todos os aparelhos"
              icon="globe"
              labelVariant="button"
              tone="red"
              disabled={busy}
              onPress={() => { void leave(true); }}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five + 2,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  emailCard: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.paper,
  },
  email: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  status: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  emailAction: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
    borderRadius: Radius.sm,
  },
  secondaryAction: {
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  menu: {
    gap: Spacing.two,
  },
  item: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.paper,
  },
  itemIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.strawLight,
  },
  itemIconAccent: {
    backgroundColor: Colors.redSoft,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
  },
  pressed: {
    backgroundColor: Colors.strawLight,
  },
  logout: {
    gap: Spacing.two,
  },
});
