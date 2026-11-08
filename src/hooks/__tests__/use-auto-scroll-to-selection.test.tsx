import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { LayoutChangeEvent } from 'react-native';

import { useAutoScrollToSelection } from '../use-auto-scroll-to-selection';

function layout(x: number): LayoutChangeEvent {
  return { nativeEvent: { layout: { x, y: 0, width: 100, height: 44 } } } as LayoutChangeEvent;
}

describe('rolagem automática dos filtros', () => {
  it('traz a seleção para a área visível quando ela muda por outro caminho', async () => {
    const scrollTo = jest.fn();
    const ref = { current: { scrollTo } };
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useAutoScrollToSelection(value, ref),
      { initialProps: { value: 'all' } },
    );

    await act(async () => {
      result.current.onOptionLayout('all', layout(0));
      result.current.onOptionLayout('people', layout(120));
      result.current.onOptionLayout('comunas', layout(260));
    });
    scrollTo.mockClear();

    await rerender({ value: 'comunas' });
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 260 - 18, animated: true });
  });

  it('rola depois que uma opção nova é medida, mesmo sem mudar o valor', async () => {
    const scrollTo = jest.fn();
    const ref = { current: { scrollTo } };
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useAutoScrollToSelection(value, ref),
      { initialProps: { value: 'all' } },
    );

    await act(async () => { result.current.onOptionLayout('all', layout(0)); });
    scrollTo.mockClear();
    await rerender({ value: 'novo' });
    expect(scrollTo).not.toHaveBeenCalled();

    await act(async () => { result.current.onOptionLayout('novo', layout(400)); });
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 400 - 18, animated: true });
  });

  it('não rola quando o recurso está desligado', async () => {
    const scrollTo = jest.fn();
    const ref = { current: { scrollTo } };
    const { result } = await renderHook(() => useAutoScrollToSelection<string>('all', ref, false));

    await act(async () => {
      result.current.onOptionLayout('all', layout(0));
      result.current.onOptionLayout('people', layout(120));
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
