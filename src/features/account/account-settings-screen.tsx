import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { describeError } from '@/lib/errors';
import { performanceDiagnosticsAvailable } from '@/lib/performance';
import { goBack, openPlatformModeration } from '@/lib/routes';

type AccountItem = { path: string; href?: string; title: string; description: string; icon: IconName };

const ACCOUNT_ITEMS: AccountItem[] = [
  { path: 'meus-dados', title: 'Meus dados', description: 'Nome, @, endereço, bio e senha', icon: 'user' },
  { path: 'interesses', href: '/interesses', title: 'Interesses', description: 'Assuntos que movem seu feed', icon: 'heart' },
  { path: 'privacidade', title: 'Privacidade', description: 'Perfil público, privado e solicitações', icon: 'shield' },
  { path: 'bloqueados', title: 'Pessoas bloqueadas', description: 'Gerencie quem você bloqueou', icon: 'block' },
];

const ABOUT_ITEMS: AccountItem[] = [
  { path: 'sobre-e-legal', title: 'Sobre e legal', description: 'Regras, termos, privacidade e suporte', icon: 'document' },
];

export default function AccountSettingsScreen() {
  const { account, signOut } = useAccount();
  const me = useMe();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const leave = async (everywhere = false) => {
    if (busy) return;
    setBusy(true);
    try { await signOut(everywhere); }
    catch (error) { toast.show(describeError(error)); setBusy(false); }
  };

  return (
    <Screen>
      <EditorialHeader title="Conta" onBack={goBack} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={styles.content}>
        {account ? (
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              <Avatar initials={me.initials} tone={me.tone} size={56} shape="square" outline font="anton" userId={me.id} imageUrl={me.avatarUrl} />
              <View style={styles.identityCopy}>
                <AppText style={styles.name} numberOfLines={1}>{me.name}</AppText>
                <AppText variant="caption">@{me.handle}</AppText>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.emailBlock}>
              <AppText variant="label" color={Colors.inkSoft}>E-mail</AppText>
              <View style={styles.emailRow}>
                <AppText style={styles.email} numberOfLines={1}>{account.email}</AppText>
                <View style={[styles.emailBadge, !account.emailVerified && styles.emailBadgePending]}>
                  {account.emailVerified ? <Icon name="check" size={12} color={Colors.paper} /> : null}
                  <AppText style={styles.emailBadgeText} color={Colors.paper}>{account.emailVerified ? 'Confirmado' : 'Pendente'}</AppText>
                </View>
              </View>
              <AppText variant="caption">O e-mail não pode ser alterado.</AppText>
              {!account.emailVerified ? (
                <EditorialAction
                  label="Confirmar e-mail"
                  icon="check"
                  labelVariant="button"
                  onPress={() => router.push('/verificar-email')}
                  style={styles.emailAction}
                />
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.identityCard}>
            <View style={styles.emailBlock}>
              <AppText variant="label" color={Colors.inkSoft}>Sessão local</AppText>
              <AppText style={styles.email}>Modo demonstração</AppText>
              <AppText variant="caption">Entre com uma conta conectada para alterar dados, privacidade e sessões.</AppText>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Sua conta" />
          <SettingsGroup>
            {ACCOUNT_ITEMS.map((item, index) => <SettingsRow key={item.path} item={item} last={index === ACCOUNT_ITEMS.length - 1 && !(account && (account.platformRole === 'platform_moderator' || account.platformRole === 'admin'))} />)}
            {account && (account.platformRole === 'platform_moderator' || account.platformRole === 'admin') ? (
              <SettingsButton
                icon="flag"
                title="Fila da plataforma"
                description="Denúncias globais e escaladas"
                last
                onPress={openPlatformModeration}
              />
            ) : null}
          </SettingsGroup>
        </View>

        {performanceDiagnosticsAvailable() ? (
          <View style={styles.section}>
            <SectionHeading appearance="editorial" label="Diagnóstico" />
            <SettingsGroup>
              <SettingsButton
                icon="pie"
                title="Diagnóstico de performance"
                description="Somente desenvolvimento e staging"
                last
                onPress={() => router.push('/diagnostico-performance' as never)}
              />
            </SettingsGroup>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Sobre" />
          <SettingsGroup>
            {ABOUT_ITEMS.map((item, index) => <SettingsRow key={item.path} item={item} last={index === ABOUT_ITEMS.length - 1} />)}
          </SettingsGroup>
        </View>

        <View style={styles.section}>
          <SectionHeading appearance="editorial" label="Sessão" />
          <SettingsGroup>
            <SettingsButton icon="logout" title="Sair deste aparelho" last={!account} disabled={busy} onPress={() => { void leave(false); }} />
            {account ? <SettingsButton icon="globe" title="Sair de todos os aparelhos" description="Útil se você perdeu o celular" last disabled={busy} onPress={() => { void leave(true); }} /> : null}
          </SettingsGroup>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Excluir conta. Apaga sua conta e seus dados de vez"
          onPress={() => router.push('/conta/exclusao' as never)}
          style={({ pressed }) => [styles.deleteCard, pressed && styles.pressed]}>
          <View style={styles.deleteIcon}><Icon name="trash" size={22} color={Colors.red} /></View>
          <View style={styles.deleteCopy}>
            <AppText style={styles.deleteTitle} color={Colors.red}>Excluir conta</AppText>
            <AppText variant="caption" style={styles.deleteDescription}>Apaga sua conta e seus dados de vez</AppText>
          </View>
          <Icon name="chevronRight" size={18} color={Colors.red} />
        </Pressable>

        <AppText variant="label" style={styles.version}>Popularia · Versão {version}</AppText>
      </ScrollView>
    </Screen>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function SettingsRow({ item, last = false }: { item: AccountItem; last?: boolean }) {
  return (
    <SettingsButton
      icon={item.icon}
      title={item.title}
      description={item.description}
      last={last}
      onPress={() => router.push((item.href ?? `/conta/${item.path}`) as never)}
    />
  );
}

function SettingsButton({ icon, title, description, disabled = false, last = false, onPress }: {
  icon: IconName;
  title: string;
  description?: string;
  disabled?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && !disabled && styles.rowPressed, disabled && styles.rowDisabled]}>
      <View style={styles.rowIcon}><Icon name={icon} size={21} color={Colors.ink} /></View>
      <View style={styles.rowCopy}>
        <AppText style={styles.rowTitle}>{title}</AppText>
        {description ? <AppText variant="caption" numberOfLines={2}>{description}</AppText> : null}
      </View>
      <Icon name="chevronRight" size={18} color={Colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.six,
  },
  identityCard: {
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Shadows.offsetSmall,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  name: {
    fontFamily: Fonts.extrabold,
    fontSize: 20,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.strawDark,
  },
  emailBlock: {
    gap: 3,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  emailBadge: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: Colors.ink,
  },
  emailBadgePending: {
    backgroundColor: Colors.red,
  },
  emailBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  email: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  emailAction: {
    alignSelf: 'stretch',
    borderRadius: Radius.sm,
  },
  section: {
    gap: 0,
  },
  group: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.strawDark,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: Colors.strawLight,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.straw,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  rowTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 20,
  },
  deleteCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.red,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cream,
  },
  deleteIcon: {
    width: 22,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  deleteTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
  },
  deleteDescription: {
    color: Colors.red,
  },
  pressed: {
    opacity: 0.7,
  },
  version: {
    textAlign: 'center',
    color: Colors.muted,
    letterSpacing: 2,
  },
});
