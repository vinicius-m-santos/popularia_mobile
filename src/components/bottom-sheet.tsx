import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GorhomBottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, MaxContentWidth, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

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
  /**
   * Permite arrastar a folha pela área de conteúdo. Quando omitido, fica desligado
   * para conteúdo rolável (`scrollable`/`virtualized`): assim arrastar a lista no
   * topo rola o conteúdo em vez de fechar a folha. Em conteúdo curto continua ligado.
   */
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

const CLOSE_FALLBACK_MS = 500;

/** Aparência Popularia, física e arbitragem entre scroll/teclado delegadas ao Gorhom. */
export function BottomSheet({ visible, onClose, title, accessibilityLabel, children, scrollable = true, virtualized = false, dismissible = true, contentPanningGesture, appearance = 'paper', surface = 'paper' }: BottomSheetProps) {
  const creation = appearance === 'creation';
  const report = appearance === 'report';
  // Listas roláveis têm o próprio gesto vertical. Deixar o Gorhom arrastar o conteúdo
  // nesse caso fazia um arrasto no topo da lista fechar a folha sem intenção.
  const scrollableContent = virtualized || scrollable;
  const canPanContent = dismissible && (contentPanningGesture ?? !scrollableContent);
  const sheet = useRef<GorhomBottomSheet>(null);
  const [mounted, setMounted] = useState(visible);
  const visibleRef = useRef(visible);
  /** O Gorhom ignora snapToIndex antes de calcular o layout; só abrimos depois da medição. */
  const measuredRef = useRef(false);
  const openedRef = useRef(false);
  const openFrame = useRef<number | null>(null);
  const closeFallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();

  const cancelScheduledOpen = useCallback(() => {
    if (openFrame.current !== null) {
      cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
  }, []);

  const cancelCloseFallback = useCallback(() => {
    if (closeFallback.current !== null) {
      clearTimeout(closeFallback.current);
      closeFallback.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    cancelScheduledOpen();
    openFrame.current = requestAnimationFrame(() => {
      openFrame.current = null;
      if (!visibleRef.current || openedRef.current) return;
      sheet.current?.snapToIndex(0);
    });
  }, [cancelScheduledOpen]);

  const handleContentReady = useCallback(() => {
    measuredRef.current = true;
    if (visibleRef.current && !openedRef.current) scheduleOpen();
  }, [scheduleOpen]);

  const close = useCallback(() => { if (dismissible) sheet.current?.close(); }, [dismissible]);
  useEffect(() => {
    visibleRef.current = visible;
    if (visible) {
      cancelCloseFallback();
      // Monta primeiro; a abertura é disparada depois que o conteúdo reporta layout.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      if (measuredRef.current) scheduleOpen();
      return;
    }
    cancelScheduledOpen();
    openedRef.current = false;
    sheet.current?.close();
    // No web, o Gorhom pode não emitir `onClose` depois de uma escolha rápida.
    // Preserva a animação normal, mas garante que o Modal não intercepte a tela.
    cancelCloseFallback();
    closeFallback.current = setTimeout(() => {
      closeFallback.current = null;
      measuredRef.current = false;
      setMounted(false);
    }, CLOSE_FALLBACK_MS);
  }, [visible, scheduleOpen, cancelScheduledOpen, cancelCloseFallback]);
  useEffect(() => {
    if (visible && mounted && measuredRef.current) scheduleOpen();
  }, [visible, mounted, scheduleOpen]);
  useEffect(() => () => {
    cancelScheduledOpen();
    cancelCloseFallback();
  }, [cancelScheduledOpen, cancelCloseFallback]);

  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55}
    pressBehavior={dismissible ? 'close' : 'none'} accessibilityRole="button" accessibilityLabel="Fechar" accessibilityHint="Fecha esta folha" />,
  [dismissible]);
  const handle = useCallback(() => <View style={[styles.dragHeader, creation && styles.creationDragHeader, report && styles.reportDragHeader]} testID="bottom-sheet-drag-header"
    accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel ?? title ?? 'Opções'} accessibilityHint="Arraste para baixo para fechar"
    accessibilityActions={[{ name: 'escape', label: 'Fechar' }, { name: 'decrement', label: 'Fechar' }]}
    onAccessibilityAction={close} onAccessibilityEscape={close}>
    <View testID="bottom-sheet-handle" style={[styles.handle, creation && styles.creationHandle, report && styles.reportHandle]} />
    {title ? <AppText style={styles.title} accessibilityRole="header">{title}</AppText> : null}
  </View>, [title, accessibilityLabel, close, creation, report]);
  const paddingBottom = report
    ? insets.bottom + 30
    : Math.max(insets.bottom, Spacing.four) + Spacing.four;
  // O Gorhom compõe o contentContainerStyle com dois argumentos; um array de três quebra.
  const contentStyle = StyleSheet.flatten([styles.content, creation ? styles.creationContent : null, report ? styles.reportContent : null, { paddingBottom }]);
  const backgroundStyle = StyleSheet.flatten([styles.background, creation ? styles.creationBackground : null, report ? styles.reportBackground : null, surface === 'cream' ? styles.creamBackground : null]);
  if (!mounted) return null;
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close} testID="bottom-sheet-modal">
    <GestureHandlerRootView
      testID="bottom-sheet-root"
      style={styles.overlay}
      accessibilityViewIsModal
      onAccessibilityEscape={close}>
    <GorhomBottomSheet ref={sheet}
    onClose={() => {
      Keyboard.dismiss();
      cancelScheduledOpen();
      cancelCloseFallback();
      measuredRef.current = false;
      openedRef.current = false;
      // Mantém o Modal nativo montado até a animação de saída do Gorhom terminar.
      setMounted(false);
      if (visible) onClose();
    }}
    onChange={(index) => { if (index >= 0) openedRef.current = true; }}
    // Monta fechado e abre só depois da medição: evita a primeira abertura parcial
    // seguida de salto de altura quando o conteúdo dinâmico termina de medir.
    index={-1}
    animateOnMount={false}
    // Sem animação de abertura/fechamento quando o sistema pede movimento reduzido.
    animationConfigs={reducedMotion ? { duration: 0 } : undefined}
    enablePanDownToClose={dismissible}
    enableHandlePanningGesture={dismissible}
    enableContentPanningGesture={canPanContent}
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
      {virtualized ? <View testID="bottom-sheet-virtualized" style={[styles.list, { paddingBottom }]} onLayout={handleContentReady}>{children}</View>
        : scrollable ? <BottomSheetScrollView testID="bottom-sheet-scroll" bounces={false} keyboardShouldPersistTaps="handled" onContentSizeChange={handleContentReady} contentContainerStyle={contentStyle}>{children}</BottomSheetScrollView>
          : <BottomSheetView testID="bottom-sheet-content" style={contentStyle} onLayout={handleContentReady}>{children}</BottomSheetView>}
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
  // A área de arraste do Gorhom é a altura do handleComponent. 44 garante o alvo mínimo
  // sem aumentar a alça visível (48 × 5 na criação e na denúncia).
  creationDragHeader: { minHeight: MinTouchTarget, paddingTop: 10, paddingBottom: 0, paddingHorizontal: 0, gap: 0 },
  reportDragHeader: { minHeight: MinTouchTarget, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 0, gap: 0 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.strawDark },
  creationHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: Colors.ink },
  reportHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#15120F' },
  title: { fontFamily: Fonts.condensed, fontSize: 32, lineHeight: 40, textTransform: 'uppercase', color: Colors.ink },
});
