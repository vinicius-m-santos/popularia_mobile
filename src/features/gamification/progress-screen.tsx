import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';

import { levelFraction, streakLabel, type GamificationState } from './types';
import { useGamification } from './use-gamification';

export function ProgressBody({ state }: { state: GamificationState }) {
  const into = state.xp - state.currentLevelXp;
  const span = state.nextLevelXp - state.currentLevelXp;
  const fraction = levelFraction(state);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.block}>
        <AppText variant="label">Nível {state.level}</AppText>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: span, now: into }}>
          <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
        <AppText variant="caption">{into} de {span} para o próximo nível</AppText>
        <AppText variant="caption">{state.xp} no total</AppText>
      </View>
      <View style={styles.block}>
        <AppText variant="label">{streakLabel(state.streak)}</AppText>
        <AppText variant="caption">Dias seguidos com uma participação. Abrir o app não conta.</AppText>
        <AppText variant="caption">O dia vira à meia-noite no horário de Brasília, para todas as pessoas.</AppText>
      </View>
      <View style={styles.block}>
        <AppText variant="label">Missões de hoje</AppText>
        {state.missions.length === 0 ? (
          <AppText variant="caption">Nada disponível para hoje.</AppText>
        ) : state.missions.map((mission) => (
          <View key={mission.action} style={styles.row}>
            <View style={[styles.mark, mission.completed && styles.markOn]} />
            <AppText style={styles.mission}>{mission.label}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.block}>
        <AppText variant="label">Conquistas</AppText>
        {state.achievements.map((achievement) => (
          <View key={achievement.code} style={styles.achievement}>
            <AppText style={styles.mission} color={achievement.unlocked ? Colors.ink : Colors.muted}>
              {achievement.title}
            </AppText>
            <AppText variant="caption">{achievement.unlocked ? achievement.detail : 'Ainda não'}</AppText>
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${streakLabel(state.streak)}. Ver progresso`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <AppText variant="label">{streakLabel(state.streak)}</AppText>
      <AppText variant="label" color={Colors.muted}>Missões de hoje</AppText>
      {state.missions.map((mission) => (
        <View key={mission.action} style={styles.row}>
          <View style={[styles.mark, mission.completed && styles.markOn]} />
          <AppText variant="caption" style={styles.mission}>{mission.label}</AppText>
        </View>
      ))}
      <AppText variant="label" color={Colors.red}>Ver progresso</AppText>
    </Pressable>
  );
}

export function HomeProgress() {
  const progress = useGamification();
  if (progress.isError) {
    return (
      <Pressable onPress={() => { void progress.refetch(); }} accessibilityRole="button" style={styles.card}>
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
      <AppText variant="label">Nível {level} · {streakLabel(streak)}</AppText>
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
  content: { paddingBottom: Spacing.eight },
  block: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.four,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.rule,
  },
  track: { height: 8, backgroundColor: Colors.straw, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: Colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 28 },
  mark: { width: 10, height: 10, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  markOn: { backgroundColor: Colors.ink },
  mission: { flex: 1 },
  achievement: { gap: 2 },
  card: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.five,
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  profile: { alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
