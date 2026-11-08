import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { absoluteMediaUrl } from '@/features/media/media-url';
import { initialsOf } from '@/lib/format';
import { goBack } from '@/lib/routes';
import type { AuthorDto } from '@/lib/api/dto';

import type * as api from '../api';

/** Cabeçalho escuro da Praça: voltar, comuna, presença e opções de gestão. */
export function SquareHeader({ square, people, locked, onComuna, onPresence, onManage }: {
  square: api.Square | null;
  people: AuthorDto[];
  locked: boolean;
  onComuna: () => void;
  onPresence: () => void;
  onManage: () => void;
}) {
  const presence = square?.presence ?? 0;
  const active = square?.status === 'active';
  const presenceText = locked
    ? 'Comuna privada'
    : square?.status === 'closed'
      ? 'Somente leitura · encerrada'
      : presence > 0
        ? `${presence} na praça agora`
        : 'Ninguém na praça agora';
  const stack = people.slice(0, 3);
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={goBack} style={({ pressed }) => [styles.backBox, pressed && styles.headerPressed]}>
      <Icon name="arrowLeft" color={Colors.cream} size={24} />
    </Pressable>
    <View style={styles.headerText}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ver comuna" onPress={onComuna} disabled={!square?.comuna} style={styles.titlePress}>
        <AppText style={styles.headerTitle} color={Colors.cream} numberOfLines={1}>{square?.title ?? 'Praça'}</AppText>
      </Pressable>
      <Pressable
        onPress={onPresence}
        disabled={!square?.viewer.canRead || !active}
        accessibilityRole="button"
        accessibilityLabel={`Pessoas na Praça. ${presenceText}`}
        hitSlop={{ top: 6, bottom: 6 }}
        style={styles.presence}>
        {stack.length ? <View style={styles.presenceStack}>
          {stack.map((person) => <View key={person.id} style={styles.presenceAvatar}>
            <Avatar initials={initialsOf(person.displayName)} tone="cream" size={18} shape="square" userId={person.id} imageUrl={absoluteMediaUrl(person.avatarUrl)} />
          </View>)}
        </View> : null}
        <AppText style={styles.presenceText} color={Colors.onInkMuted} numberOfLines={1}>{presenceText}</AppText>
      </Pressable>
    </View>
    {square?.viewer.canRead ? <Pressable accessibilityRole="button" accessibilityLabel="Opções da Praça" onPress={onManage} style={({ pressed }) => [styles.moreButton, pressed && styles.headerPressed]}>
      <Icon name="more" color={Colors.cream} size={24} />
    </Pressable> : <View style={styles.headerSpacer} />}
  </View>;
}

/** Régua de dia da conversa invertida. */
export function ChatDayRule({ label }: { label: string }) {
  return <View style={styles.dayRule} accessibilityRole="header">
    <View style={styles.dayRuleLine} />
    <AppText variant="label" color={Colors.muted} style={styles.dayRuleLabel}>{label}</AppText>
    <View style={styles.dayRuleLine} />
  </View>;
}

const styles = StyleSheet.create({
  header: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inkRule,
  },
  backBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.cream,
    borderRadius: Radius.sm,
  },
  moreButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPressed: {
    opacity: 0.65,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titlePress: {
    minHeight: 22,
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  presence: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presenceStack: {
    flexDirection: 'row',
    paddingRight: 2,
  },
  presenceAvatar: {
    marginRight: -4,
  },
  presenceText: {
    flexShrink: 1,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  headerSpacer: { width: 44 },
  dayRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  dayRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.strawDark,
  },
  dayRuleLabel: {
    letterSpacing: 1.4,
  },
});
