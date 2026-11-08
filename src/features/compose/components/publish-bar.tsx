import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Shadows, Spacing } from '@/constants/theme';
import type { useActionFeedback } from '@/hooks/use-action-feedback';

export type ComposerMode = 'write' | 'call' | 'poll';

/** Barra fixa de publicar com confirmação curta e estado acessível. */
export function PublishBar({ mode, published, publishing, disabled, label, subtitle, paddingBottom, feedbackStyle, onPress }: {
  mode: ComposerMode;
  published: boolean;
  publishing: boolean;
  disabled: boolean;
  label: string;
  subtitle: string;
  paddingBottom: number;
  feedbackStyle: ReturnType<typeof useActionFeedback>['style'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={published ? `Publicado ${subtitle}` : publishing ? 'Publicando' : label}
      accessibilityState={{ disabled, busy: publishing }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.publishBar, { paddingBottom }, disabled && !published && styles.publishBarDisabled, pressed && styles.pressed]}>
      <View style={styles.publishCopy}>
        <AppText style={styles.publishTitle}>{published ? 'Publicado' : publishing ? 'Publicando…' : label}</AppText>
        <AppText style={styles.publishSubtitle}>{subtitle}</AppText>
      </View>
      <Animated.View style={[styles.publishButton, feedbackStyle, published && styles.publishButtonConfirmed]}>
        {published ? (
          <Icon name="check" size={26} color={Colors.paper} />
        ) : publishing ? (
          <ActivityIndicator color={Colors.ink} />
        ) : (
          <Icon name={mode === 'call' ? 'megaphone' : 'arrowRight'} size={26} color={Colors.ink} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  publishBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: 2, borderTopColor: Colors.ink, backgroundColor: Colors.red, paddingHorizontal: Spacing.five, paddingTop: Spacing.three },
  publishBarDisabled: { opacity: 0.55 },
  publishCopy: { flex: 1, minWidth: 0, gap: 1 },
  publishTitle: { fontFamily: Fonts.anton, fontSize: 31, lineHeight: 39, letterSpacing: 0.2, textTransform: 'uppercase', color: Colors.paper },
  publishSubtitle: { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 21, color: Colors.cream },
  publishButton: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper, ...Shadows.offsetSmall },
  publishButtonConfirmed: { backgroundColor: Colors.ink },
  pressed: { opacity: 0.68 },
});
