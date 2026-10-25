import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ComingSoon } from '@/components/coming-soon';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { MinTouchTarget, Spacing } from '@/constants/theme';

/** Rota modal aberta pelo botão "Criar" da barra inferior. */
export default function CreatePostScreen() {
  return (
    <Screen title="Nova publicação" edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.closeRow}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          hitSlop={8}
          style={styles.close}>
          <Icon name="close" />
        </Pressable>
      </View>
      <ComingSoon designRef="2f" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  closeRow: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
  },
  close: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
