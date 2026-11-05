import { createContext, createElement, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { ViewToken } from '@shopify/flash-list';

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
  subscribe: (postId: string, listener: VisibilityListener) => () => void;
  onViewableItemsChanged: (info: { viewableItems: ViewToken<unknown>[] }) => void;
  /** Esquece a viewport atual (troca de aba, por exemplo). */
  clear: () => void;
};

function createMediaVisibility(): MediaVisibility {
  let visible: ReadonlySet<string> = new Set();
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
    isVisible: (postId) => visible.has(postId),
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
      visible = next;
      notify(entered);
      notify(left);
    },
    clear: () => {
      if (visible.size === 0) return;
      const previous = visible;
      visible = new Set();
      notify(previous);
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

/**
 * `mediaVisible` de um cartão, assinado pelo `postId`.
 *
 * Sem provider (cartão isolado, prévia, harness) o default é `false`, como no
 * `PostCard`. Um valor explícito vence a assinatura — é o caso da prévia do
 * composer e dos testes que montam um único cartão.
 */
export function useMediaVisible(postId: string, override?: boolean): boolean {
  const visibility = useContext(MediaVisibilityContext);
  const enabled = visibility !== null && override === undefined;
  const subscribe = useCallback((notify: () => void) => {
    if (!enabled || !visibility) return () => {};
    return visibility.subscribe(postId, notify);
  }, [enabled, visibility, postId]);
  const getSnapshot = useCallback(() => enabled && visibility ? visibility.isVisible(postId) : false, [enabled, visibility, postId]);
  const subscribed = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return override ?? subscribed;
}

export const mediaViewabilityConfig = { itemVisiblePercentThreshold: 20, minimumViewTime: 100 };
