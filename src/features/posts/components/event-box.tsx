import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useEventAttendance } from '@/features/interactions/use-post-actions';
import { eventDateParts, formatCount } from '@/lib/format';
import type { CommunityEvent } from '@/types/models';

/** Chamado anexado a uma publicação: data em bloco vermelho e botão "Vou". */
export function EventBox({ event }: { event: CommunityEvent }) {
  const date = eventDateParts(event.startsAt);
  const { going, attendeeCount, toggleGoing } = useEventAttendance(event);

  return (
    <View style={styles.box}>
      <View
        style={styles.info}
        accessible
        accessibilityLabel={`${event.kind}: ${event.title}. ${date.weekday}, ${date.day} de ${date.month}, ${date.hour}. ${event.place}. ${formatCount(attendeeCount)} pessoas vão.`}>
        <View style={styles.date}>
          <AppText style={styles.month} color={Colors.paper}>
            {date.month}
          </AppText>
          <AppText style={styles.day} color={Colors.paper} maxFontSizeMultiplier={1.2}>
            {date.day}
          </AppText>
        </View>
        <View style={styles.body}>
          <AppText variant="label" color={Colors.red} style={styles.meta}>
            {event.kind} · {date.weekday} · {date.hour}
          </AppText>
          <AppText variant="heading" style={styles.title}>
            {event.title}
          </AppText>
          <AppText variant="caption" style={styles.place}>
            {event.place} · {formatCount(attendeeCount)} vão
          </AppText>
        </View>
      </View>
      <PillButton
        label={going ? 'Confirmado' : 'Vou'}
        onPress={toggleGoing}
        variant={going ? 'dark' : 'primary'}
        size="sm"
        selected={going}
        accessibilityLabel={`Vou: ${event.title}`}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.paper,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  date: {
    width: 62,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  month: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  day: {
    fontFamily: Fonts.condensed,
    fontSize: 32,
    lineHeight: 34,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  meta: {
    fontSize: 10,
  },
  title: {
    fontSize: 19,
    lineHeight: 21,
    marginTop: 2,
  },
  place: {
    fontSize: 12.5,
    marginTop: 2,
  },
  button: {
    marginRight: Spacing.two + 2,
  },
});
