import { useMemo } from 'react';

import { useMe } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { toFeedItems } from '@/features/lookup';
import type { FeedItem } from '@/types/models';

/**
 * Publicações criadas nesta sessão, prontas para exibição. Ficam só neste
 * aparelho: as telas as somam às que vêm da API, como os comentários locais.
 */
export function useLocalFeedItems(filter?: (item: FeedItem) => boolean): FeedItem[] {
  const { localPosts } = useInteractions();
  const me = useMe();
  const items = useMemo(
    () => toFeedItems(localPosts).map((item) => ({ ...item, author: me })),
    [localPosts, me],
  );
  return filter ? items.filter(filter) : items;
}
