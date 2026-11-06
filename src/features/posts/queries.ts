import { queryOptions, useQuery, type QueryKey } from '@tanstack/react-query';

import { getDiscussionPost } from '@/features/discussion/api';
import { accessDenied, contentPolicy, prefetchQueryOnce, queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { FeedItem } from '@/types/models';

/** Chaves canônicas do detalhe e do cartão usado como placeholder. */
export const postKeys = {
  detail: (id: string): QueryKey => queryKeys.post.detail(id),
  previewRoot: queryKeys.post.previewAll,
  preview: (id: string): QueryKey => queryKeys.post.preview(id),
};

export const postOptions = (id: string) => queryOptions({
  queryKey: queryKeys.post.detail(id),
  queryFn: ({ signal }) => getDiscussionPost(id, signal),
  ...contentPolicy.post,
});

/**
 * Aquece a publicação antes da navegação: guarda o cartão como placeholder e
 * antecipa a leitura do detalhe. O `onPress` não repete o prefetch — só navega.
 * A tela de destino busca por conta própria se o prefetch falhar ou ainda não
 * tiver terminado.
 */
export function preparePost(item: FeedItem): Promise<void> {
  queryClient.setQueryDefaults(postKeys.previewRoot, { gcTime: contentPolicy.post.gcTime });
  const previewKey = postKeys.preview(item.id);
  if (queryClient.getQueryData<FeedItem>(previewKey) !== item) {
    queryClient.setQueryData(previewKey, item);
  }
  return prefetchQueryOnce(postOptions(item.id));
}

export function useCachedPost(id: string, localPost: FeedItem | null) {
  const query = useQuery({ ...postOptions(id), enabled: !localPost,
    placeholderData: () => queryClient.getQueryData<FeedItem>(postKeys.preview(id)),
  }, queryClient);
  return {
    data: localPost ?? (accessDenied(query.error) ? null : query.data ?? null),
    status: query.isPending ? 'loading' as const : query.isError ? 'error' as const : 'success' as const,
    error: query.error, reload: query.refetch,
  };
}
