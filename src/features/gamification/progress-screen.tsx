import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';

import { levelFraction, streakLabel, type GamificationMission, type GamificationState } from './types';
import { useGamification } from './use-gamification';

export function ProgressBody({ state }: { state: GamificationState }) {
  const into = state.xp - state.currentLevelXp;
  const span = state.nextLevelXp - state.currentLevelXp;
  const fraction = levelFraction(state);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <AppText variant="label">Nível {state.level}</AppText>
            <AppText variant="caption">{state.xp} XP no total</AppText>
          </View>
          <AppText style={styles.heroPercent}>{Math.round(fraction * 100)}%</AppText>
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: span, now: into }}>
          <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
        <AppText variant="caption">{into} de {span} para o próximo nível</AppText>
      </View>

      <View style={styles.block}>
        <SectionHeading appearance="editorial" label="Sequência" />
        <AppText style={styles.blockTitle}>{streakLabel(state.streak)}</AppText>
        <AppText variant="caption">Dias seguidos com uma participação. Abrir o app não conta.</AppText>
        <AppText variant="caption">O dia vira à meia-noite no horário de Brasília, para todas as pessoas.</AppText>
      </View>

      <View style={styles.block}>
        <SectionHeading appearance="editorial" label="Missões de hoje" />
        {state.missions.length === 0 ? (
          <AppText variant="caption">Nada disponível para hoje.</AppText>
        ) : state.missions.map((mission) => (
          <View key={mission.action} style={styles.row}>
            <View style={[styles.mark, mission.completed && styles.markOn]}>
              {mission.completed ? <Icon name="check" size={11} color={Colors.cream} /> : null}
            </View>
            <AppText style={styles.mission}>{mission.label}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.block}>
        <SectionHeading appearance="editorial" label="Conquistas" />
        {state.achievements.map((achievement) => (
          <View key={achievement.code} style={styles.achievement}>
            <View style={[styles.achievementMark, achievement.unlocked && styles.achievementMarkOn]} />
            <View style={styles.achievementCopy}>
              <AppText style={styles.mission} color={achievement.unlocked ? Colors.ink : Colors.muted}>
                {achievement.title}
              </AppText>
              <AppText variant="caption">{achievement.unlocked ? achievement.detail : 'Ainda não'}</AppText>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function ProgressScreen() {
  const progress = useGamification();
  if (progress.isPending) {
    return <Screen><EventBar title="Progresso" /><StateView kind="loading" message="Abrindo seu progresso" /></Screen>;
  }
  if (progress.isError || !progress.data) {
    return (
      <Screen>
        <EventBar title="Progresso" />
        <StateView kind="error" message="Não foi possível abrir seu progresso." onRetry={() => { void progress.refetch(); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <EventBar title="Progresso" />
      <ProgressBody state={progress.data} />
    </Screen>
  );
}

function MissionRow({ mission, divider }: { mission: GamificationMission; divider: boolean }) {
  return (
    <View style={[styles.missionRow, divider && styles.missionRowDivider]}>
      <View style={[styles.missionCheck, mission.completed && styles.missionCheckOn]}>
        {mission.completed ? <Icon name="check" size={12} color={Colors.cream} /> : null}
      </View>
      <AppText style={[styles.missionLabel, mission.completed && styles.missionLabelDone]}>
        {mission.label}
      </AppText>
    </View>
  );
}

export function HomeProgressCard({ state, onPress }: { state: GamificationState; onPress: () => void }) {
  const done = state.missions.filter((mission) => mission.completed).length;
  const total = state.missions.length;
  return (
    <View style={styles.progressShadow}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint="Abre o progresso"
        accessibilityLabel={`${streakLabel(state.streak)}, ${done} de ${total} ${total === 1 ? 'missão' : 'missões'} hoje. Ver progresso`}
        style={({ pressed }) => [styles.progressCard, pressed && styles.pressed]}>
        <View style={styles.progressHead}>
          <View style={styles.progressMark} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={styles.progressSlash} />
            <View style={styles.progressSlash} />
          </View>
          <AppText style={styles.progressStreak}>{streakLabel(state.streak)}</AppText>
          <AppText style={styles.progressFraction} color={Colors.red}>{done}/{total}</AppText>
        </View>
        {state.missions.map((mission, index) => (
          <MissionRow key={mission.action} mission={mission} divider={index < state.missions.length - 1} />
        ))}
      </Pressable>
    </View>
  );
}

export function HomeProgress() {
  const progress = useGamification();
  if (progress.isError) {
    return (
      <Pressable onPress={() => { void progress.refetch(); }} accessibilityRole="button" style={styles.error}>
        <AppText variant="caption">Progresso indisponível. Toque para tentar de novo.</AppText>
      </Pressable>
    );
  }
  if (!progress.data) return null;

  return <HomeProgressCard state={progress.data} onPress={() => router.push('/progresso')} />;
}

export function ProfileProgressLink({ level, streak, fraction, onPress }: { level: number; streak: number; fraction: number; onPress: () => void }) {
  const percent = Math.max(4, Math.min(100, Math.round(fraction * 100)));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Nível ${level}, ${streakLabel(streak)}, ${percent}% para o próximo nível. Ver progresso`}
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}>
      <View style={styles.profileCopy}>
        <AppText variant="label" style={styles.profileLabel}>Nível {level} · {streakLabel(streak)}</AppText>
        <View style={styles.profileTrack}>
          <View style={[styles.profileFill, { width: `${percent}%` }]} />
        </View>
      </View>
      <Icon name="chevronRight" size={18} color={Colors.ink} />
    </Pressable>
  );
}

export function ProfileProgress() {
  const progress = useGamification();
  if (!progress.data) return null;

  return (
    <ProfileProgressLink
      level={progress.data.level}
      streak={progress.data.streak}
      fraction={levelFraction(progress.data)}
      onPress={() => router.push('/progresso')}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.eight,
  },
  hero: {
    gap: Spacing.three,
    marginHorizontal: Spacing.five,
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  heroCopy: { gap: Spacing.one },
  heroPercent: {
    fontFamily: Fonts.anton,
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -0.6,
    color: Colors.ink,
  },
  block: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  blockTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
  },
  track: { height: 8, backgroundColor: Colors.straw, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: Colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, minHeight: 36 },
  mark: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: Colors.ink },
  mission: { flex: 1 },
  achievement: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  achievementMark: {
    width: 8,
    height: 8,
    marginTop: 7,
    backgroundColor: Colors.rule,
  },
  achievementMarkOn: { backgroundColor: Colors.red },
  achievementCopy: { flex: 1, gap: 2 },
  // No feed, a sequência e as missões do dia viram um cartão de status, como no mock.
  progressShadow: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.four,
    borderRadius: Radius.md,
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  progressCard: {
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  progressHead: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
  },
  progressMark: {
    width: 18,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  progressSlash: {
    width: 4,
    height: 17,
    backgroundColor: Colors.ink,
    transform: [{ rotate: '15deg' }],
  },
  progressStreak: {
    flex: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressFraction: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: 24,
  },
  missionRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  missionRowDivider: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
    borderStyle: 'dashed',
  },
  missionCheck: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionCheckOn: {
    backgroundColor: Colors.ink,
  },
  missionLabel: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  missionLabelDone: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  error: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.five,
    padding: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  profile: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 6,
    backgroundColor: Colors.paper,
  },
  profileCopy: { flex: 1, minWidth: 0, gap: 6 },
  profileLabel: { fontSize: 12, lineHeight: 15, letterSpacing: 0.96 },
  profileTrack: {
    height: 8,
    borderRadius: 3,
    backgroundColor: Colors.strawLight,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  profileFill: { height: 4, backgroundColor: Colors.red },
  pressed: { opacity: 0.7 },
});
