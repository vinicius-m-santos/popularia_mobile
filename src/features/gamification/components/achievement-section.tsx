import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Radius } from '@/constants/theme';

import { achievementUnlockedLabel, todayInStreakZone } from '../dates';
import type { GamificationAchievement } from '../types';

/** Conquistas: as desbloqueadas viram selo; as bloqueadas ficam tracejadas com o critério. */
export function AchievementSection({ achievements }: { achievements: GamificationAchievement[] }) {
  const today = todayInStreakZone();
  const unlocked = achievements
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''));
  const locked = achievements.filter((achievement) => !achievement.unlocked);
  const rows: GamificationAchievement[][] = [];
  for (let index = 0; index < locked.length; index += 2) rows.push(locked.slice(index, index + 2));

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Kicker label="Conquistas" textStyle={styles.kicker} />
        <AppText style={styles.count}>{unlocked.length} de {achievements.length}</AppText>
      </View>
      <View style={styles.list}>
        {unlocked.map((achievement) => (
          <UnlockedCard key={achievement.code} achievement={achievement} today={today} />
        ))}
        {rows.map((row) => (
          <View key={row[0].code} style={styles.row}>
            {row.map((achievement) => <LockedCard key={achievement.code} achievement={achievement} />)}
            {row.length === 1 ? <View style={styles.cell} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function UnlockedCard({ achievement, today }: { achievement: GamificationAchievement; today: string }) {
  return (
    <View style={styles.shadow}>
      <View style={styles.unlocked}>
        <View style={styles.stampOuter} accessible={false} importantForAccessibility="no-hide-descendants">
          <View style={styles.stampInner}>
            <AppText style={styles.stampText}>{achievement.title.split(/\s+/).join('\n')}</AppText>
          </View>
        </View>
        <View style={styles.unlockedCopy}>
          <AppText style={styles.unlockedTitle}>{achievement.title}</AppText>
          <AppText style={styles.detail}>{achievement.detail}</AppText>
          <AppText style={styles.badge}>{achievementUnlockedLabel(achievement.unlockedAt, today)}</AppText>
        </View>
      </View>
    </View>
  );
}

function LockedCard({ achievement }: { achievement: GamificationAchievement }) {
  return (
    <View style={styles.cell}>
      <View style={styles.locked}>
        <View style={styles.lockBadge}>
          <Icon name="lock" size={16} color={Colors.ink} />
        </View>
        <AppText style={styles.lockedTitle}>{achievement.title}</AppText>
        <AppText style={styles.detail}>Como ganhar: {achievement.criterion}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    paddingTop: 30,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.44,
  },
  count: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.muted,
  },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  cell: { flex: 1, minWidth: 0 },
  shadow: {
    borderRadius: Radius.md,
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  unlocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
  stampOuter: {
    flexShrink: 0,
    padding: 3,
    borderWidth: 2,
    borderColor: Colors.red,
    borderRadius: Radius.md,
    transform: [{ rotate: '-6deg' }],
  },
  stampInner: {
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderWidth: 2,
    borderColor: Colors.red,
    borderRadius: Radius.sm,
  },
  stampText: {
    fontFamily: Fonts.anton,
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: Colors.red,
  },
  unlockedCopy: { flex: 1, minWidth: 0, gap: 3 },
  unlockedTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.ink,
  },
  detail: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.muted,
  },
  badge: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: Colors.redPressed,
  },
  locked: {
    flex: 1,
    minHeight: 140,
    gap: 8,
    padding: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    borderRadius: Radius.md,
  },
  lockBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.strawLight,
  },
  lockedTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.ink,
  },
});
