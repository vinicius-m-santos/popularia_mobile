import { queryOptions, useQuery } from '@tanstack/react-query';

import { accessDenied, contentPolicy, queryClient } from '@/lib/query/client';
import type { ComunaDetails } from '@/types/models';

import { getComuna } from './api';
import { comunaKeys, placeholderComunaDetails, rememberComunaSummary } from './keys';

/**
 * Detalhe compartilhado da comuna. A mesma chave é usada pela página, pela
 * gestão, pela moderação e pela lista de eventos: abrir uma delas depois da
 * outra não repete a requisição enquanto o dado estiver fresco.
 */
export const comunaOptions = (slug: string) => queryOptions({
  queryKey: comunaKeys.detail(slug),
  queryFn: () => getComuna(slug),
  ...contentPolicy.comuna,
  placeholderData: () => placeholderComunaDetails(slug),
});

/** Mesma forma de `useAsyncData`, para as telas de comuna manterem o contrato atual. */
export function useComuna(slug: string) {
  const query = useQuery(comunaOptions(slug), queryClient);
  // Uma falha de revalidação mantém o conteúdo e mostra o aviso, como o useAsyncData antigo.
  const failed = query.isError || query.isRefetchError;
  return {
    data: accessDenied(query.error) ? null : query.data ?? null,
    status: (query.isPending ? 'loading' : failed ? 'error' : 'success') as 'loading' | 'success' | 'error',
    error: query.error,
    reload: query.refetch,
  };
}

/** Invalida as leituras derivadas de uma comuna; o detalhe é atualizado por quem chamou. */
export async function invalidateComunaReads(slug: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: comunaKeys.posts(slug) }),
    queryClient.invalidateQueries({ queryKey: comunaKeys.pins(slug) }),
    queryClient.invalidateQueries({ queryKey: comunaKeys.square(slug) }),
    queryClient.invalidateQueries({ queryKey: comunaKeys.eventsAll(slug) }),
  ]);
}

/** Grava o detalhe devolvido por uma edição/arquivamento no cache compartilhado. */
export function writeComuna(comuna: ComunaDetails): void {
  queryClient.setQueryData(comunaKeys.detail(comuna.id), comuna);
  rememberComunaSummary(comuna);
}
