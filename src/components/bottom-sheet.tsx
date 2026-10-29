import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GorhomBottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

export { BottomSheetFlatList as PopulariaBottomSheetFlatList, BottomSheetScrollView as PopulariaBottomSheetScrollView, BottomSheetTextInput as PopulariaBottomSheetTextInput } from '@gorhom/bottom-sheet';
export const InsideBottomSheet = createContext(false);

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  scrollable?: boolean;
  /** Conteúdo com BottomSheetFlatList: não envolver em outro scrollable. */
  virtualized?: boolean;
  dismissible?: boolean;
};

/** Aparência Popularia, física e arbitragem entre scroll/teclado delegadas ao Gorhom. */
export function BottomSheet({ visible, onClose, title, children, scrollable = true, virtualized = false, dismissible = true }: BottomSheetProps) {
  const sheet = useRef<GorhomBottomSheet>(null);
  const [mounted, setMounted] = useState(visible);
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const close = useCallback(() => { if (dismissible) sheet.current?.close(); }, [dismissible]);
  useEffect(() => {
    if (visible) {
      // Mantém o Modal nativo montado até a animação de saída do Gorhom terminar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      sheet.current?.snapToIndex(0);
    } else sheet.current?.close();
  }, [visible]);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55}
    pressBehavior={dismissible ? 'close' : 'none'} accessibilityRole="button" accessibilityLabel="Fechar" accessibilityHint="Fecha esta folha" />,
  [dismissible]);
  const handle = useCallback(() => <View style={styles.dragHeader} testID="bottom-sheet-drag-header"
    accessible accessibilityRole="adjustable" accessibilityLabel={title ?? 'Opções'} accessibilityHint="Arraste para baixo para fechar"
    accessibilityActions={[{ name: 'escape', label: 'Fechar' }, { name: 'decrement', label: 'Fechar' }]}
    onAccessibilityAction={close} onAccessibilityEscape={close}>
    <View style={styles.handle} />
    {title ? <AppText style={styles.title} accessibilityRole="header">{title}</AppText> : null}
  </View>, [title, close]);
  const paddingBottom = Math.max(insets.bottom, Spacing.four) + Spacing.four;
  if (!mounted) return null;
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
    <GestureHandlerRootView style={styles.overlay}>
    <GorhomBottomSheet ref={sheet}
    onClose={() => { Keyboard.dismiss(); setMounted(false); if (visible) onClose(); }}
    enablePanDownToClose={dismissible}
    enableHandlePanningGesture={dismissible}
    enableContentPanningGesture={dismissible}
    enableDynamicSizing={!virtualized}
    snapPoints={virtualized ? ['86%'] : undefined}
    maxDynamicContentSize={height * 0.86}
    topInset={insets.top}
    keyboardBehavior="interactive" keyboardBlurBehavior="restore"
    enableBlurKeyboardOnGesture android_keyboardInputMode="adjustResize"
    backdropComponent={backdrop} handleComponent={handle}
    backgroundStyle={styles.background}
    style={{ marginHorizontal: Math.max(0, (width - MaxContentWidth) / 2) }}>
    <InsideBottomSheet.Provider value>
      {virtualized ? <View style={[styles.list, { paddingBottom }]}>{children}</View>
        : scrollable ? <BottomSheetScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom }]}>{children}</BottomSheetScrollView>
          : <BottomSheetView style={[styles.content, { paddingBottom }]}>{children}</BottomSheetView>}
    </InsideBottomSheet.Provider>
  </GorhomBottomSheet>
    </GestureHandlerRootView>
  </Modal>;
}

export const PopulariaBottomSheet = BottomSheet;
const styles = StyleSheet.create({
  overlay: { flex: 1 },
  background: { backgroundColor: Colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  content: { paddingHorizontal: Spacing.five },
  list: { flex: 1, paddingHorizontal: Spacing.five },
  dragHeader: { minHeight: 48, paddingTop: 10, paddingBottom: Spacing.three, paddingHorizontal: Spacing.five, gap: Spacing.three },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.strawDark },
  title: { fontFamily: Fonts.condensed, fontSize: 32, lineHeight: 40, textTransform: 'uppercase', color: Colors.ink },
});
