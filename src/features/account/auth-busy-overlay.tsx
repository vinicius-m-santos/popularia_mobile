import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Cobre a árvore durante login, cadastro ou saída.
 * É uma View absoluta, não um Modal nativo: um Modal desmontado no meio da troca
 * de sessão pode deixar uma janela transparente presa e bloquear todos os toques.
 */
export function AuthBusyOverlay({ label }: { label: string }) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={Colors.red} />
      <AppText variant="bodyStrong" style={styles.label}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.cream,
  },
  label: { textAlign: 'center' },
});
