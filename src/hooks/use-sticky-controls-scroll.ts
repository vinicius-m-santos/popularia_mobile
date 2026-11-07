import { useCallback, useRef, type RefObject } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/** O mínimo de uma lista rolável usado pelo Explorar (FlatList/FlashList). */
export type StickyControlsListRef = {
  scrollToOffset?: (params: { offset: number; animated?: boolean }) => void;
};

/**
 * Mantém os controles fixos do Explorar no topo ao trocar termo ou filtro.
 *
 * Quando a lista atual é curta, o offset do cabeçalho ainda não é alcançável:
 * um `scrollToOffset` imediato é limitado ao fim do conteúdo e a troca para um
 * resultado longo não refaz o movimento. Por isso o destino fica pendente até
 * `onContentSizeChange` confirmar que o novo conteúdo alcança o cabeçalho.
 * Arrastar a lista ou pedir o topo cancela a pendência.
 */
export function useStickyControlsScroll(listRef: RefObject<StickyControlsListRef | null>) {
  const headerHeight = useRef(0);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const pendingOffset = useRef<number | null>(null);

  const applyPending = useCallback(() => {
    const target = pendingOffset.current;
    if (target === null) return;
    // Ainda não há conteúdo suficiente para fixar o cabeçalho. Espera a próxima
    // medição em vez de gastar o destino num scroll que o sistema vai limitar.
    if (contentHeight.current - viewportHeight.current < target) return;
    pendingOffset.current = null;
    listRef.current?.scrollToOffset?.({ offset: target, animated: false });
  }, [listRef]);

  const scrollToControls = useCallback((resetToTop: boolean) => {
    if (resetToTop) {
      pendingOffset.current = null;
      listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      return;
    }
    const target = headerHeight.current;
    if (target <= 0) {
      pendingOffset.current = null;
      listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      return;
    }
    pendingOffset.current = target;
    applyPending();
  }, [applyPending, listRef]);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    headerHeight.current = event.nativeEvent.layout.height;
  }, []);

  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    applyPending();
  }, [applyPending]);

  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.current = height;
    applyPending();
  }, [applyPending]);

  const onScrollBeginDrag = useCallback(() => {
    pendingOffset.current = null;
  }, []);

  return { onContentSizeChange, onHeaderLayout, onListLayout, onScrollBeginDrag, scrollToControls };
}
