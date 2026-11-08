import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialBar } from '@/components/editorial-bar';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { goBack } from '@/lib/routes';
import type { CreatorInfo } from '@/types/models';

/** Chrome do perfil: voltar, @, compartilhar e opções da conta ou da pessoa. */
export function ProfileBar({ isMe, canGoBack, handle, onMore, onBack, onShare }: {
  isMe: boolean;
  canGoBack: boolean;
  handle?: string;
  onMore?: () => void;
  onBack?: () => void;
  onShare?: () => void;
}) {
  return (
    <EditorialBar
      onBack={canGoBack ? onBack ?? goBack : undefined}
      divider={canGoBack}
      title={
        <AppText variant="label" style={styles.barHandle} numberOfLines={1} accessibilityRole="header">
          {handle ? `@${handle}` : 'Perfil'}
        </AppText>
      }
      actions={isMe ? (
        <View style={styles.barActions}>
          <IconButton icon="shareNodes" accessibilityLabel="Compartilhar perfil" onPress={() => onShare?.()} />
          <IconButton icon="settings" accessibilityLabel="Conta e sessões" onPress={() => router.push('/conta')} />
        </View>
      ) : onMore ? (
        <IconButton icon="more" size={20} accessibilityLabel="Mais opções do perfil" onPress={onMore} />
      ) : undefined}
      reserveActionSpace={!isMe && !onMore}
      minHeight={58}
      inset={Spacing.one}
      gap={Spacing.two}
      rule={2}
    />
  );
}

/** Atalho do perfil com ícone colorido: diferença sem pesar como ação principal. */
export function ProfileShortcut({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}>
      <View style={styles.shortcutMark}>
        <Icon name={icon} size={18} color={Colors.red} />
      </View>
      <AppText style={styles.shortcutLabel}>{label}</AppText>
      <Icon name="chevronRight" size={18} color={Colors.ink} />
    </Pressable>
  );
}

/** Ação principal do perfil próprio, no desenho aprovado: papel, fio de 2 e raio 6. */
export function ProfileEditButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Editar perfil"
      onPress={onPress}
      style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}>
      <Icon name="edit" size={18} color={Colors.ink} />
      <AppText style={styles.editButtonLabel}>Editar perfil</AppText>
    </Pressable>
  );
}

/** Faixa escura de criadora com o nome do podcast (2j). */
export function Masthead({ creator }: { creator: CreatorInfo }) {
  return (
    <View style={styles.masthead} accessible accessibilityLabel={`${creator.mastheadTitle}. ${creator.mastheadKicker}`}>
      <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
        {creator.mastheadKicker}
      </AppText>
      <AppText style={styles.mastTitle} color={Colors.cream} maxFontSizeMultiplier={1.1}>
        {creator.mastheadTitle}
      </AppText>
      <View style={styles.mastFoot}>
        <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
          {creator.mastheadLeft}
        </AppText>
        <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
          {creator.mastheadRight}
        </AppText>
      </View>
    </View>
  );
}

const TIERS = [
  { value: 'R$ 5', label: 'Ouvinte' },
  { value: 'R$ 15', label: 'Apoiadora' },
  { value: 'R$ 30', label: 'Coletivo' },
];

/** Apresentação do apoio coletivo. Ainda não existe: nada aqui aceita pagamento. */
export function CollectiveSupport({ creatorName }: { creatorName: string }) {
  return (
    <View style={styles.support}>
      <View style={styles.supportHead}>
        <AppText style={styles.supportTitle}>Apoio coletivo</AppText>
        <View style={styles.soonTag}>
          <AppText style={styles.soonText}>Em breve</AppText>
        </View>
      </View>
      <AppText style={styles.supportText} color={Colors.inkSoft}>
        Em breve será possível apoiar o {creatorName} com contribuições mensais. Quem apoia vê para onde vai cada real.
      </AppText>
      <View style={styles.tiers}>
        {TIERS.map((t) => (
          <View key={t.label} style={styles.tier}>
            <AppText style={styles.tierValue} color={Colors.inkSoft}>
              {t.value}
            </AppText>
            <AppText style={styles.tierLabel} color={Colors.muted}>
              {t.label} · por mês
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Selo de papel na lista de comunas do perfil. */
export function RoleTag({ label }: { label: string }) {
  return (
    <View style={styles.soonTag}>
      <AppText style={styles.soonText}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  barHandle: {
    fontSize: 12.5,
    lineHeight: 18,
    letterSpacing: 0.4,
    textTransform: 'none',
  },
  barActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -Spacing.one,
  },
  masthead: {
    backgroundColor: Colors.ink,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    paddingBottom: 14,
    borderBottomWidth: 5,
    borderBottomColor: Colors.red,
  },
  mastKicker: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mastTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 64,
    lineHeight: 72,
    textTransform: 'uppercase',
    marginTop: 6,
    paddingTop: 4,
  },
  mastFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two + 2,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.inkRule,
  },
  shortcut: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shortcutPressed: {
    backgroundColor: Colors.strawLight,
  },
  shortcutMark: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.strawLight,
  },
  shortcutLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 18,
  },
  editButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 6,
    backgroundColor: Colors.paper,
  },
  editButtonPressed: { backgroundColor: Colors.strawLight },
  editButtonLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 18,
  },
  support: {
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    padding: Spacing.four,
    gap: Spacing.three,
    backgroundColor: Colors.paper,
  },
  supportHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  supportTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 24,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  supportText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  tiers: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tier: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.rule,
    padding: Spacing.two + 2,
  },
  tierValue: {
    fontFamily: Fonts.condensed,
    fontSize: 24,
    lineHeight: 32,
  },
  tierLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  soonTag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.straw,
  },
  soonText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
