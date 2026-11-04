import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Modal, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Spacing } from '@/constants/theme';

/** Cobre a árvore durante login, cadastro ou saída: nenhum toque ou gesto navega no meio. */
export function AuthBusyOverlay({ label }: { label: string }) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityLabel={label}>
        <ActivityIndicator size="large" color={Colors.red} />
        <AppText variant="bodyStrong" style={styles.label}>{label}</AppText>
      </View>
    </Modal>
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
