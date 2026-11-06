import { useEffect } from 'react';

type FocusEffect = () => void | (() => void);

type Entry = {
  effect: FocusEffect;
  cleanup?: () => void;
};

let focused = true;
const entries = new Set<Entry>();

/**
 * `useFocusEffect` controlável para testes.
 *
 * Diferente de um `useState` local, trocar o foco não re-renderiza a tela:
 * apenas roda o cleanup (blur) ou o efeito (focus), como o listener real do
 * navegador. Assim as props da lista continuam estáveis durante o push/back.
 */
export function useMockFocusEffect(effect: FocusEffect): void {
  useEffect(() => {
    const entry: Entry = { effect };
    entries.add(entry);
    if (focused) {
      const cleanup = effect();
      if (typeof cleanup === 'function') entry.cleanup = cleanup;
    }
    return () => {
      if (typeof entry.cleanup === 'function') entry.cleanup();
      entries.delete(entry);
    };
  }, [effect]);
}

export function setMockRouteFocused(next: boolean): void {
  focused = next;
  for (const entry of [...entries]) {
    if (next) {
      if (entry.cleanup === undefined) {
        const cleanup = entry.effect();
        if (typeof cleanup === 'function') entry.cleanup = cleanup;
      }
    } else {
      if (typeof entry.cleanup === 'function') entry.cleanup();
      entry.cleanup = undefined;
    }
  }
}

export function resetMockRouteFocused(): void {
  focused = true;
  entries.clear();
}
