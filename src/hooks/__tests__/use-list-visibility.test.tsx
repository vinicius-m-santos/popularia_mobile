import { describe, expect, it, jest } from '@jest/globals';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ViewToken } from '@shopify/flash-list';

import { MediaVisibilityProvider, useListVisibility, useMediaVisibility, useMediaVisible, type MediaVisibility } from '../use-list-visibility';

function viewport(ids: string[]): { viewableItems: ViewToken<unknown>[] } {
  return { viewableItems: ids.map((key) => ({ key } as ViewToken<unknown>)) };
}

type RenderSpy = (id: string) => void;

function Card({ id, onRender }: { id: string; onRender: RenderSpy }) {
  const visible = useMediaVisible(id);
  onRender(id);
  return <Text testID={`card-${id}`}>{visible ? 'visible' : 'hidden'}</Text>;
}

function Harness({ visibility, onRender }: { visibility: MediaVisibility; onRender: RenderSpy }) {
  return (
    <MediaVisibilityProvider visibility={visibility}>
      <Card id="a" onRender={onRender} />
      <Card id="b" onRender={onRender} />
      <Card id="c" onRender={onRender} />
    </MediaVisibilityProvider>
  );
}

function LooseCard() {
  const visible = useMediaVisible('a');
  return <Text testID="loose">{visible ? 'visible' : 'hidden'}</Text>;
}

describe('useListVisibility', () => {
  it('notifica só os ids que entraram ou saíram', async () => {
    const { result } = await renderHook(() => useListVisibility());
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    result.current.subscribe('a', listenerA);
    result.current.subscribe('b', listenerB);

    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['a']));
    });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
    expect(result.current.isVisible('a')).toBe(true);
    const enteredAt = result.current.visibleSince('a');
    expect(enteredAt).not.toBeNull();

    // A mesma janela não muta nada, não notifica de novo e preserva o marco.
    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['a']));
    });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(result.current.visibleSince('a')).toBe(enteredAt);

    // Trocar a janela notifica quem saiu e quem entrou, não os demais.
    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['b']));
    });
    expect(listenerA).toHaveBeenCalledTimes(2);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(result.current.isVisible('a')).toBe(false);
    expect(result.current.visibleSince('a')).toBeNull();
    expect(result.current.isVisible('b')).toBe(true);
    expect(result.current.visibleSince('b')).not.toBeNull();
  });

  it('clear esquece a viewport e notifica apenas os ids visíveis', async () => {
    const { result } = await renderHook(() => useListVisibility());
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    result.current.subscribe('a', listenerA);
    result.current.subscribe('b', listenerB);
    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['a', 'b']));
    });
    listenerA.mockClear();
    listenerB.mockClear();

    await act(async () => {
      result.current.clear();
    });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(result.current.isVisible('a')).toBe(false);
    expect(result.current.isVisible('b')).toBe(false);
    expect(result.current.visibleSince('a')).toBeNull();
    expect(result.current.visibleSince('b')).toBeNull();

    // Limpar de novo não dispara notificações.
    await act(async () => {
      result.current.clear();
    });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  it('re-renderiza apenas o cartão que entra ou sai da viewport', async () => {
    const { result } = await renderHook(() => useListVisibility());
    const onRender = jest.fn((_id: string) => undefined);
    await render(<Harness visibility={result.current} onRender={onRender} />);
    onRender.mockClear();

    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['b']));
    });
    expect(onRender.mock.calls.map(([id]) => id)).toEqual(['b']);
    expect(screen.getByTestId('card-a').props.children).toBe('hidden');
    expect(screen.getByTestId('card-b').props.children).toBe('visible');
    expect(screen.getByTestId('card-c').props.children).toBe('hidden');

    onRender.mockClear();
    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['c']));
    });
    // b sai e c entra; a não re-renderiza.
    expect(new Set(onRender.mock.calls.map(([id]) => id))).toEqual(new Set(['b', 'c']));
    expect(screen.getByTestId('card-a').props.children).toBe('hidden');
    expect(screen.getByTestId('card-b').props.children).toBe('hidden');
    expect(screen.getByTestId('card-c').props.children).toBe('visible');
  });

  it('mantém a viewport enquanto a resetKey não muda e começa vazia na troca', async () => {
    const { result, rerender } = await renderHook(
      ({ scope }: { scope: string }) => useListVisibility(scope),
      { initialProps: { scope: 'posts' } },
    );
    const first = result.current;
    const firstCallback = first.onViewableItemsChanged;
    await act(async () => {
      first.onViewableItemsChanged(viewport(['p1']));
    });

    await rerender({ scope: 'posts' });
    expect(result.current).toBe(first);
    expect(result.current.onViewableItemsChanged).toBe(firstCallback);

    await rerender({ scope: 'rules' });
    expect(result.current).not.toBe(first);
    expect(result.current.isVisible('p1')).toBe(false);
    expect(result.current.onViewableItemsChanged).not.toBe(firstCallback);
  });

  it('bloqueia a mídia fora de foco e reabilita só a viewport retida', async () => {
    const { result } = await renderHook(() => useListVisibility());
    await render(<Harness visibility={result.current} onRender={jest.fn()} />);
    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['a', 'b']));
    });
    expect(screen.getByTestId('card-a').props.children).toBe('visible');
    expect(screen.getByTestId('card-b').props.children).toBe('visible');
    expect(result.current.visibleSince('a')).not.toBeNull();

    await act(async () => {
      result.current.setFocused(false);
    });
    // Perder o foco não limpa a janela: todos voltam ao pôster até o retorno.
    expect(screen.getByTestId('card-a').props.children).toBe('hidden');
    expect(screen.getByTestId('card-b').props.children).toBe('hidden');
    expect(result.current.isVisible('a')).toBe(false);
    expect(result.current.visibleSince('a')).toBeNull();

    // A viewport pode mudar com a rota coberta; ainda não é hora de montar.
    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['b', 'c']));
    });
    expect(screen.getByTestId('card-b').props.children).toBe('hidden');
    expect(screen.getByTestId('card-c').props.children).toBe('hidden');

    // No retorno, só quem está visível agora é habilitado e a espera
    // viewport → primeiro quadro recomeça no foco, não na entrada antiga.
    await act(async () => {
      result.current.setFocused(true);
    });
    expect(screen.getByTestId('card-a').props.children).toBe('hidden');
    expect(screen.getByTestId('card-b').props.children).toBe('visible');
    expect(screen.getByTestId('card-c').props.children).toBe('visible');
    expect(result.current.visibleSince('a')).toBeNull();
    expect(result.current.visibleSince('b')).not.toBeNull();
  });

  it('entrega visibilidade e marco de viewport na mesma assinatura', async () => {
    const { result } = await renderHook(() => useListVisibility());
    function EntryCard({ id }: { id: string }) {
      const state = useMediaVisibility(id);
      return <Text testID={`entry-${id}`}>{`${state.visible}:${state.viewportEnteredAt ?? 'null'}`}</Text>;
    }
    await render(
      <MediaVisibilityProvider visibility={result.current}>
        <EntryCard id="a" />
      </MediaVisibilityProvider>,
    );
    expect(screen.getByTestId('entry-a').props.children).toBe('false:null');

    await act(async () => {
      result.current.onViewableItemsChanged(viewport(['a']));
    });
    const rendered = String(screen.getByTestId('entry-a').props.children);
    expect(rendered).toMatch(/^true:\d+(\.\d+)?$/);
  });

  it('sem provider mantém o default seguro falso', async () => {
    await render(<LooseCard />);
    expect(screen.getByTestId('loose').props.children).toBe('hidden');
  });
});
