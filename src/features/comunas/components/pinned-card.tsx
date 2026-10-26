import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

/** Publicação fixada no topo da comuna, com etiqueta "FIXADO" inclinada. */
export function PinnedCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`Fixado: ${title}. ${text}`}>
      <View style={styles.tag}>
        <AppText style={styles.tagText} color={Colors.paper} maxFontSizeMultiplier={1.2}>
          FIXADO
        </AppText>
      </View>
      <AppText variant="heading" color={Colors.cream} style={styles.title}>
        {title}
      </AppText>
      <AppText style={styles.text} color="#D9CEBF">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.five,
    marginVertical: Spacing.four,
    backgroundColor: Colors.ink,
    borderRadius: Radius.xl,
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  tag: {
    position: 'absolute',
    top: -9,
    left: 14,
    transform: [{ rotate: '-3deg' }],
    backgroundColor: Colors.red,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
  },
  title: {
    fontSize: 23,
    lineHeight: 24,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
});
