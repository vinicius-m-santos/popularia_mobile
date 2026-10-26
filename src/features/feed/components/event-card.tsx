import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useEventAttendance } from '@/features/interactions/use-post-actions';
import { eventDateParts, formatCount } from '@/lib/format';
import { useNav } from '@/lib/routes';
import type { CommunityEvent, Tone } from '@/types/models';

const CARD_COLORS: Record<Tone, { bg: string; fg: string; btnBg: string; btnFg: string }> = {
  red: { bg: Colors.red, fg: Colors.paper, btnBg: Colors.paper, btnFg: Colors.ink },
  black: { bg: Colors.ink, fg: Colors.cream, btnBg: Colors.red, btnFg: Colors.paper },
  cream: { bg: Colors.straw, fg: Colors.ink, btnBg: Colors.ink, btnFg: Colors.cream },
};

export const EVENT_CARD_WIDTH = 232;

/** Cartão de "Chamados da semana". Tocar abre a comuna; "Vou" marca presença local. */
export function EventCard({ event }: { event: CommunityEvent }) {
  const c = CARD_COLORS[event.tone];
  const date = eventDateParts(event.startsAt);
  const { going, attendeeCount, toggleGoing } = useEventAttendance(event);
  const nav = useNav();

  return (
    <View style={[styles.card, { backgroundColor: c.bg }]}>
      <Pressable
        onPress={() => nav.openComuna(event.comunaId)}
        accessibilityRole="button"
        accessibilityLabel={`${event.kind}: ${event.title}. ${date.weekday}, ${date.day} de ${date.month}, ${date.hour}. ${event.place}`}
        accessibilityHint="Abre a página da comuna">
        <AppText style={styles.meta} color={c.fg}>
          {event.kind} · {date.weekday} {date.day} {date.month} · {date.hour}
        </AppText>
        <AppText style={styles.title} color={c.fg}>
          {event.title}
        </AppText>
        <AppText style={styles.place} color={c.fg}>
          {event.place}
        </AppText>
      </Pressable>
      <View style={styles.footer}>
        <AppText style={styles.going} color={c.fg}>
          {formatCount(attendeeCount)} vão
        </AppText>
        <Pressable
          onPress={toggleGoing}
          accessibilityRole="button"
          accessibilityLabel={`Vou: ${event.title}`}
          accessibilityState={{ selected: going }}
          hitSlop={5}
          style={({ pressed }) => [
            styles.button,
            going
              ? { backgroundColor: 'transparent', borderColor: c.fg }
              : { backgroundColor: c.btnBg, borderColor: c.btnBg },
            pressed && styles.pressed,
          ]}>
          <AppText style={styles.buttonLabel} color={going ? c.fg : c.btnFg}>
            {going ? '✓ Confirmado' : 'Vou'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: EVENT_CARD_WIDTH,
    minHeight: 148,
    borderRadius: Radius.xl,
    padding: 14,
    justifyContent: 'space-between',
    gap: Spacing.two + 2,
  },
  meta: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 27,
    lineHeight: 27,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  place: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  going: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
  },
  button: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.75,
  },
});
