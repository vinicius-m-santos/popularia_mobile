import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Radius } from '@/constants/theme';

import { streakWeek, todayInStreakZone } from '../dates';
import { streakLabel, type GamificationState } from '../types';

/** Sequência com a semana de segunda a domingo; o dia de hoje ganha o vermelho. */
export function StreakSection({ state }: { state: GamificationState }) {
  const week = streakWeek({
    today: todayInStreakZone(),
    streak: state.streak,
    lastActivityOn: state.lastActivityOn,
  });

  return (
    <View style={styles.section}>
      <Kicker label="Sequência" textStyle={styles.kicker} />
      <AppText style={styles.title}>{streakLabel(state.streak)}</AppText>
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {week.map((day) => (
          <View
            key={day.day}
            style={[
              styles.day,
              day.active && styles.dayActive,
              day.today && day.active && styles.dayToday,
              day.future && styles.dayFuture,
            ]}>
            <AppText style={[styles.weekday, day.active && styles.onActive]}>{day.weekday}</AppText>
            <AppText style={[styles.number, day.active && styles.onActive]}>{day.label}</AppText>
          </View>
        ))}
      </View>
      <AppText style={styles.note}>
        Conta quando você participa de verdade: posta, comenta, vota ou salva. Só abrir o app não conta. O dia vira à meia-noite, horário de Brasília.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    paddingTop: 30,
    paddingHorizontal: 16,
  },
  kicker: {
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.44,
  },
  title: {
    fontFamily: Fonts.anton,
    fontSize: 34,
    lineHeight: 42,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  week: {
    flexDirection: 'row',
    gap: 5,
  },
  day: {
    flex: 1,
    minWidth: 0,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 7,
    paddingBottom: 8,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
  dayActive: {
    backgroundColor: Colors.ink,
  },
  dayToday: {
    backgroundColor: Colors.red,
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  dayFuture: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  weekday: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 18,
    letterSpacing: 0.6,
    color: Colors.ink,
  },
  number: {
    fontFamily: Fonts.anton,
    fontSize: 20,
    lineHeight: 28,
    color: Colors.ink,
  },
  onActive: {
    color: Colors.cream,
  },
  note: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.muted,
  },
});
