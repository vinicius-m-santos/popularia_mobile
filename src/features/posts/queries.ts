import { queryOptions, useQuery } from '@tanstack/react-query';
import { getDiscussionPost } from '@/features/discussion/api';
import { accessDenied, contentPolicy, queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

export const postOptions = (id: string) => queryOptions({
  queryKey: ['post', id],
  queryFn: ({ signal }) => getDiscussionPost(id, signal),
  ...contentPolicy.post,
});

/** Só no toque: reaproveita o cartão e antecipa uma request de detalhe, sem mídia. */
export function preparePost(item: FeedItem) {
  queryClient.setQueryDefaults(['post-preview'], { gcTime: contentPolicy.post.gcTime });
  queryClient.setQueryData(['post-preview', item.id], item);
  void queryClient.prefetchQuery(postOptions(item.id));
}

export function useCachedPost(id: string, localPost: FeedItem | null) {
  const query = useQuery({ ...postOptions(id), enabled: !localPost,
    placeholderData: () => queryClient.getQueryData<FeedItem>(['post-preview', id]),
  }, queryClient);
  return {
    data: localPost ?? (accessDenied(query.error) ? null : query.data ?? null),
    status: query.isPending ? 'loading' as const : query.isError ? 'error' as const : 'success' as const,
    error: query.error, reload: query.refetch,
  };
}
