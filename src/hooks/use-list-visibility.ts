import { createContext, createElement, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { ViewToken } from '@shopify/flash-list';

import { performanceNow } from '@/lib/performance';

type VisibilityListener = () => void;

/**
 * Viewport de uma lista, consultável por `postId`.
 *
 * O conjunto visível não mora no estado do React: cada cartão assina apenas o
 * próprio ID com `useSyncExternalStore`. Assim, uma mudança de viewport notifica
 * só os cartões que entraram ou saíram, sem trocar `extraData`/`renderItem` da
 * FlashList e sem re-renderizar a tela inteira a cada rolagem.
 */
export type MediaVisibility = {
  isVisible: (postId: string) => boolean;
  /**
   * Instante (`performance.now()`) em que o ID entrou na viewport focada.
   * `null` fora da viewport, quando a rota não está em foco ou quando o cartão
   * não está em uma lista com viewability. A instrumentação de POP-25 usa esse
   * marco para medir o atraso entre a confirmação da viewport e o primeiro
   * quadro do vídeo, incluindo o trabalho de montagem/commit no caminho.
   */
  visibleSince: (postId: string) => number | null;
  /**
   * Liga ou desliga a mídia da lista ao foco da rota. Fora de foco a viewport é
   * mantida, mas nenhum cartão pode montar player; ao voltar, a mesma janela é
   * reabilitada sem esperar uma nova viewability.
   */
  setFocused: (focused: boolean) => void;
  subscribe: (postId: string, listener: VisibilityListener) => () => void;
  onViewableItemsChanged: (info: { viewableItems: ViewToken<unknown>[] }) => void;
  /** Esquece a viewport atual (troca de aba, por exemplo). */
  clear: () => void;
};

function createMediaVisibility(): MediaVisibility {
  let visible: ReadonlySet<string> = new Set();
  // Marco por ID. Não é estado do React: só é lido quando o player monta ou
  // quando o primeiro quadro chega, para não re-renderizar a cada leitura.
  let enteredAt = new Map<string, number>();
  let focused = true;
  const listeners = new Map<string, Set<VisibilityListener>>();

  const notify = (ids: Iterable<string>) => {
    for (const id of ids) {
      const bucket = listeners.get(id);
      if (!bucket) continue;
      // Copia a lista: um listener pode cancelar a assinatura durante a notificação.
      for (const listener of [...bucket]) listener();
    }
  };

  return {
    isVisible: (postId) => focused && visible.has(postId) && enteredAt.has(postId),
    visibleSince: (postId) => (focused ? enteredAt.get(postId) ?? null : null),
    setFocused: (next) => {
      if (focused === next) return;
      focused = next;
      // Ao perder o foco, os IDs da janela atual viram pôster; ao voltar, só
      // esses mesmos IDs são reabilitados. A viewport não é limpa, então a
      // posição da lista e o pôster continuam intactos.
      if (focused) {
        // O player remonta ao voltar para a rota: a espera do primeiro quadro
        // recomeça neste instante, não no momento em que o cartão entrou na
        // viewport original.
        const now = performanceNow();
        enteredAt = new Map([...visible].map((id): [string, number] => [id, now]));
      }
      notify(visible);
    },
    subscribe: (postId, listener) => {
      const bucket = listeners.get(postId) ?? new Set<VisibilityListener>();
      if (!listeners.has(postId)) listeners.set(postId, bucket);
      bucket.add(listener);
      return () => {
        bucket.delete(listener);
        if (bucket.size === 0) listeners.delete(postId);
      };
    },
    onViewableItemsChanged: ({ viewableItems }) => {
      const next = new Set(viewableItems.map((token) => token.key));
      const entered: string[] = [];
      const left: string[] = [];
      for (const id of next) if (!visible.has(id)) entered.push(id);
      for (const id of visible) if (!next.has(id)) left.push(id);
      if (entered.length === 0 && left.length === 0) return;
      if (entered.length > 0) {
        // O mesmo marco serve para todos os IDs que entram nesta viewability:
        // o trabalho de montagem de cada player é comparável entre cartões.
        const now = performanceNow();
        for (const id of entered) enteredAt.set(id, now);
      }
      for (const id of left) enteredAt.delete(id);
      visible = next;
      // Fora de foco a janela é só memória: os cartões já estão no pôster e
      // serão notificados de uma vez quando a rota voltar a valer.
      if (!focused) return;
      notify(entered);
      notify(left);
    },
    clear: () => {
      if (visible.size === 0 && enteredAt.size === 0) return;
      const previous = visible;
      visible = new Set();
      enteredAt = new Map();
      if (focused) notify(previous);
    },
  };
}

/**
 * Viewport local de uma lista. Passe uma `resetKey` primitiva (a aba, por
 * exemplo) para começar com a viewport vazia sempre que a lista for remontada
 * por outro contexto: IDs da janela anterior não devem montar players antes da
 * nova viewability.
 */
export function useListVisibility(resetKey?: unknown): MediaVisibility {
  return useMemo(() => {
    // `resetKey` é só a chave de cache: trocar de aba cria outra viewport vazia.
    void resetKey;
    return createMediaVisibility();
  }, [resetKey]);
}

const MediaVisibilityContext = createContext<MediaVisibility | null>(null);

/** Disponibiliza a viewport da lista para os cartões que estão dentro dela. */
export function MediaVisibilityProvider({ visibility, children }: { visibility: MediaVisibility; children?: ReactNode }) {
  return createElement(MediaVisibilityContext.Provider, { value: visibility }, children);
}

export type MediaVisibilityState = {
  visible: boolean;
  /** Início da espera da viewport, quando a lista o conhece. */
  viewportEnteredAt: number | null;
};

/**
 * `mediaVisible` e o instante de entrada na viewport de um cartão, assinados
 * pelo `postId` em uma única assinatura.
 *
 * Sem provider (cartão isolado, prévia, harness) o default é `false` e não há
 * marco de viewport. Um valor explícito vence a assinatura — é o caso da prévia
 * do composer e dos testes que montam um único cartão; nesse caminho não existe
 * viewport de lista para medir.
 */
export function useMediaVisibility(postId: string, override?: boolean): MediaVisibilityState {
  const visibility = useContext(MediaVisibilityContext);
  const enabled = visibility !== null && override === undefined;
  const subscribe = useCallback((notify: () => void) => {
    if (!enabled || !visibility) return () => {};
    return visibility.subscribe(postId, notify);
  }, [enabled, visibility, postId]);
  const getSnapshot = useCallback(
    () => (enabled && visibility ? visibility.visibleSince(postId) : null),
    [enabled, visibility, postId],
  );
  const enteredAt = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (override !== undefined) return { visible: override, viewportEnteredAt: null };
  return { visible: enteredAt !== null, viewportEnteredAt: enteredAt };
}

/** `mediaVisible` de um cartão. Mantém o contrato booleano usado pelos cartões. */
export function useMediaVisible(postId: string, override?: boolean): boolean {
  return useMediaVisibility(postId, override).visible;
}

export const mediaViewabilityConfig = { itemVisiblePercentThreshold: 20, minimumViewTime: 100 };
