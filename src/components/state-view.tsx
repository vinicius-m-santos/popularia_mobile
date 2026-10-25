import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, MinTouchTarget, Radius, Spacing } from '@/constants/theme';

type StateViewProps =
  | { kind: 'loading'; message?: string }
  | { kind: 'empty'; title: string; message?: string }
  | { kind: 'error'; title?: string; message?: string; onRetry?: () => void };

/** Estados de carregamento, vazio e erro com o mesmo visual em todas as telas. */
export function StateView(props: StateViewProps) {
  if (props.kind === 'loading') {
    return (
      <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={props.message ?? 'Carregando'}>
        <ActivityIndicator color={Colors.red} size="large" />
        {props.message ? <AppText variant="caption">{props.message}</AppText> : null}
      </View>
    );
  }

  const title = props.kind === 'error' ? (props.title ?? 'Algo deu errado') : props.title;

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <AppText variant="heading" accessibilityRole="header" style={styles.center}>
        {title}
      </AppText>
      {props.message ? (
        <AppText variant="caption" style={styles.center}>
          {props.message}
        </AppText>
      ) : null}
      {props.kind === 'error' && props.onRetry ? (
        <Pressable
          onPress={props.onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <AppText variant="button" color={Colors.cream}>
            Tentar de novo
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.six,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.six,
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
