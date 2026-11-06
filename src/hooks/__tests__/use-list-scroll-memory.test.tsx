import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, renderHook } from '@testing-library/react-native';

import { clearScreenMemory } from '@/lib/screen-memory';

import { useListScrollMemory, type ScrollableListRef } from '../use-list-scroll-memory';

type Item = { id: string };
const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

function listRef() {
  return {
    current: {
      scrollToOffset: jest.fn(),
      scrollToIndex: jest.fn(),
    } satisfies ScrollableListRef,
  };
}

beforeEach(() => { clearScreenMemory(); });
afterEach(async () => { await cleanup(); clearScreenMemory(); });

describe('memória de posição da lista', () => {
  it('restaura o offset ao remontar a tela', async () => {
    const firstRef = listRef();
    const first = await renderHook(() => useListScrollMemory<Item>({
      screenKey: 'library:public',
      listRef: firstRef,
      data: items,
      getItemKey: (item) => item.id,
    }));

    await act(async () => {
      first.result.current.onScroll({ nativeEvent: { contentOffset: { y: 640 } } } as never);
    });
    await first.unmount();

    const nextRef = listRef();
    await renderHook(() => useListScrollMemory<Item>({
      screenKey: 'library:public',
      listRef: nextRef,
      data: items,
      getItemKey: (item) => item.id,
    }));

    expect(nextRef.current.scrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: false });
    expect(nextRef.current.scrollToIndex).not.toHaveBeenCalled();
  });

  it('usa a âncora quando o topo mudou e o offset apontaria para outro trecho', async () => {
    const firstRef = listRef();
    const first = await renderHook(() => useListScrollMemory<Item>({
      screenKey: 'library:public',
      listRef: firstRef,
      data: items,
      getItemKey: (item) => item.id,
    }));

    await act(async () => {
      first.result.current.onViewableItemsChanged({
        viewableItems: [{ key: 'c', index: 2 }],
      });
      first.result.current.onScroll({ nativeEvent: { contentOffset: { y: 900 } } } as never);
    });
    await first.unmount();

    const nextRef = listRef();
    // Uma publicação nova entrou no topo: "c" passou do índice 2 para 3.
    const nextItems: Item[] = [{ id: 'nova' }, ...items];
    await renderHook(() => useListScrollMemory<Item>({
      screenKey: 'library:public',
      listRef: nextRef,
      data: nextItems,
      getItemKey: (item) => item.id,
    }));

    expect(nextRef.current.scrollToIndex).toHaveBeenCalledWith({ index: 3, animated: false, viewPosition: 0 });
    expect(nextRef.current.scrollToOffset).not.toHaveBeenCalled();
  });

  it('não restaura antes de a lista ter dados', async () => {
    const firstRef = listRef();
    const first = await renderHook(() => useListScrollMemory<Item>({
      screenKey: 'library:public',
      listRef: firstRef,
      data: items,
      getItemKey: (item) => item.id,
    }));
    await act(async () => {
      first.result.current.onScroll({ nativeEvent: { contentOffset: { y: 300 } } } as never);
    });
    await first.unmount();

    const nextRef = listRef();
    const next = await renderHook(
      ({ ready }: { ready: boolean }) => useListScrollMemory<Item>({
        screenKey: 'library:public',
        listRef: nextRef,
        data: ready ? items : [],
        ready,
        getItemKey: (item) => item.id,
      }),
      { initialProps: { ready: false } },
    );
    expect(nextRef.current.scrollToOffset).not.toHaveBeenCalled();

    await next.rerender({ ready: true });
    expect(nextRef.current.scrollToOffset).toHaveBeenCalledWith({ offset: 300, animated: false });
  });
});
