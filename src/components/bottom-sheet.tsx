import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Título grande; omitido quando o conteúdo traz o próprio cabeçalho. */
  title?: string;
  children: ReactNode;
  /** Listas virtualizadas já controlam a própria rolagem. */
  scrollable?: boolean;
};

/** Folha que sobe de baixo, com fundo escurecido. Tocar fora, voltar ou arrastar o cabeçalho para baixo fecha. */
export function BottomSheet({ visible, onClose, title, children, scrollable = true }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const [translateY] = useState(() => new Animated.Value(0));
  useEffect(() => { if (visible) translateY.setValue(0); }, [translateY, visible]);
  const settle = useCallback((close: boolean) => {
    if (close) {
      Animated.timing(translateY, { toValue: 1000, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onClose();
      });
      return;
    }
    Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 240, mass: 0.8, useNativeDriver: true }).start();
  }, [onClose, translateY]);
  const panResponder = useMemo(() => PanResponder.create({
    // O cabeçalho assume o toque desde o início. Sem isso, o Text do título pode
    // manter o responder e o arraste só funciona quando começa no puxador.
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => settle(gesture.dy > 80 || gesture.vy > 0.8),
    onPanResponderTerminate: () => settle(false),
  }), [settle, translateY]);
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
        <Animated.View
          style={[styles.sheet, { paddingBottom: keyboardVisible ? Spacing.four : Math.max(insets.bottom, Spacing.four) + Spacing.four }, { transform: [{ translateY }] }]}
          accessibilityViewIsModal>
          <View style={styles.dragHeader} testID="bottom-sheet-drag-header" {...panResponder.panHandlers}>
            <View style={styles.handle} />
            {title ? (
              <AppText style={styles.title} accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
          </View>
          {scrollable ? <ScrollView bounces={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {children}
          </ScrollView> : children}
        </Animated.View>
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
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
  dragHeader: {
    gap: Spacing.three,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 32,
    lineHeight: 40,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
});
