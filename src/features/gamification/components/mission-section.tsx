import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Radius } from '@/constants/theme';

import type { GamificationMission } from '../types';

/** Missões do dia: caixa de seleção, FEITO no concluído e o placar no cabeçalho. */
export function MissionSection({ missions }: { missions: GamificationMission[] }) {
  const done = missions.filter((mission) => mission.completed).length;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Kicker label="Missões de hoje" textStyle={styles.kicker} />
        <AppText style={styles.fraction} color={Colors.red}>{done}/{missions.length}</AppText>
      </View>
      {missions.length === 0 ? (
        <AppText variant="caption">Nada disponível para hoje.</AppText>
      ) : (
        <View style={styles.card}>
          {missions.map((mission, index) => (
            <View key={mission.action} style={[styles.row, index > 0 && styles.divider]}>
              <View style={[styles.check, mission.completed && styles.checkOn]}>
                {mission.completed ? <Icon name="check" size={15} color={Colors.cream} /> : null}
              </View>
              <AppText style={[styles.label, mission.completed && styles.labelDone]}>
                {mission.label}
              </AppText>
              {mission.completed ? <AppText style={styles.done}>Feito</AppText> : null}
            </View>
          ))}
        </View>
      )}
      <AppText style={styles.note}>Novas missões à meia-noite.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    paddingTop: 30,
    paddingHorizontal: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.44,
  },
  fraction: {
    fontFamily: Fonts.anton,
    fontSize: 24,
    lineHeight: 24,
  },
  card: {
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    borderTopWidth: 2,
    borderTopColor: Colors.ink,
    borderStyle: 'dashed',
  },
  check: {
    width: 24,
    height: 24,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  checkOn: {
    backgroundColor: Colors.ink,
  },
  label: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.ink,
  },
  labelDone: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  done: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  note: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
  },
});
