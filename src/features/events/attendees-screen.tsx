import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PopulariaList } from '@/components/list/popularia-list';
import { Screen } from '@/components/screen';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { toUser } from '@/features/posts/api';
import { PersonRow } from '@/features/profiles/components/person-row';
import { ApiError, NotFoundError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import { useNav } from '@/lib/routes';

import { listAttendees } from './api';
import { EventBar } from './chrome';
import { attendeesKey } from './types';

type AttendanceList = 'going' | 'maybe';
const TABS: TabOption<AttendanceList>[] = [
  { key: 'going', label: 'Vão' },
  { key: 'maybe', label: 'Talvez' },
];

export default function AttendeesScreen() {
  const { id, status: initial } = useLocalSearchParams<{ id: string; status?: string }>();
  const [status, setStatus] = useState<AttendanceList>(initial === 'maybe' ? 'maybe' : 'going');
  const nav = useNav();
  const list = useInfiniteQuery({
    queryKey: attendeesKey(id, status),
    queryFn: ({ pageParam, signal }) => listAttendees(id, status, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: !!id,
    retry: false,
  }, queryClient);
  const missing = list.error instanceof NotFoundError || (list.error instanceof ApiError && [403, 404].includes(list.error.status));
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  return <Screen>
    <EventBar title="Presenças" />
    <UnderlineTabs options={TABS} value={status} onChange={setStatus} ruled />
    {missing ? (
      <PopulariaList data={[]} keyExtractor={() => 'none'} emptyTitle="Lista indisponível" emptyMessage="Este evento não está disponível." renderItem={() => null} />
    ) : (
      <PopulariaList
        data={items}
        keyExtractor={(item) => item.id}
        state={{
          status: list.isPending ? 'loading' : list.isError ? 'error' : 'success',
          hasMore: !!list.hasNextPage,
          loadingMore: list.isFetchingNextPage,
          loadMoreError: list.isFetchNextPageError ? list.error : null,
          isRefreshing: list.isRefetching && !list.isFetchingNextPage && !list.isPending,
          refreshError: null,
          refresh: () => { void list.refetch(); },
          loadMore: () => { void list.fetchNextPage(); },
        }}
        emptyTitle={status === 'going' ? 'Ninguém confirmou ainda' : 'Ninguém marcou talvez'}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const user = toUser(item);
          return <PersonRow user={user} subtitle={`@${user.handle}`} onOpen={() => nav.openProfile(user.id)} />;
        }}
      />
    )}
  </Screen>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 18 },
});
