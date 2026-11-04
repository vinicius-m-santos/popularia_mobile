import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GorhomBottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export { BottomSheetFlatList as PopulariaBottomSheetFlatList, BottomSheetScrollView as PopulariaBottomSheetScrollView, BottomSheetTextInput as PopulariaBottomSheetTextInput } from '@gorhom/bottom-sheet';
export const InsideBottomSheet = createContext(false);

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Nome acessível da folha quando não há título visual, como na confirmação da denúncia. */
  accessibilityLabel?: string;
  children: ReactNode;
  scrollable?: boolean;
  /** Conteúdo com BottomSheetFlatList: não envolver em outro scrollable. */
  virtualized?: boolean;
  dismissible?: boolean;
  /** Permite arrastar a folha pela área de conteúdo; desligue em listas que precisam rolar. */
  contentPanningGesture?: boolean;
  /**
   * Variante visual explícita. `creation` é o menu central de criação: superfície
   * creme, cantos de 12 com fio de tinta no topo, alça de tinta 48 × 5 e conteúdo
   * sem padding lateral (as ilustrações encostam na borda). `report` é a confirmação
   * da denúncia: papel mais escuro, borda de tinta no topo e 20 de padding lateral.
   */
  appearance?: 'paper' | 'creation' | 'report';
  /** Superfície do sheet; a lista de destinos usa o creme do fundo do app. */
  surface?: 'paper' | 'cream';
};

/** Aparência Popularia, física e arbitragem entre scroll/teclado delegadas ao Gorhom. */
export function BottomSheet({ visible, onClose, title, accessibilityLabel, children, scrollable = true, virtualized = false, dismissible = true, contentPanningGesture = dismissible, appearance = 'paper', surface = 'paper' }: BottomSheetProps) {
  const creation = appearance === 'creation';
  const report = appearance === 'report';
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
  const handle = useCallback(() => <View style={[styles.dragHeader, creation && styles.creationDragHeader, report && styles.reportDragHeader]} testID="bottom-sheet-drag-header"
    accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel ?? title ?? 'Opções'} accessibilityHint="Arraste para baixo para fechar"
    accessibilityActions={[{ name: 'escape', label: 'Fechar' }, { name: 'decrement', label: 'Fechar' }]}
    onAccessibilityAction={close} onAccessibilityEscape={close}>
    <View style={[styles.handle, creation && styles.creationHandle, report && styles.reportHandle]} />
    {title ? <AppText style={styles.title} accessibilityRole="header">{title}</AppText> : null}
  </View>, [title, accessibilityLabel, close, creation, report]);
  const paddingBottom = report
    ? insets.bottom + 30
    : Math.max(insets.bottom, Spacing.four) + Spacing.four;
  // O Gorhom compõe o contentContainerStyle com dois argumentos; um array de três quebra.
  const contentStyle = StyleSheet.flatten([styles.content, creation ? styles.creationContent : null, report ? styles.reportContent : null, { paddingBottom }]);
  const backgroundStyle = StyleSheet.flatten([styles.background, creation ? styles.creationBackground : null, report ? styles.reportBackground : null, surface === 'cream' ? styles.creamBackground : null]);
  if (!mounted) return null;
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
    <GestureHandlerRootView style={styles.overlay}>
    <GorhomBottomSheet ref={sheet}
    onClose={() => { Keyboard.dismiss(); setMounted(false); if (visible) onClose(); }}
    enablePanDownToClose={dismissible}
    enableHandlePanningGesture={dismissible}
    enableContentPanningGesture={contentPanningGesture}
    enableDynamicSizing={!virtualized}
    snapPoints={virtualized ? ['86%'] : undefined}
    maxDynamicContentSize={height * 0.86}
    topInset={insets.top}
    keyboardBehavior="interactive" keyboardBlurBehavior="restore"
    enableBlurKeyboardOnGesture android_keyboardInputMode="adjustResize"
    backdropComponent={backdrop} handleComponent={handle}
    backgroundStyle={backgroundStyle}
    style={{ marginHorizontal: Math.max(0, (width - MaxContentWidth) / 2) }}>
    <InsideBottomSheet.Provider value>
      {virtualized ? <View style={[styles.list, { paddingBottom }]}>{children}</View>
        : scrollable ? <BottomSheetScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle}>{children}</BottomSheetScrollView>
          : <BottomSheetView style={contentStyle}>{children}</BottomSheetView>}
    </InsideBottomSheet.Provider>
  </GorhomBottomSheet>
    </GestureHandlerRootView>
  </Modal>;
}

export const PopulariaBottomSheet = BottomSheet;
const styles = StyleSheet.create({
  overlay: { flex: 1 },
  background: { backgroundColor: Colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  creamBackground: {
    backgroundColor: Colors.cream,
  },
  creationBackground: {
    backgroundColor: Colors.cream,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 2,
    borderTopColor: Colors.ink,
  },
  reportBackground: {
    backgroundColor: '#F2EADB',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 2,
    borderTopColor: '#15120F',
  },
  content: { paddingHorizontal: Spacing.five, gap: Spacing.two },
  creationContent: { paddingHorizontal: 0, gap: 0 },
  reportContent: { paddingHorizontal: 20, gap: 0 },
  list: { flex: 1, paddingHorizontal: Spacing.five, gap: Spacing.two },
  dragHeader: { minHeight: 48, paddingTop: 10, paddingBottom: Spacing.three, paddingHorizontal: Spacing.five, gap: Spacing.three },
  creationDragHeader: { minHeight: 15, paddingTop: 10, paddingBottom: 0, paddingHorizontal: 0, gap: 0 },
  reportDragHeader: { minHeight: 0, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 0, gap: 0 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.strawDark },
  creationHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: Colors.ink },
  reportHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#15120F' },
  title: { fontFamily: Fonts.condensed, fontSize: 32, lineHeight: 40, textTransform: 'uppercase', color: Colors.ink },
});
