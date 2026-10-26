import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';

type BadgeProps = {
  label: string;
  tone?: 'ink' | 'red';
};

/** Selo editorial em caixa-alta: "Criadora", "Moderação", "Autora". */
export function Badge({ label, tone = 'ink' }: BadgeProps) {
  return (
    <View style={[styles.box, { backgroundColor: tone === 'red' ? Colors.red : Colors.ink }]}>
      <AppText style={styles.text} color={tone === 'red' ? Colors.paper : Colors.cream} maxFontSizeMultiplier={1.3}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  text: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
