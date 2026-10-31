import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';

import { levelFraction, streakLabel, type GamificationState } from './types';
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

export function HomeProgressCard({ state, onPress }: { state: GamificationState; onPress: () => void }) {
  const done = state.missions.filter((mission) => mission.completed).length;
  const total = state.missions.length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${streakLabel(state.streak)}, ${done} de ${total} ${total === 1 ? 'missão' : 'missões'} hoje. Ver progresso`}
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}>
      <View style={styles.stripRow}>
        <AppText variant="label">{streakLabel(state.streak)}</AppText>
        <AppText variant="button">Ver progresso</AppText>
      </View>
      <View style={styles.stripStatus}>
        <View style={styles.stripMarks}>
          {state.missions.map((mission) => (
            <View key={mission.action} style={[styles.stripMark, mission.completed && styles.stripMarkOn]} />
          ))}
        </View>
        <AppText variant="caption">{done} de {total} {total === 1 ? 'missão' : 'missões'} hoje</AppText>
      </View>
    </Pressable>
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

export function ProfileProgressLink({ level, streak, onPress }: { level: number; streak: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Nível ${level}, ${streakLabel(streak)}. Ver progresso`}
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}>
      <View style={styles.profileCopy}>
        <AppText variant="label">Nível {level} · {streakLabel(streak)}</AppText>
        <AppText variant="caption">Ver progresso</AppText>
      </View>
      <Icon name="chevronRight" size={18} color={Colors.muted} />
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
  // No feed, o progresso é uma faixa de status: sequência, missões e atalho, sem checklist.
  strip: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.five,
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  stripRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  stripStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stripMarks: { flexDirection: 'row', gap: Spacing.one },
  stripMark: { width: 8, height: 8, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: 'transparent' },
  stripMarkOn: { backgroundColor: Colors.ink },
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  profileCopy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
