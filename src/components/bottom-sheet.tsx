import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Título grande; omitido quando o conteúdo traz o próprio cabeçalho. */
  title?: string;
  children: ReactNode;
  /** Listas virtualizadas já controlam a própria rolagem. */
  scrollable?: boolean;
};

/** Folha que sobe de baixo, com fundo escurecido. Tocar fora ou voltar fecha. */
export function BottomSheet({ visible, onClose, title, children, scrollable = true }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.four) + Spacing.four }]}
          accessibilityViewIsModal>
          <View style={styles.handle} />
          {title ? (
            <AppText style={styles.title} accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {scrollable ? <ScrollView bounces={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {children}
          </ScrollView> : children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(22,18,15,0.55)',
  },
  sheet: {
    flexShrink: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    maxHeight: '86%',
    alignSelf: 'center',
    backgroundColor: Colors.paper,
    // A folha mantém a leitura de painel, mas acompanha a linguagem mais reta do app.
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 10,
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.strawDark,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 32,
    lineHeight: 40,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
});
