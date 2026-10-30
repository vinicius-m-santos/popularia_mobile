import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { describeError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import { goBack } from '@/lib/routes';

import { createEvent, getEvent, updateEvent } from './api';
import { EventBar } from './chrome';
import { draftError, draftToInput } from './draft';
import { deviceTimeZone, wallFromIso } from './format';
import { storeEvent } from './rsvp';
import { eventQueryKey, type ComunaEvent, type EventDraft, type EventFormat } from './types';

const FORMATS: { format: EventFormat; label: string; icon: 'pin' | 'globe' | 'echo' }[] = [
  { format: 'in_person', label: 'Presencial', icon: 'pin' },
  { format: 'online', label: 'Online', icon: 'globe' },
  { format: 'hybrid', label: 'Híbrido', icon: 'echo' },
];

const empty = (timeZone: string): EventDraft => ({
  title: '', description: '', format: 'in_person', placeName: '', address: '', onlineUrl: '',
  date: '', time: '', endDate: '', endTime: '', timeZone,
});

function draftFromEvent(event: ComunaEvent): EventDraft {
  const start = wallFromIso(event.startsAt, event.timeZone);
  const end = event.endsAt ? wallFromIso(event.endsAt, event.timeZone) : { date: '', time: '' };
  return {
    title: event.title, description: event.description, format: event.format,
    placeName: event.placeName ?? '', address: event.address ?? '', onlineUrl: event.onlineUrl ?? '',
    date: start.date, time: start.time, endDate: end.date, endTime: end.time, timeZone: event.timeZone,
  };
}

export default function EventFormScreen() {
  const { id, slug } = useLocalSearchParams<{ id?: string; slug?: string }>();
  const editing = !!id;
  const existing = useQuery({
    queryKey: eventQueryKey(id ?? 'novo'),
    queryFn: ({ signal }) => getEvent(id ?? '', signal),
    enabled: editing,
    retry: false,
  }, queryClient);

  if (editing && existing.isPending) return <Screen><EventBar title="Editar" /><StateView kind="loading" message="Abrindo a atividade" /></Screen>;
  if (editing && (existing.isError || !existing.data)) return <Screen><EventBar title="Editar" /><StateView kind="error" message="Não conseguimos carregar este evento." onRetry={() => { void existing.refetch(); }} /></Screen>;

  const initial = existing.data ? draftFromEvent(existing.data) : empty(deviceTimeZone() ?? '');
  return <EventFields key={existing.data?.id ?? 'novo'} initial={initial} editing={editing} id={id} slug={slug} />;
}

function EventFields({ initial, editing, id, slug }: { initial: EventDraft; editing: boolean; id?: string; slug?: string }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const toast = useToast();

  const set = (patch: Partial<EventDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const needsPlace = draft.format !== 'online';
  const needsUrl = draft.format !== 'in_person';

  const submit = () => {
    const message = draftError(draft, !editing);
    if (message) { setError(message); return; }
    setPending(true);
    setError('');
    const input = draftToInput(draft);
    const request = editing ? updateEvent(id!, input) : createEvent(slug!, input);
    void request
      .then((saved) => { storeEvent(saved); toast.show(editing ? 'Atividade atualizada.' : 'Atividade marcada.'); goBack(); })
      .catch((failure: unknown) => setError(describeError(failure)))
      .finally(() => setPending(false));
  };

  return <Screen>
    <EventBar title={editing ? 'Editar' : 'Nova atividade'} />
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <AppText variant="caption">O horário vale no fuso {draft.timeZone || 'do aparelho'}.{editing ? ' Esse fuso não muda.' : ''}</AppText>
      <TextField appearance="editorial" label="Título" placeholder="Ex.: Assembleia mensal" value={draft.title} onChangeText={(title) => set({ title })} maxLength={120} />
      <TextField appearance="editorial" label="Descrição" labelAside="opcional" placeholder="Ex.: Pauta e como chegar" value={draft.description} onChangeText={(description) => set({ description })} maxLength={2000} multiline multilineHeight={120} />
      <View style={styles.formats}>
        {FORMATS.map((item) => (
          <EditorialAction key={item.format} label={item.label} icon={item.icon} tone={draft.format === item.format ? 'red' : 'paper'} onPress={() => set({ format: item.format })} style={styles.format} accessibilityLabel={draft.format === item.format ? `${item.label}, selecionado` : item.label} />
        ))}
      </View>
      {needsPlace ? (
        <>
          <TextField appearance="editorial" label="Local" placeholder="Ex.: Sindicato dos Bancários" value={draft.placeName} onChangeText={(placeName) => set({ placeName })} maxLength={120} />
          <TextField appearance="editorial" label="Endereço" labelAside="opcional" placeholder="Ex.: Rua X, 123 — Centro" value={draft.address} onChangeText={(address) => set({ address })} maxLength={240} />
        </>
      ) : null}
      {needsUrl ? (
        <TextField appearance="editorial" label="Link" placeholder="Ex.: https://meet.example.org/sala" value={draft.onlineUrl} onChangeText={(onlineUrl) => set({ onlineUrl })} maxLength={500} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      ) : null}
      <View style={styles.when}>
        <View style={styles.whenField}><TextField appearance="editorial" label="Data" placeholder="Ex.: 05/11/2026" value={draft.date} onChangeText={(date) => set({ date })} /></View>
        <View style={styles.whenField}><TextField appearance="editorial" label="Hora" placeholder="Ex.: 19:00" value={draft.time} onChangeText={(time) => set({ time })} /></View>
      </View>
      <View style={styles.when}>
        <View style={styles.whenField}><TextField appearance="editorial" label="Término" labelAside="opcional" placeholder="Ex.: 05/11/2026" value={draft.endDate} onChangeText={(endDate) => set({ endDate })} /></View>
        <View style={styles.whenField}><TextField appearance="editorial" label="Hora final" labelAside="opcional" placeholder="Ex.: 21:00" value={draft.endTime} onChangeText={(endTime) => set({ endTime })} /></View>
      </View>
      {error ? <AppText color={Colors.red} accessibilityLiveRegion="polite">{error}</AppText> : null}
      <EditorialAction label={editing ? 'Salvar evento' : 'Marcar evento'} icon="check" tone="red" onPress={submit} disabled={pending || !draft.timeZone} />
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.five, paddingVertical: Spacing.five, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  formats: { flexDirection: 'row', gap: Spacing.two },
  format: { flex: 1 },
  when: { flexDirection: 'row', gap: Spacing.two },
  whenField: { flex: 1 },
});
