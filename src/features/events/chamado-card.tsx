import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Radius, Shadows } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { putAttendance } from '@/features/events/api';
import { callCapacitySummary, callSchedule, countdownLabel, mapsQueryUrl } from '@/features/events/format';
import { useInteractions } from '@/features/interactions/interactions-context';
import type { EventCapacityMode, User } from '@/types/models';

/** Tudo que o cartão precisa, já resolvido a partir de um chamado fictício ou da API. */
export type ChamadoCardData = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  timeZone: string;
  placeName: string | null;
  address: string | null;
  cover: number | string | { uri: string } | null;
  coverFit: 'cover' | 'contain';
  capacityMode: EventCapacityMode | null;
  capacity: number | null;
  goingCount: number;
  maybeCount: number;
  goingUsers: User[];
  viewerAttendance: 'going' | 'maybe' | null;
  past: boolean;
  cancelled: boolean;
};

type ChamadoAuthorLineProps = {
  author: User;
  /** "c/ Tarifa Zero BH" ou "No seu perfil". */
  origin: string;
  meta: string;
  onPress?: () => void;
  trailing?: ReactNode;
};

/** Topo do item no feed: "Fulano convocou" e o destino, em mono vermelho. */
export function ChamadoAuthorLine({ author, origin, meta, onPress, trailing }: ChamadoAuthorLineProps) {
  return (
    <View style={styles.authorRow}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'link' : undefined}
        accessibilityLabel={`${author.name} convocou.${origin ? ` ${origin}.` : ''}${meta ? ` ${meta}` : ''}`}
        accessibilityHint={onPress ? 'Abre o perfil' : undefined}
        style={styles.authorIdentity}>
        <Avatar
          initials={author.initials}
          tone={author.tone}
          size={42}
          userId={author.id}
          imageUrl={author.avatarUrl}
          shape="square"
          outline
          font="anton"
        />
        <View style={styles.authorText}>
          <AppText style={styles.authorName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {author.name}
            <Text style={styles.authorVerb}> convocou</Text>
          </AppText>
          <AppText style={styles.authorMeta} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {origin ? <Text style={styles.comunaLabel}>{origin.toLocaleUpperCase('pt-BR')}</Text> : null}
            {meta ? <Text style={styles.authorMetaMuted}>{origin ? ` · ${meta}` : meta}</Text> : null}
          </AppText>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

/** Cartão do chamado no feed: capa opcional, data, informações, quem vai, barra e ações. */
export function ChamadoCard({ data }: { data: ChamadoCardData }) {
  const schedule = callSchedule(data.startsAt, data.timeZone);
  const countdown = data.cancelled ? 'CANCELADO' : countdownLabel(data.startsAt, data.timeZone);
  const attendance = useChamadoAttendance(data);
  const me = useMe();
  const toast = useToast();
  const capacity = callCapacitySummary(data.capacityMode, data.capacity, attendance.goingCount);
  const mapUrl = mapsQueryUrl(data.placeName, data.address);
  const closed = data.past || data.cancelled;

  const faces = facesFor(data.goingUsers, attendance.going, me, 3);
  const names = namesFor(data.goingUsers, attendance.going, me);
  const extra = Math.max(0, attendance.goingCount - names.length);
  const who = whoLabel(names, extra, attendance.goingCount);
  const full = capacity.kind === 'spots' && capacity.full;

  const confirm = () => {
    if (closed || attendance.busy || (full && !attendance.going)) return;
    void attendance.setAttendance(attendance.going ? null : 'going');
  };

  const addToCalendar = async () => {
    const url = googleCalendarUrl(data);
    if (!url) {
      toast.show('Não foi possível abrir o chamado na agenda.');
      return;
    }
    await Linking.openURL(url).then(
      () => toast.show('Abrindo o Google Agenda com o chamado preenchido.'),
      () => toast.show('Não foi possível abrir a agenda.'),
    );
  };

  return (
    <View style={styles.shadowWrap}>
      {/* Sombra sólida desenhada como uma chapa deslocada: o canto acompanha o raio
          e não sobra a linha clara que o shadow nativo deixava no encontro. */}
      <View style={styles.shadowPlate} pointerEvents="none" />
      <View style={styles.card}>
        {data.cover ? (
          <View style={styles.cover}>
            <Image
              source={data.cover}
              contentFit={data.coverFit}
              transition={120}
              cachePolicy="memory-disk"
              style={styles.coverImage}
              accessible={false}
            />
            <CountdownChip label={countdown} style={styles.chipOnCover} />
            <DateBlock schedule={schedule} overlay />
          </View>
        ) : null}

        <View style={[styles.body, data.cover ? styles.bodyWithCover : styles.bodyWithoutCover]}>
          {data.cover ? null : (
            <View style={styles.lead}>
              <DateBlock schedule={schedule} />
              <View style={styles.leadText}>
                <CountdownChip label={countdown} />
                <Title title={data.title} />
                {data.description ? <Description text={data.description} /> : null}
              </View>
            </View>
          )}
          {data.cover ? <Title title={data.title} /> : null}
          {data.cover && data.description ? <Description text={data.description} /> : null}
        </View>

        <View style={styles.info}>
          <View style={styles.infoRow} accessible accessibilityLabel={schedule.label}>
            <View style={styles.infoIcon}><Icon name="clock" size={16} /></View>
            <AppText style={styles.infoMain} maxFontSizeMultiplier={1.3}>{schedule.label}</AppText>
          </View>
          {data.placeName ? (
            mapUrl ? (
              <Pressable
                onPress={() => { void Linking.openURL(mapUrl).catch(() => toast.show('Não foi possível abrir o mapa.')); }}
                accessibilityRole="link"
                accessibilityLabel={`Abrir ${data.placeName} no mapa`}
                style={({ pressed }) => [styles.infoRow, styles.mapRow, pressed && styles.pressed]}>
                <View style={styles.infoIcon}><Icon name="pin" size={16} /></View>
                <View style={styles.infoCopy}>
                  <AppText style={styles.infoMain} maxFontSizeMultiplier={1.3}>{data.placeName}</AppText>
                  <Text style={styles.infoLink}>Abrir no mapa</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Icon name="pin" size={16} /></View>
                <View style={styles.infoCopy}>
                  <AppText style={styles.infoMain} maxFontSizeMultiplier={1.3}>{data.placeName}</AppText>
                </View>
              </View>
            )
          ) : null}
        </View>

        <Perforation />

        <View style={styles.people}>
          <View style={styles.peopleRow}>
            {faces.length > 0 ? (
              <View style={styles.faces} accessible={false} importantForAccessibility="no-hide-descendants">
                {faces.map((face, index) => (
                  <View key={face.key} style={[styles.face, index > 0 && styles.faceOverlap]}>
                    <Avatar
                      initials={face.initials}
                      tone={face.tone}
                      size={26}
                      userId={face.viewer ? undefined : face.id}
                      imageUrl={face.viewer ? me.avatarUrl : face.avatarUrl}
                      shape="square"
                      outline
                      font="anton"
                    />
                  </View>
                ))}
              </View>
            ) : null}
            <AppText style={styles.who} numberOfLines={2}>
              <AppText style={styles.whoStrong}>{who}</AppText>
              {attendance.maybeCount > 0 ? <AppText style={styles.whoMaybe}>{` ${attendance.maybeCount} talvez`}</AppText> : null}
            </AppText>
          </View>

          {capacity.kind === 'free' ? (
            <View style={styles.freeLabel}>
              <AppText style={styles.freeLabelText}>Entrada livre · sem limite de vagas</AppText>
            </View>
          ) : (
            <View style={styles.barBlock}>
              <View style={styles.barLabels}>
                <AppText style={styles.barLabel}>{capacity.left}</AppText>
                <AppText
                  style={[
                    styles.barLabel,
                    styles.barLabelRight,
                    capacity.kind === 'spots' && capacity.alert ? styles.barLabelAlert : null,
                    capacity.kind === 'goal' && capacity.met ? styles.barLabelMet : null,
                  ]}>
                  {capacity.right.replace(/\s*✓$/, '')}
                  {capacity.right.endsWith('✓') ? <AppText style={styles.barCheck}> ✓</AppText> : null}
                </AppText>
              </View>
              <View style={styles.barTrack} accessible accessibilityLabel={`${capacity.left}. ${capacity.right}`}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round(capacity.fill * 100)}%` },
                    capacity.kind === 'goal' && capacity.met ? styles.barFillMet : null,
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={confirm}
            disabled={closed || attendance.busy || (full && !attendance.going)}
            accessibilityRole="button"
            accessibilityLabel={attendance.going ? `Cancelar presença: ${data.title}` : `Eu vou: ${data.title}`}
            accessibilityState={{ selected: attendance.going, disabled: closed || attendance.busy || (full && !attendance.going), busy: attendance.busy }}
            style={({ pressed }) => [
              styles.cta,
              styles.ctaPrimary,
              attendance.going && styles.ctaGoing,
              (closed || (full && !attendance.going)) && styles.ctaDisabled,
              pressed && styles.pressed,
            ]}>
            <AppText
              style={[
                styles.ctaPrimaryLabel,
                (closed || (full && !attendance.going)) && styles.ctaDisabledLabel,
              ]}
              maxFontSizeMultiplier={1.2}>
              {attendance.going ? 'VOCÊ VAI ✓' : data.cancelled ? 'CANCELADO' : data.past ? 'ENCERRADO' : 'EU VOU'}
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => { if (!closed && !attendance.busy) void attendance.setAttendance(attendance.maybe ? null : 'maybe'); }}
            disabled={closed || attendance.busy}
            accessibilityRole="button"
            accessibilityLabel={attendance.maybe ? `Cancelar talvez: ${data.title}` : `Talvez: ${data.title}`}
            accessibilityState={{ selected: attendance.maybe, disabled: closed || attendance.busy, busy: attendance.busy }}
            style={({ pressed }) => [
              styles.cta,
              styles.ctaMaybe,
              attendance.maybe && styles.ctaMaybeActive,
              closed && styles.ctaDisabled,
              pressed && styles.pressed,
            ]}>
            <AppText style={[styles.ctaMaybeLabel, closed && styles.ctaDisabledLabel]} maxFontSizeMultiplier={1.3}>Talvez</AppText>
          </Pressable>
          <Pressable
            onPress={() => { void addToCalendar(); }}
            accessibilityRole="button"
            accessibilityLabel={`Adicionar à agenda: ${data.title}`}
            style={({ pressed }) => [styles.cta, styles.ctaCalendar, pressed && styles.pressed]}>
            <Icon name="calendarPlus" size={22} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Title({ title }: { title: string }) {
  return <AppText style={styles.title} maxFontSizeMultiplier={1.3}>{title}</AppText>;
}

function Description({ text }: { text: string }) {
  return <AppText style={styles.description}>{text}</AppText>;
}

function CountdownChip({ label, style }: { label: string; style?: object }) {
  return (
    <View style={[styles.chip, style]} accessible accessibilityLabel={`Quando: ${label.toLowerCase()}`}>
      <AppText style={styles.chipText}>{label}</AppText>
    </View>
  );
}

function DateBlock({ schedule, overlay = false }: { schedule: ReturnType<typeof callSchedule>; overlay?: boolean }) {
  return (
    <View
      style={[styles.dateFrame, overlay && styles.dateBlockOverlay, styles.dateBlockShadow]}
      accessible
      accessibilityLabel={`${schedule.weekdayLong}, ${Number(schedule.day)} de ${schedule.monthLong}`}>
      {/* A moldura é uma camada de fundo com 2px, não `borderWidth`: no iOS o cartão
          sem capa não desenhava a borda do bloco de data. */}
      <View style={styles.dateBlockInner}>
        <AppText style={styles.dateWeekday}>{schedule.weekdayShort}</AppText>
        <AppText style={styles.dateDay} maxFontSizeMultiplier={1.15}>{schedule.day}</AppText>
        <AppText style={styles.dateMonth} maxFontSizeMultiplier={1.3}>{schedule.monthShort}</AppText>
      </View>
    </View>
  );
}

function Perforation() {
  return (
    <View style={styles.perforation} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <View style={styles.dashed} />
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={[styles.notch, styles.notchRight]} />
    </View>
  );
}

type Face = { key: string; id?: string; initials: string; tone: User['tone']; avatarUrl?: string | null; viewer?: boolean };

function facesFor(people: User[], going: boolean, me: User, limit: number): Face[] {
  const unique = new Map<string, Face>();
  if (going) unique.set('me', { key: 'me', initials: me.initials, tone: 'red', viewer: true });
  for (const person of people) {
    if (person.id === me.id || unique.has(person.id)) continue;
    unique.set(person.id, { key: person.id, id: person.id, initials: person.initials, tone: person.tone, avatarUrl: person.avatarUrl });
    if (unique.size >= limit) break;
  }
  return [...unique.values()].slice(0, limit);
}

function namesFor(people: User[], going: boolean, me: User): string[] {
  const names: string[] = [];
  if (going) names.push('Você');
  for (const person of people) {
    if (person.id === me.id) continue;
    const first = person.name.trim().split(/\s+/)[0];
    if (!first || names.includes(first)) continue;
    names.push(first);
    if (names.length >= 2) break;
  }
  return names;
}

function whoLabel(names: string[], extra: number, goingCount: number): string {
  if (goingCount === 0) return 'Ninguém confirmou ainda.';
  const verb = goingCount === 1 ? 'vai' : 'vão';
  if (names.length === 0) return `${goingCount} ${verb}.`;
  if (extra > 0) return `${names.join(', ')} e mais ${extra} ${verb}.`;
  if (names.length === 1) return `${names[0]} ${verb}.`;
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} ${verb}.`;
}

/** Presença do chamado no feed: local para tocar na hora, confirmada no servidor quando há API. */
export function useChamadoAttendance(data: ChamadoCardData) {
  const { isOn, setOn } = useInteractions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const serverGoing = data.viewerAttendance === 'going';
  const serverMaybe = data.viewerAttendance === 'maybe';
  const going = isOn('goingEvents', data.id);
  const maybe = isOn('maybeEvents', data.id);

  // O resumo do feed traz a resposta de quem vê: ela vira o estado local da sessão.
  useEffect(() => {
    if (serverGoing) {
      setOn('goingEvents', [data.id], true);
      setOn('maybeEvents', [data.id], false);
    } else if (serverMaybe) {
      setOn('maybeEvents', [data.id], true);
      setOn('goingEvents', [data.id], false);
    }
  }, [data.id, serverGoing, serverMaybe, setOn]);

  const setAttendance = async (next: 'going' | 'maybe' | null) => {
    if (busy) return;
    const previous = { going, maybe };
    setOn('goingEvents', [data.id], next === 'going');
    setOn('maybeEvents', [data.id], next === 'maybe');
    if (DEMO_MODE) {
      if (next) toast.show('Presença marcada neste aparelho até fechar o app.');
      return;
    }
    setBusy(true);
    try {
      await putAttendance(data.id, next ?? 'not_going');
    } catch {
      setOn('goingEvents', [data.id], previous.going);
      setOn('maybeEvents', [data.id], previous.maybe);
      toast.show('Não foi possível atualizar sua presença. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return {
    going,
    maybe,
    busy,
    // A contagem do servidor já inclui a própria pessoa quando ela confirmou lá.
    goingCount: Math.max(0, data.goingCount + (going ? 1 : 0) - (serverGoing ? 1 : 0)),
    maybeCount: Math.max(0, data.maybeCount + (maybe ? 1 : 0) - (serverMaybe ? 1 : 0)),
    setAttendance,
  };
}

/** Alternativa sem o módulo nativo: Google Agenda com título, data, local e detalhes. */
function googleCalendarUrl(data: ChamadoCardData): string | null {
  const start = new Date(data.startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = data.endsAt ? new Date(data.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = [
    ['action', 'TEMPLATE'],
    ['text', data.title],
    ['dates', `${stamp(start)}/${stamp(end)}`],
    ['details', data.description],
    ['location', [data.placeName, data.address].filter((value): value is string => !!value).join(' — ')],
  ].filter(([, value]) => !!value).map(([key, value]) => `${key}=${encodeURIComponent(value!)}`).join('&');
  return `https://calendar.google.com/calendar/render?${params}`;
}

const styles = StyleSheet.create({
  authorRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  authorName: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.ink,
  },
  authorVerb: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.muted,
  },
  authorMeta: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 0.88,
  },
  comunaLabel: {
    color: Colors.redPressed,
  },
  authorMetaMuted: {
    fontFamily: Fonts.mono,
    color: Colors.muted,
    letterSpacing: 0.4,
  },
  shadowWrap: {
    position: 'relative',
  },
  shadowPlate: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: Radius.md,
    backgroundColor: Colors.ink,
  },
  card: {
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  cover: {
    height: 168,
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
    backgroundColor: '#E4DACA',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.yellow,
  },
  chipOnCover: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  body: {
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  bodyWithCover: {
    paddingTop: 36,
  },
  bodyWithoutCover: {
    paddingTop: 14,
  },
  lead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  leadText: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  title: {
    fontFamily: Fonts.anton,
    fontSize: 27,
    lineHeight: 36,
    color: Colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  description: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 21.75,
    color: Colors.inkSoft,
  },
  dateFrame: {
    width: 70,
    padding: 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.ink,
  },
  dateBlockInner: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 7,
    borderRadius: 4,
    backgroundColor: Colors.red,
  },
  dateBlockOverlay: {
    position: 'absolute',
    left: 12,
    bottom: -26,
    zIndex: 2,
  },
  dateBlockShadow: Shadows.offset,
  dateWeekday: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: Colors.paper,
  },
  dateDay: {
    fontFamily: Fonts.anton,
    fontSize: 34,
    lineHeight: 42,
    color: Colors.paper,
    textTransform: 'uppercase',
  },
  dateMonth: {
    fontFamily: Fonts.anton,
    fontSize: 15,
    lineHeight: 23,
    textTransform: 'uppercase',
    color: Colors.paper,
  },
  info: {
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  mapRow: {
    minHeight: 44,
  },
  infoIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.straw,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  infoMain: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ink,
    paddingTop: 4,
  },
  infoLink: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.muted,
  },
  perforation: {
    height: 22,
    justifyContent: 'center',
  },
  dashed: {
    marginHorizontal: 16,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
  },
  notch: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  notchLeft: {
    left: -13,
  },
  notchRight: {
    right: -13,
  },
  people: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    borderRadius: 5,
  },
  faceOverlap: {
    marginLeft: -6,
  },
  who: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.ink,
  },
  whoStrong: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.ink,
  },
  whoMaybe: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.muted,
  },
  freeLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
  },
  freeLabelText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  barBlock: {
    gap: 6,
  },
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  barLabel: {
    flexShrink: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  barLabelRight: {
    textAlign: 'right',
  },
  barLabelAlert: {
    color: Colors.redPressed,
  },
  barLabelMet: {
    color: Colors.ink,
  },
  barCheck: {
    fontFamily: Fonts.anton,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.ink,
  },
  barTrack: {
    height: 9,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 3,
    backgroundColor: Colors.strawLight,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.red,
  },
  barFillMet: {
    backgroundColor: Colors.ink,
  },
  ctaRow: {
    flexDirection: 'row',
    minHeight: 50,
    borderTopWidth: 2,
    borderTopColor: Colors.ink,
  },
  cta: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 2,
    borderRightColor: Colors.ink,
  },
  ctaPrimary: {
    flex: 1.65,
    backgroundColor: Colors.red,
  },
  ctaGoing: {
    backgroundColor: Colors.ink,
  },
  ctaDisabled: {
    backgroundColor: Colors.strawLight,
  },
  ctaPrimaryLabel: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: 36,
    color: Colors.paper,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ctaDisabledLabel: {
    color: Colors.muted,
  },
  ctaMaybe: {
    flex: 1.1,
    backgroundColor: Colors.paper,
  },
  ctaMaybeActive: {
    backgroundColor: Colors.yellow,
  },
  ctaMaybeLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.ink,
  },
  ctaCalendar: {
    width: 58,
    borderRightWidth: 0,
    backgroundColor: Colors.paper,
  },
  pressed: {
    opacity: 0.85,
  },
});
