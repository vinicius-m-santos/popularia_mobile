import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Spacing } from '@/constants/theme';
import { openDestination } from '@/features/links/destinations';
import type { LinkedEvent } from '@/types/models';

import { attendanceCount, formatPoster } from './format';

/** Chamada dentro de uma publicação da mesma comuna. O post não é obrigatório para o evento existir. */
export function LinkedEventCallout({ event }: { event: LinkedEvent }) {
  const when = formatPoster(event.startsAt, event.timeZone);
  return (
    <Pressable
      onPress={() => openDestination({ kind: 'event', id: event.id })}
      accessibilityRole="link"
      accessibilityLabel={`Atividade ${event.title}`}
      style={styles.callout}>
      <AppText variant="label" color={Colors.red}>{event.status === 'cancelled' ? 'Evento cancelado' : 'Atividade'}</AppText>
      <AppText variant="heading">{event.title}</AppText>
      <AppText variant="caption">{when.day} {when.month} · {when.time}{event.placeName ? ` · ${event.placeName}` : ''}</AppText>
      <AppText variant="caption">{attendanceCount(event.goingCount, event.maybeCount)}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  callout: { marginTop: Spacing.three, gap: Spacing.half, borderTopWidth: 1.5, borderTopColor: Colors.ink, paddingTop: Spacing.three },
});
