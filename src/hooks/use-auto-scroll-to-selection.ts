import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { Spacing } from '@/constants/theme';

/** O mínimo que a barra precisa do ScrollView para trazer uma opção à vista. */
export type HorizontalScroller = {
  scrollTo: (options: { x: number; animated?: boolean }) => void;
};

type ScrollerRef = { current: HorizontalScroller | null };

/**
 * Mantém a opção ativa visível num trilho horizontal. A posição é medida por
 * `onOptionLayout`; a própria medição da opção ativa também rola, porque a
 * lista pode ganhar uma opção depois da troca (por exemplo, "Ver todas").
 */
export function useAutoScrollToSelection<K extends string>(
  value: K,
  scrollerRef: ScrollerRef,
  enabled = true,
) {
  const positions = useRef<Partial<Record<K, number>>>({});
  const selected = useRef(value);
  const scrollTo = useCallback(
    (key: K) => {
      if (!enabled) return;
      const x = positions.current[key];
      if (x === undefined) return;
      scrollerRef.current?.scrollTo({ x: Math.max(0, x - Spacing.five), animated: true });
    },
    [enabled, scrollerRef],
  );
  useEffect(() => {
    selected.current = value;
    scrollTo(value);
  }, [scrollTo, value]);
  const onOptionLayout = useCallback(
    (key: K, event: LayoutChangeEvent) => {
      positions.current[key] = event.nativeEvent.layout.x;
      if (key === selected.current) scrollTo(key);
    },
    [scrollTo],
  );
  return { onOptionLayout };
}
