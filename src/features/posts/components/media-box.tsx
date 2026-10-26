import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { PostMedia } from '@/types/models';

/** Episódio de áudio anexado. O player real fica para uma próxima etapa. */
export function MediaBox({ media }: { media: PostMedia }) {
  return (
    <View style={styles.box} accessible accessibilityLabel={`Episódio: ${media.title}. ${media.meta}`}>
      <View style={styles.play}>
        <Icon name="play" size={20} color={Colors.paper} />
      </View>
      <View style={styles.text}>
        <AppText style={styles.meta} color="#C9BCAA">
          {media.meta}
        </AppText>
        <AppText variant="heading" color={Colors.cream} style={styles.title}>
          {media.title}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.ink,
  },
  play: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  meta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 23,
    lineHeight: 24,
  },
});
