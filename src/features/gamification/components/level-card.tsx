import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

import { levelFraction, type GamificationState } from '../types';

/** Divisórias de 10% do degrau, como no desenho. */
const SEGMENTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Cartão do nível: faixa preta, XP grande e degrau segmentado. */
export function LevelCard({ state }: { state: GamificationState }) {
  const into = Math.max(0, state.xp - state.currentLevelXp);
  const span = Math.max(1, state.nextLevelXp - state.currentLevelXp);
  const percent = Math.round(levelFraction(state) * 100);
  const missing = Math.max(0, span - into);

  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        <View style={styles.head}>
          <AppText style={styles.headText}>Nível {state.level}</AppText>
          <AppText style={styles.headText}>{state.xp} XP no total</AppText>
        </View>
        <View style={styles.body}>
          <View style={styles.totalRow}>
            <AppText style={styles.total} color={Colors.red}>{into}</AppText>
            <AppText style={styles.span}>/ {span} XP</AppText>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel={`${percent}% para o nível ${state.level + 1}`}
            accessibilityValue={{ min: 0, max: span, now: into }}>
            <View style={[styles.fill, { width: `${percent}%` }]} />
            {SEGMENTS.map((segment) => (
              <View key={segment} style={[styles.segment, { left: `${segment * 10}%` }]} />
            ))}
          </View>
          <AppText style={styles.missing}>
            Faltam <AppText style={styles.missingStrong}>{missing} XP</AppText> pro nível {state.level + 1}.
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: Radius.md,
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
  head: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.ink,
  },
  headText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: Colors.cream,
  },
  body: {
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  total: {
    fontFamily: Fonts.anton,
    fontSize: 64,
    lineHeight: 58,
  },
  span: {
    fontFamily: Fonts.anton,
    fontSize: 26,
    lineHeight: 26,
    color: Colors.ink,
  },
  track: {
    height: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.strawLight,
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.red,
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -2,
    backgroundColor: 'rgba(22, 18, 15, 0.35)',
  },
  missing: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.muted,
  },
  missingStrong: {
    fontFamily: Fonts.bold,
    color: Colors.ink,
  },
});
