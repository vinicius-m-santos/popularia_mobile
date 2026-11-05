import { useCallback, useState } from 'react';
import type { ViewToken } from '@shopify/flash-list';

/** Usado apenas por listas com players; o callback só muda ao cruzar a viewport. */
export function useListVisibility() {
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(() => new Set());
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<unknown>[] }) => {
    setVisibleIds((previous) => {
      const next = new Set(viewableItems.map((token) => token.key));
      return previous.size === next.size && [...next].every((id) => previous.has(id)) ? previous : next;
    });
  }, []);
  /**
   * Esquece a viewport atual. Use quando a lista é desmontada (troca de aba) e a
   * próxima montagem ainda não emitiu viewability: sem isso, IDs da janela
   * anterior montariam players antes de os cartões estarem visíveis de novo.
   */
  const clear = useCallback(() => {
    setVisibleIds((previous) => (previous.size === 0 ? previous : new Set()));
  }, []);
  return { visibleIds, onViewableItemsChanged, clear };
}
export const mediaViewabilityConfig = { itemVisiblePercentThreshold: 20, minimumViewTime: 100 };
