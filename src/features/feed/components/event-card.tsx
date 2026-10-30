import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useEventAttendance } from '@/features/interactions/use-post-actions';
import { eventDateParts, formatCount } from '@/lib/format';
import { useNav } from '@/lib/routes';
import type { CommunityEvent, Tone } from '@/types/models';

const CARD_COLORS: Record<Tone, { bg: string; fg: string; accent: string; btnBg: string; btnFg: string }> = {
  red: { bg: Colors.red, fg: Colors.paper, accent: Colors.redPressed, btnBg: Colors.paper, btnFg: Colors.ink },
  black: { bg: Colors.ink, fg: Colors.cream, accent: Colors.red, btnBg: Colors.red, btnFg: Colors.paper },
  cream: { bg: Colors.straw, fg: Colors.ink, accent: Colors.strawDark, btnBg: Colors.ink, btnFg: Colors.cream },
};

export const EVENT_CARD_WIDTH = 232;

/** Cartão de "Chamados da semana", no padrão visual do cartão da Biblioteca (arte + conteúdo
 * ancorado embaixo). Tocar abre a comuna; "Vou" marca presença local. */
export function EventCard({ event }: { event: CommunityEvent }) {
  const c = CARD_COLORS[event.tone];
  const date = eventDateParts(event.startsAt);
  const { going, attendeeCount, toggleGoing } = useEventAttendance(event);
  const nav = useNav();

  return (
    <View style={[styles.card, { backgroundColor: c.bg }]}>
      <View style={styles.art} pointerEvents="none">
        <View style={[styles.planet, { backgroundColor: c.accent }]} />
        <View style={styles.watermark}>
          <Icon name="calendar" size={92} color={c.accent} />
        </View>
      </View>
      <Pressable
        onPress={() => nav.openComuna(event.comunaId)}
        accessibilityRole="button"
        accessibilityLabel={`${event.kind}: ${event.title}. ${date.weekday}, ${date.day} de ${date.month}, ${date.hour}. ${event.place}`}
        accessibilityHint="Abre a página da comuna"
        style={styles.body}>
        <AppText style={styles.meta} color={c.fg}>
          {event.kind} · {date.weekday} {date.day} {date.month} · {date.hour}
        </AppText>
        <AppText style={styles.title} color={c.fg} numberOfLines={2}>
          {event.title}
        </AppText>
        <AppText style={styles.place} color={c.fg} numberOfLines={1}>
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
    position: 'relative',
    overflow: 'hidden',
    padding: 14,
    justifyContent: 'space-between',
    gap: Spacing.two + 2,
  },
  art: {
    position: 'absolute',
    inset: 0,
  },
  planet: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    right: -48,
    top: -56,
    opacity: 0.5,
  },
  watermark: {
    position: 'absolute',
    right: -14,
    bottom: -16,
    opacity: 0.35,
    transform: [{ rotate: '-12deg' }],
  },
  body: {
    gap: 0,
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
    borderRadius: Radius.sm,
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
