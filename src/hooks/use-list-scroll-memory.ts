import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { readScreenMemory, writeScreenMemory } from '@/lib/screen-memory';

/** O mínimo comum entre FlatList, FlashList e a lista de uma folha. */
export type ScrollableListRef = {
  scrollToOffset?: (params: { offset: number; animated?: boolean }) => void;
  scrollToIndex?: (params: { index: number; animated?: boolean; viewPosition?: number }) => void;
};

type ViewableItem = {
  key?: string | number | null;
  index?: number | null;
};

type ViewableInfo = {
  viewableItems: readonly ViewableItem[];
};

type ScrollMemory = {
  offset: number;
  /** Primeiro item visível: permite reencontrar o ponto se o topo mudou. */
  anchorKey?: string;
  anchorIndex?: number;
};

type ScrollState = {
  key: string;
  offset: number;
  anchorKey?: string;
  anchorIndex?: number;
  restored: boolean;
};

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 20, minimumViewTime: 100 } as const;

function stateFor(key: string): ScrollState {
  const stored = readScreenMemory<ScrollMemory>(key);
  return {
    key,
    offset: stored?.offset ?? 0,
    anchorKey: stored?.anchorKey,
    anchorIndex: stored?.anchorIndex,
    restored: false,
  };
}

/**
 * Lembra a posição de leitura de uma lista e a restaura quando a tela remonta.
 *
 * O offset é gravado a cada rolagem (barato, sem estado do React). O primeiro
 * item visível é a âncora: se a revalidação inserir/remover itens acima, voltar
 * pelo índice antigo levaria a outro trecho; com a âncora, a lista reencontra
 * o item e restaura o ponto relativo a ele. Sem mudança de índice, o offset
 * exato é usado, o que também preserva a posição dentro de um item alto.
 */
export function useListScrollMemory<T>({
  screenKey,
  listRef,
  data = [],
  ready = true,
  getItemKey,
  viewabilityConfig = VIEWABILITY_CONFIG,
}: {
  screenKey: string;
  listRef: RefObject<ScrollableListRef | null>;
  data?: readonly T[];
  /** Só restaura depois que a lista tem dados para posicionar. */
  ready?: boolean;
  getItemKey?: (item: T) => string;
  /** Configuração existente da tela; a memória só lê os itens visíveis. */
  viewabilityConfig?: object;
}) {
  // Objeto mutado apenas em eventos/efeitos: nada aqui dispara render.
  const scrollRef = useRef<ScrollState>(stateFor(screenKey));

  const persist = useCallback(() => {
    const scroll = scrollRef.current;
    writeScreenMemory<ScrollMemory>(scroll.key, {
      offset: scroll.offset,
      ...(scroll.anchorKey !== undefined ? { anchorKey: scroll.anchorKey } : {}),
      ...(scroll.anchorIndex !== undefined ? { anchorIndex: scroll.anchorIndex } : {}),
    });
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollRef.current.offset = event.nativeEvent.contentOffset.y;
      persist();
    },
    [persist],
  );

  const handleViewableItemsChanged = useCallback(
    (info: ViewableInfo) => {
      let first: ViewableItem | undefined;
      for (const item of info.viewableItems) {
        if (item.index === undefined || item.index === null) continue;
        if (!first || item.index < (first.index ?? Number.MAX_SAFE_INTEGER)) first = item;
      }
      if (first) {
        scrollRef.current.anchorKey =
          first.key !== undefined && first.key !== null ? String(first.key) : undefined;
        scrollRef.current.anchorIndex = first.index ?? undefined;
        persist();
      }
    },
    [persist],
  );

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (scroll.key !== screenKey) {
      // Aba/comuna nova no mesmo componente: cada tela tem sua própria posição.
      const next = stateFor(screenKey);
      scroll.key = next.key;
      scroll.offset = next.offset;
      scroll.anchorKey = next.anchorKey;
      scroll.anchorIndex = next.anchorIndex;
      scroll.restored = false;
    }
    if (!ready || scroll.restored) return;
    const list = listRef.current;
    if (!list) return;
    scroll.restored = true;
    if (scroll.offset <= 0 && scroll.anchorIndex === undefined) return;

    const currentIndex = scroll.anchorKey !== undefined && getItemKey
      ? data.findIndex((item) => getItemKey(item) === scroll.anchorKey)
      : -1;
    // Topo diferente do registrado: o offset absoluto apontaria para outro
    // trecho. A âncora manda a leitura para o mesmo item.
    if (
      currentIndex >= 0 &&
      scroll.anchorIndex !== undefined &&
      currentIndex !== scroll.anchorIndex &&
      list.scrollToIndex
    ) {
      list.scrollToIndex({ index: currentIndex, animated: false, viewPosition: 0 });
      return;
    }
    if (scroll.offset > 0) list.scrollToOffset?.({ offset: scroll.offset, animated: false });
  }, [data, getItemKey, listRef, ready, screenKey]);

  const onScrollToIndexFailed = useCallback(() => {
    const scroll = scrollRef.current;
    if (scroll.offset > 0) listRef.current?.scrollToOffset?.({ offset: scroll.offset, animated: false });
  }, [listRef]);

  return {
    onScroll,
    onViewableItemsChanged: handleViewableItemsChanged,
    onScrollToIndexFailed,
    viewabilityConfig,
    scrollEventThrottle: 16,
  };
}
