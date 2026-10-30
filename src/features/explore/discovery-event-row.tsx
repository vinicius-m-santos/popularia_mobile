import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Spacing } from '@/constants/theme';
import { attendanceCount, formatPoster } from '@/features/events/format';
import type { ComunaEvent } from '@/features/events/types';
import { openDestination } from '@/features/links/destinations';

/** Linha de evento na busca. O toque abre o evento, não a comuna. */
export function DiscoveryEventRow({ event }: { event: ComunaEvent }) {
  const when = formatPoster(event.startsAt, event.timeZone);
  const place = event.placeName ?? (event.format === 'online' ? 'Online' : '');
  return (
    <Pressable
      onPress={() => openDestination({ kind: 'event', id: event.id })}
      accessibilityRole="link"
      accessibilityLabel={`${event.status === 'cancelled' ? 'Evento cancelado. ' : ''}${event.title}. ${when.day} ${when.month} ${when.time}. ${event.comuna.name}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>
        <AppText variant="label" color={Colors.red} numberOfLines={1}>{event.status === 'cancelled' ? 'Evento cancelado' : event.past ? 'Evento passado' : 'Evento'}</AppText>
        <AppText variant="bodyStrong" numberOfLines={2}>{event.title}</AppText>
        <AppText variant="caption" numberOfLines={1}>{event.comuna.name} · {when.day} {when.month} · {when.time}</AppText>
        {place ? <AppText variant="caption" numberOfLines={1}>{place}</AppText> : null}
        {event.description ? <AppText variant="caption" numberOfLines={2}>{event.description}</AppText> : null}
        <AppText variant="caption">{attendanceCount(event.goingCount, event.maybeCount)}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  text: { gap: Spacing.one },
  pressed: { opacity: 0.75 },
});
