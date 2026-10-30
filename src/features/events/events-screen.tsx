import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { PopulariaList } from '@/components/list/popularia-list';
import { Screen } from '@/components/screen';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getComuna } from '@/features/comunas/api';
import { openDestination } from '@/features/links/destinations';
import { ApiError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';

import { listEvents } from './api';
import { EventBar } from './chrome';
import { attendanceCount, formatPoster } from './format';
import { comunaEventsKey, type ComunaEvent, type EventWhen } from './types';

const TABS: TabOption<EventWhen>[] = [
  { key: 'upcoming', label: 'Próximos' },
  { key: 'past', label: 'Passados' },
];

export default function EventsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [when, setWhen] = useState<EventWhen>('upcoming');
  const comuna = useQuery({ queryKey: ['comuna-brief', slug], queryFn: () => getComuna(slug), enabled: !!slug, retry: false }, queryClient);
  const list = useInfiniteQuery({
    queryKey: comunaEventsKey(slug, when),
    queryFn: ({ pageParam, signal }) => listEvents(slug, when, pageParam, 20, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: !!slug,
    retry: false,
  }, queryClient);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const canManage = !!comuna.data?.viewerPermissions?.canManageEvents;
  const privateDenied = list.error instanceof ApiError && list.error.type === '/errors/comuna-private';

  return <Screen>
    <EventBar title="Eventos" />
    <View style={styles.column}>
      <UnderlineTabs options={TABS} value={when} onChange={setWhen} ruled />
      {canManage && when === 'upcoming' ? (
        <EditorialAction label="Nova atividade" icon="plus" tone="red" onPress={() => router.push({ pathname: '/eventos/[slug]/novo', params: { slug } })} />
      ) : null}
    </View>
    {privateDenied ? (
      <View style={styles.column}><AppText>Você não pode ver os eventos desta comuna.</AppText></View>
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
        emptyTitle={when === 'upcoming' ? 'Nenhuma atividade marcada' : 'Nenhuma atividade passada'}
        emptyMessage={when === 'upcoming' ? 'Quando a moderação marcar uma atividade, ela aparece aqui.' : undefined}
        renderItem={({ item }) => <EventRow item={item} />}
        contentContainerStyle={styles.list}
      />
    )}
  </Screen>;
}

function EventRow({ item }: { item: ComunaEvent }) {
  const when = formatPoster(item.startsAt, item.timeZone);
  return (
    <Pressable
      onPress={() => openDestination({ kind: 'event', id: item.id })}
      accessibilityRole="link"
      accessibilityLabel={`${item.status === 'cancelled' ? 'Evento cancelado. ' : ''}${item.title}. ${when.day} ${when.month} ${when.time}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {item.status === 'cancelled' ? <AppText variant="label" color={Colors.red}>Evento cancelado</AppText> : null}
      <AppText variant="heading">{item.title}</AppText>
      <AppText variant="label">{when.day} {when.month} · {when.weekday} · {when.time}</AppText>
      {item.placeName ? <AppText variant="caption" numberOfLines={1}>{item.placeName}</AppText> : null}
      <AppText variant="caption">{attendanceCount(item.goingCount, item.maybeCount)}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.five, gap: Spacing.three, paddingTop: Spacing.three },
  list: { paddingHorizontal: Spacing.five, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { paddingVertical: Spacing.four, gap: Spacing.one, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  pressed: { opacity: 0.7 },
});
