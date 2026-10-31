import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';

/** Abre o dia na edição: etiqueta de tinta e fio cheio, como no desenho do feed. */
export function DayRule({ label }: { label: string }) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={styles.chip}>
        <AppText style={styles.label} color={Colors.cream}>{label}</AppText>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 26,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: Colors.ink,
  },
  label: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.ink,
  },
});
