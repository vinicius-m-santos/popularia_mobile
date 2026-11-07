import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import type { LayoutChangeEvent } from 'react-native';

import { useStickyControlsScroll, type StickyControlsListRef } from '../use-sticky-controls-scroll';

function listRef() {
  return {
    current: {
      scrollToOffset: jest.fn(),
    } satisfies StickyControlsListRef,
  };
}

function layout(height: number) {
  return { nativeEvent: { layout: { height } } } as LayoutChangeEvent;
}

afterEach(async () => { await cleanup(); });

describe('scroll dos controles fixos do Explorar', () => {
  it('espera o conteúdo longo antes de fixar o cabeçalho', async () => {
    const ref = listRef();
    const { result } = await renderHook(() => useStickyControlsScroll(ref));

    await act(async () => {
      result.current.onHeaderLayout(layout(120));
      result.current.onListLayout(layout(700));
      // Resultado curto: o offset do cabeçalho (120) ainda não é alcançável.
      result.current.onContentSizeChange(390, 760);
    });
    await act(async () => { result.current.scrollToControls(false); });
    expect(ref.current.scrollToOffset).not.toHaveBeenCalled();

    // A nova busca chega e o conteúdo passa a alcançar o cabeçalho.
    await act(async () => { result.current.onContentSizeChange(390, 5000); });
    expect(ref.current.scrollToOffset).toHaveBeenCalledWith({ offset: 120, animated: false });
  });

  it('aplica na hora quando o conteúdo atual já alcança o cabeçalho', async () => {
    const ref = listRef();
    const { result } = await renderHook(() => useStickyControlsScroll(ref));

    await act(async () => {
      result.current.onHeaderLayout(layout(84));
      result.current.onListLayout(layout(700));
      result.current.onContentSizeChange(390, 5000);
    });
    await act(async () => { result.current.scrollToControls(false); });

    expect(ref.current.scrollToOffset).toHaveBeenCalledWith({ offset: 84, animated: false });
  });

  it('pedir o topo cancela uma fixação pendente', async () => {
    const ref = listRef();
    const { result } = await renderHook(() => useStickyControlsScroll(ref));

    await act(async () => {
      result.current.onHeaderLayout(layout(120));
      result.current.onListLayout(layout(700));
      result.current.onContentSizeChange(390, 760);
      result.current.scrollToControls(false);
      result.current.scrollToControls(true);
    });
    expect(ref.current.scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });

    await act(async () => { result.current.onContentSizeChange(390, 5000); });
    expect(ref.current.scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it('arrastar a lista descarta a fixação que ainda não cabia', async () => {
    const ref = listRef();
    const { result } = await renderHook(() => useStickyControlsScroll(ref));

    await act(async () => {
      result.current.onHeaderLayout(layout(120));
      result.current.onListLayout(layout(700));
      result.current.onContentSizeChange(390, 760);
      result.current.scrollToControls(false);
      result.current.onScrollBeginDrag();
    });
    await act(async () => { result.current.onContentSizeChange(390, 5000); });

    expect(ref.current.scrollToOffset).not.toHaveBeenCalled();
  });

  it('sem cabeçalho medido, mantém o topo em vez de um offset inválido', async () => {
    const ref = listRef();
    const { result } = await renderHook(() => useStickyControlsScroll(ref));

    await act(async () => { result.current.scrollToControls(false); });

    expect(ref.current.scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  });
});
