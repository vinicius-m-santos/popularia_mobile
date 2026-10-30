import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Spacing } from '@/constants/theme';
import { openDestination } from '@/features/links/destinations';
import { queryClient } from '@/lib/query/client';

import { listEvents } from './api';
import { attendanceCount, formatPoster } from './format';
import { comunaEventsKey } from './types';

/** Faixa curta na comuna. Some quando não há atividade, para não ocupar a página. */
export function NextEvent({ slug }: { slug: string }) {
  const preview = useQuery({
    queryKey: comunaEventsKey(slug, 'preview'),
    queryFn: ({ signal }) => listEvents(slug, 'upcoming', null, 5, signal),
    retry: false,
    staleTime: 15_000,
  }, queryClient);
  if (preview.isError) {
    return (
      <Pressable onPress={() => { void preview.refetch(); }} accessibilityRole="button" style={styles.block}>
        <AppText variant="label">Próximo evento</AppText>
        <AppText variant="caption">Não foi possível carregar. Toque para tentar de novo.</AppText>
      </Pressable>
    );
  }
  const items = preview.data?.items ?? [];
  const next = items.find((item) => item.status !== 'cancelled') ?? items[0];
  if (!next) return null;
  const when = formatPoster(next.startsAt, next.timeZone);
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <AppText variant="label">Próximo evento</AppText>
        <Pressable onPress={() => router.push({ pathname: '/eventos/[slug]', params: { slug } })} accessibilityRole="link" accessibilityLabel="Ver atividades">
          <AppText variant="label" color={Colors.red}>Ver todas</AppText>
        </Pressable>
      </View>
      <Pressable onPress={() => openDestination({ kind: 'event', id: next.id })} accessibilityRole="link" accessibilityLabel={`${next.title}. ${when.day} ${when.month} ${when.time}`}>
        {next.status === 'cancelled' ? <AppText variant="label" color={Colors.red}>Evento cancelado</AppText> : null}
        <AppText variant="heading">{next.title}</AppText>
        <AppText variant="label">{when.day} {when.month} · {when.time}</AppText>
        {next.placeName ? <AppText variant="caption" numberOfLines={1}>{next.placeName}</AppText> : null}
        <AppText variant="caption">{attendanceCount(next.goingCount, next.maybeCount)}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: Spacing.four, gap: Spacing.two, borderBottomWidth: 1.5, borderBottomColor: Colors.ink },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three },
});
