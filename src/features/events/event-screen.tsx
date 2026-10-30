import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { openDestination } from '@/features/links/destinations';
import { shareDestination } from '@/features/links/share';
import { ApiError, describeError, NotFoundError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import { useNav } from '@/lib/routes';

import { cancelEvent, getEvent } from './api';
import { EventBar } from './chrome';
import { attendanceCount, formatPoster, mapsLink } from './format';
import { setAttendance, storeEvent } from './rsvp';
import { eventQueryKey, type AttendanceStatus, type ComunaEvent } from './types';

const CHOICES: { status: AttendanceStatus; label: string; icon: 'check' | 'more' | 'close' }[] = [
  { status: 'going', label: 'Vou', icon: 'check' },
  { status: 'maybe', label: 'Talvez', icon: 'more' },
  { status: 'not_going', label: 'Não vou', icon: 'close' },
];

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useQuery({
    queryKey: eventQueryKey(id),
    queryFn: ({ signal }) => getEvent(id, signal),
    enabled: !!id,
    retry: false,
  }, queryClient);
  const toast = useToast();
  const nav = useNav();
  const alive = useRef(true);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const respond = (status: AttendanceStatus) => {
    const current = event.data;
    if (!current || pending) return;
    setPending(true);
    void setAttendance(current, status)
      .catch((error: unknown) => { if (alive.current) toast.show(describeError(error)); })
      .finally(() => { if (alive.current) setPending(false); });
  };

  const cancel = () => {
    const current = event.data;
    if (!current || pending) return;
    Alert.alert('Cancelar esta atividade?', 'Quem respondeu Vou ou Talvez será avisado. A atividade continua visível como cancelada.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar atividade', style: 'destructive', onPress: () => {
        setPending(true);
        void cancelEvent(current.id)
          .then((saved) => { storeEvent(saved); if (alive.current) toast.show('Atividade cancelada.'); })
          .catch((error: unknown) => { if (alive.current) toast.show(describeError(error)); })
          .finally(() => { if (alive.current) setPending(false); });
      } },
    ]);
  };

  if (event.isPending) {
    return <Screen><EventBar title="Evento" /><StateView kind="loading" message="Abrindo a atividade" /></Screen>;
  }
  if (event.isError || !event.data) {
    const missing = event.error instanceof NotFoundError || (event.error instanceof ApiError && [403, 404].includes(event.error.status));
    return <Screen>
      <EventBar title="Evento" />
      {missing
        ? <StateView kind="empty" title="Evento indisponível" message="Este evento não está disponível." />
        : <StateView kind="error" message="Não conseguimos carregar este evento." onRetry={() => { void event.refetch(); }} />}
    </Screen>;
  }

  const data = event.data;
  return <Screen>
    <EventBar title="Evento" action={<IconButton icon="share" accessibilityLabel="Compartilhar evento" onPress={() => { void shareDestination({ kind: 'event', id: data.id }); }} />} />
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
      <EventPoster event={data} onOpenComuna={() => openDestination({ kind: 'comuna', id: data.comuna.slug })} onOpenCounts={() => router.push({ pathname: '/evento/[id]/participantes', params: { id: data.id, status: data.goingCount > 0 ? 'going' : 'maybe' } })} />
      {data.canRespond ? (
        <View style={styles.rsvp}>
          {CHOICES.map((choice) => (
            <EditorialAction
              key={choice.status}
              label={choice.label}
              icon={choice.icon}
              tone={data.viewerAttendance === choice.status ? 'red' : 'paper'}
              disabled={pending}
              accessibilityLabel={data.viewerAttendance === choice.status ? `${choice.label}, selecionado` : choice.label}
              onPress={() => respond(choice.status)}
              style={styles.rsvpChoice}
            />
          ))}
        </View>
      ) : (
        <AppText variant="caption" style={styles.note}>
          {data.status === 'cancelled' ? 'Uma atividade cancelada não aceita nova resposta.' : data.past ? 'Esta atividade já aconteceu.' : 'Não é possível responder agora.'}
        </AppText>
      )}
      {data.organizer ? (
        <Pressable onPress={() => nav.openProfile(data.organizer!.id)} accessibilityRole="link" accessibilityLabel={`Organização, ${data.organizer.name}`}>
          <AppText variant="label">Organização</AppText>
          <AppText variant="bodyStrong">{data.organizer.name}</AppText>
          <AppText variant="caption">@{data.organizer.handle}</AppText>
        </Pressable>
      ) : (
        <View>
          <AppText variant="label">Organização</AppText>
          <AppText variant="body">Conta indisponível</AppText>
        </View>
      )}
      {data.canManage ? (
        <View style={styles.admin}>
          <EditorialAction label="Editar evento" icon="edit" onPress={() => router.push({ pathname: '/evento/[id]/editar', params: { id: data.id } })} disabled={pending} />
          <EditorialAction label="Cancelar evento" icon="close" onPress={cancel} disabled={pending} />
        </View>
      ) : null}
    </ScrollView>
  </Screen>;
}

function EventPoster({ event, onOpenComuna, onOpenCounts }: { event: ComunaEvent; onOpenComuna: () => void; onOpenCounts: () => void }) {
  const when = formatPoster(event.startsAt, event.timeZone);
  const end = event.endsAt ? formatPoster(event.endsAt, event.timeZone) : null;
  const sameDay = !!end && end.day === when.day && end.month === when.month;
  const map = mapsLink(event.address);
  return (
    <View style={styles.poster}>
      <Pressable onPress={onOpenComuna} accessibilityRole="link" accessibilityLabel={`Comuna ${event.comuna.name}`}>
        <AppText variant="label" color={Colors.red}>c/ {event.comuna.name}</AppText>
      </Pressable>
      {event.status === 'cancelled' ? <AppText variant="label" color={Colors.red}>Evento cancelado</AppText> : null}
      <AppText variant="display" style={styles.title}>{event.title}</AppText>
      <AppText variant="display" style={styles.day}>{when.day} {when.month}</AppText>
      <AppText variant="label">{when.weekday}</AppText>
      <AppText variant="heading" style={styles.time}>{when.time}{end ? ` – ${sameDay ? end.time : `${end.day} ${end.month} ${end.time}`}` : ''}</AppText>
      {event.description ? <AppText style={styles.description}>{event.description}</AppText> : null}
      {event.placeName ? <AppText variant="bodyStrong" style={styles.place}>{event.placeName}</AppText> : null}
      {event.address ? <AppText style={styles.address}>{event.address}</AppText> : null}
      {map ? <EditorialAction label="Abrir no mapa" icon="pin" onPress={() => { void Linking.openURL(map); }} /> : null}
      {event.onlineUrl ? <EditorialAction label="Abrir link" icon="globe" onPress={() => { void Linking.openURL(event.onlineUrl!); }} /> : null}
      <Pressable onPress={onOpenCounts} accessibilityRole="link" accessibilityLabel={attendanceCount(event.goingCount, event.maybeCount)}>
        <AppText variant="heading">{attendanceCount(event.goingCount, event.maybeCount)}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.five, paddingVertical: Spacing.six, gap: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  poster: { gap: Spacing.two },
  title: { fontSize: 40, lineHeight: 48 },
  day: { fontFamily: Fonts.condensed, fontSize: 56, lineHeight: 68 },
  time: { fontSize: 28, lineHeight: 34 },
  description: { marginTop: Spacing.three },
  place: { marginTop: Spacing.four },
  address: { lineHeight: 22 },
  rsvp: { flexDirection: 'row', gap: Spacing.two },
  rsvpChoice: { flex: 1 },
  note: { lineHeight: 18 },
  admin: { gap: Spacing.two },
});
