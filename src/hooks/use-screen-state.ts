import { useCallback, useEffect, useRef, useState } from 'react';

import { readScreenMemory, writeScreenMemory } from '@/lib/screen-memory';

function resolveInitial<T>(initial: T | (() => T)): T {
  return typeof initial === 'function' ? (initial as () => T)() : initial;
}

/**
 * Estado de interface que sobrevive à remontagem da mesma tela.
 *
 * Diferente do cache de dados, este valor não é revalidado nem vem do
 * servidor: é o que a pessoa digitou/selecionou. `restore: false` permite que
 * um parâmetro explícito da rota (um assunto aberto por link, por exemplo)
 * vença a memória da visita anterior.
 */
export function useScreenState<T>(
  key: string,
  initial: T | (() => T),
  { restore = true }: { restore?: boolean } = {},
) {
  const [value, setValue] = useState<T>(() => {
    const saved = restore ? readScreenMemory<T>(key) : undefined;
    return saved === undefined ? resolveInitial(initial) : saved;
  });
  const keyRef = useRef(key);

  // A chave normalmente acompanha uma `key` de React ou uma rota nova; ainda
  // assim, trocá-la em tempo de vida não pode manter o valor da tela anterior.
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    const saved = restore ? readScreenMemory<T>(key) : undefined;
    setValue(saved === undefined ? resolveInitial(initial) : saved);
    // `initial` é usado apenas na troca de chave; incluí-lo recriaria o efeito
    // quando o valor inicial é um objeto novo a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, restore]);

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
        writeScreenMemory(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}
