import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import type { MediaVisibility } from './use-list-visibility';

/**
 * Liga a mídia de uma lista ao foco da rota.
 *
 * Ao perder o foco (push de uma publicação, troca de aba, tela coberta), a
 * viewport atual deixa de valer para montagem: os cartões visíveis voltam ao
 * pôster e nenhum player novo é montado. A janela é mantida para o retorno,
 * quando só os IDs que continuam visíveis são reabilitados. Isso preserva a
 * posição da lista sem deixar vídeo tocando numa rota sem foco.
 */
export function useRouteMediaFocus(visibility: MediaVisibility): void {
  useFocusEffect(
    useCallback(() => {
      visibility.setFocused(true);
      return () => visibility.setFocused(false);
    }, [visibility]),
  );
}
