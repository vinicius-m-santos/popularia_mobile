import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

import { AchievementSection } from './components/achievement-section';
import { LevelCard } from './components/level-card';
import { MissionSection } from './components/mission-section';
import { ProgressHeader } from './components/progress-header';
import { StreakSection } from './components/streak-section';
import { ProgressHelpSheet } from './help-sheet';
import { levelFraction, streakLabel, type GamificationMission, type GamificationState } from './types';
import { useGamification } from './use-gamification';

/** O servidor oferece até três missões por dia; o slot reserva esse máximo. */
const HOME_PROGRESS_MISSION_ROWS = 3;
const HOME_PROGRESS_BORDER = 2;
const HOME_PROGRESS_HEAD_LINE_HEIGHT = 30;
const HOME_PROGRESS_ROW_LINE_HEIGHT = 23;
const HOME_PROGRESS_HEAD_HEIGHT = HOME_PROGRESS_HEAD_LINE_HEIGHT + Spacing.two * 2 + HOME_PROGRESS_BORDER;
const HOME_PROGRESS_ROW_HEIGHT = HOME_PROGRESS_ROW_LINE_HEIGHT + Spacing.two * 2 + HOME_PROGRESS_BORDER;

/**
 * Altura do bloco de progresso no feed. Skeleton e cartão usam as mesmas medidas;
 * o piso de três missões evita que a chegada da gamificação empurre a lista.
 * Fontes ampliadas continuam crescendo o conteúdo em vez de serem cortadas.
 */
export const HOME_PROGRESS_SLOT_MIN_HEIGHT =
  HOME_PROGRESS_BORDER * 2 + HOME_PROGRESS_HEAD_HEIGHT + HOME_PROGRESS_ROW_HEIGHT * HOME_PROGRESS_MISSION_ROWS;

export function ProgressBody({ state }: { state: GamificationState }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.level}>
        <LevelCard state={state} />
      </View>
      <StreakSection state={state} />
      <MissionSection missions={state.missions} />
      <AchievementSection achievements={state.achievements} />
    </ScrollView>
  );
}

export default function ProgressScreen() {
  const progress = useGamification();
  const [helpVisible, setHelpVisible] = useState(false);

  return (
    <Screen>
      <ProgressHeader onHelp={() => setHelpVisible(true)} />
      {progress.isPending ? (
        <StateView kind="loading" message="Abrindo seu progresso" />
      ) : progress.isError || !progress.data ? (
        <StateView kind="error" message="Não foi possível abrir seu progresso." onRetry={() => { void progress.refetch(); }} />
      ) : (
        <ProgressBody state={progress.data} />
      )}
      <ProgressHelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
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
        testID="home-progress-card"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint="Abre o progresso"
        accessibilityLabel={`${streakLabel(state.streak)}, ${done} de ${total} ${total === 1 ? 'missão' : 'missões'} hoje. Ver progresso`}
        style={({ pressed }) => [styles.progressCard, pressed && styles.pressed]}>
        <View style={styles.progressHead}>
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

/** Mesmas medidas do cartão, sem texto: ocupa o slot desde o primeiro frame. */
function HomeProgressSkeleton() {
  return (
    <View
      testID="home-progress-skeleton"
      accessible
      accessibilityLabel="Carregando progresso"
      accessibilityState={{ busy: true }}
      style={styles.progressShadow}>
      <View style={styles.progressCard} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.progressHead}>
          <View style={[styles.skeletonBar, styles.skeletonStreak]} />
          <View style={[styles.skeletonBar, styles.skeletonFraction]} />
        </View>
        {Array.from({ length: HOME_PROGRESS_MISSION_ROWS }, (_, index) => (
          <View
            key={index}
            testID="home-progress-skeleton-row"
            style={[styles.missionRow, index < HOME_PROGRESS_MISSION_ROWS - 1 && styles.missionRowDivider]}>
            <View style={[styles.missionCheck, styles.skeletonCheck]} />
            <View style={[styles.skeletonBar, styles.skeletonMission]} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function HomeProgress() {
  const progress = useGamification();
  if (progress.isError && !progress.data) {
    return (
      <Pressable onPress={() => { void progress.refetch(); }} accessibilityRole="button" style={styles.error}>
        <AppText variant="caption">Progresso indisponível. Toque para tentar de novo.</AppText>
      </Pressable>
    );
  }

  return (
    <View testID="home-progress-slot" style={styles.progressSlot}>
      {progress.data
        ? <HomeProgressCard state={progress.data} onPress={() => router.push('/progresso')} />
        : <HomeProgressSkeleton />}
    </View>
  );
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
    paddingBottom: Spacing.six,
  },
  level: {
    paddingTop: 22,
    paddingHorizontal: 16,
  },
  // No feed, a sequência e as missões do dia viram um cartão de status, como no mock.
  progressSlot: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.four,
    minHeight: HOME_PROGRESS_SLOT_MIN_HEIGHT,
  },
  progressShadow: {
    borderRadius: Radius.md,
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  progressCard: {
    borderWidth: HOME_PROGRESS_BORDER,
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
    borderBottomWidth: HOME_PROGRESS_BORDER,
    borderBottomColor: Colors.ink,
  },
  progressStreak: {
    flex: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressFraction: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: HOME_PROGRESS_HEAD_LINE_HEIGHT,
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
    borderBottomWidth: HOME_PROGRESS_BORDER,
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
  skeletonBar: {
    borderRadius: 2,
    backgroundColor: Colors.straw,
  },
  skeletonStreak: {
    flex: 1,
    height: 14,
  },
  skeletonFraction: {
    width: 42,
    height: HOME_PROGRESS_HEAD_LINE_HEIGHT,
  },
  skeletonMission: {
    flex: 1,
    height: HOME_PROGRESS_ROW_LINE_HEIGHT,
  },
  skeletonCheck: {
    borderColor: Colors.strawDark,
    backgroundColor: Colors.strawLight,
  },
  missionLabel: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: HOME_PROGRESS_ROW_LINE_HEIGHT,
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
