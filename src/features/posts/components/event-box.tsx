import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useEventAttendance } from '@/features/interactions/use-post-actions';
import { eventDateParts, formatCount } from '@/lib/format';
import type { CommunityEvent } from '@/types/models';

/** Chamado anexado a uma publicação: cartaz com data em bloco vermelho e confirmação. */
export function EventBox({ event }: { event: CommunityEvent }) {
  const date = eventDateParts(event.startsAt);
  const { going, attendeeCount, toggleGoing } = useEventAttendance(event);

  return (
    <View style={styles.shadow}>
      <View style={styles.box}>
        <View
          style={styles.top}
          accessible
          accessibilityLabel={`${event.kind}: ${event.title}. ${date.weekday}, ${date.day} de ${date.month}, ${date.hour}. ${event.place}. ${formatCount(attendeeCount)} pessoas vão.`}>
          <View style={styles.date}>
            <AppText style={styles.weekday} color={Colors.paper}>{date.weekday}</AppText>
            <AppText style={styles.day} color={Colors.paper} maxFontSizeMultiplier={1.2}>{date.day}</AppText>
            <AppText style={styles.month} color={Colors.paper}>{date.month}</AppText>
            <View style={styles.hour}>
              <AppText style={styles.hourText} color={Colors.cream}>{date.hour}</AppText>
            </View>
          </View>
          <View style={styles.info}>
            <AppText style={styles.kind} color={Colors.red}>{event.kind}</AppText>
            <AppText style={styles.title}>{event.title}</AppText>
            <AppText style={styles.place}>{event.place}</AppText>
            <AppText style={styles.count}>{formatCount(attendeeCount)} vão</AppText>
          </View>
        </View>
        <Pressable
          onPress={toggleGoing}
          accessibilityRole="button"
          accessibilityState={{ selected: going }}
          accessibilityLabel={`${going ? 'Cancelar presença' : 'Confirmar presença'}: ${event.title}`}
          style={({ pressed }) => [styles.rsvp, going && styles.rsvpGoing, pressed && styles.pressed]}>
          <AppText style={styles.rsvpText} color={going ? Colors.cream : Colors.paper}>
            {going ? 'Confirmado' : 'Eu vou'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  box: {
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  date: {
    width: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.red,
    borderRightWidth: 2,
    borderRightColor: Colors.ink,
  },
  weekday: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  day: {
    fontFamily: Fonts.anton,
    fontSize: 46,
    lineHeight: 48,
  },
  month: {
    fontFamily: Fonts.anton,
    fontSize: 19,
    lineHeight: 21,
    textTransform: 'uppercase',
  },
  hour: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: Colors.ink,
  },
  hourText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    padding: Spacing.three,
    justifyContent: 'center',
  },
  kind: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.anton,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  place: {
    fontSize: 13,
    lineHeight: 17,
    color: Colors.inkSoft,
  },
  count: {
    fontSize: 13,
    lineHeight: 17,
    color: Colors.muted,
  },
  rsvp: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.red,
  },
  rsvpGoing: {
    backgroundColor: Colors.ink,
  },
  rsvpText: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: 24,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});
