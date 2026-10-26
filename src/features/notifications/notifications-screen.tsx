import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { ChipRow } from '@/components/chip';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { useInteractions } from '@/features/interactions/interactions-context';
import { FollowButton } from '@/features/profiles/components/follow-button';
import { useAsyncData } from '@/hooks/use-async-data';
import { formatRelative } from '@/lib/format';
import { openModeration, useNav } from '@/lib/routes';
import type { AppNotification, NotificationKind } from '@/types/models';

import { getNotifications } from './api';

type NotificationFilter = 'tudo' | 'mencoes' | 'comunas';

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'mencoes', label: 'Menções e respostas' },
  { key: 'comunas', label: 'Comunas' },
];

const MATCHES: Record<NotificationFilter, (kind: NotificationKind) => boolean> = {
  tudo: () => true,
  mencoes: (k) => k === 'reply' || k === 'mention',
  comunas: (k) => k === 'comuna' || k === 'moderation',
};

/** Avisos (design 2g). A leitura fica só neste aparelho. */
export default function NotificationsScreen() {
  const load = useCallback(() => getNotifications(), []);
  const list = useAsyncData(load);
  const [filter, setFilter] = useState<NotificationFilter>('tudo');
  const { isOn, setOn } = useInteractions();
  const toast = useToast();

  const isUnread = (n: AppNotification) => n.unread && !isOn('readNotifications', n.id);

  const markAllRead = () => {
    if (!list.data) return;
    setOn(
      'readNotifications',
      list.data.map((n) => n.id),
      true,
    );
    toast.show('Avisos marcados como lidos neste aparelho.');
  };

  let body;
  if (list.status === 'error') {
    body = <StateView kind="error" message="Não conseguimos carregar seus avisos." onRetry={list.reload} />;
  } else if (!list.data) {
    body = <StateView kind="loading" message="Carregando avisos" />;
  } else {
    const visible = list.data.filter((n) => MATCHES[filter](n.kind));
    // Os grupos seguem o estado do servidor; ler um aviso não o tira de "Novos" na hora.
    const groups = [
      { title: 'Novos', items: visible.filter((n) => n.unread) },
      { title: 'Anteriores', items: visible.filter((n) => !n.unread) },
    ].filter((g) => g.items.length > 0);

    body =
      groups.length === 0 ? (
        <StateView kind="empty" title="Nada por aqui" message="Nenhum aviso nesta categoria." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {groups.map((g) => (
            <View key={g.title}>
              <AppText variant="label" accessibilityRole="header" style={styles.groupTitle}>
                {g.title}
              </AppText>
              {g.items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  unread={isUnread(n)}
                  onRead={() => setOn('readNotifications', [n.id], true)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <AppText variant="display" accessibilityRole="header">
            Avisos
          </AppText>
          <Pressable
            onPress={markAllRead}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.readAll}>
            <AppText style={styles.readAllLabel} color={Colors.red}>
              Marcar como lidas
            </AppText>
          </Pressable>
        </View>
        <View style={styles.filters}>
          <ChipRow options={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filtrar avisos" />
        </View>
      </View>
      {body}
    </Screen>
  );
}

type RowProps = {
  notification: AppNotification;
  unread: boolean;
  onRead: () => void;
};

function NotificationRow({ notification: n, unread, onRead }: RowProps) {
  const nav = useNav();
  const actorName = n.actor.kind === 'user' ? n.actor.user.name : `c/ ${n.actor.comuna.name}`;
  const time = formatRelative(n.createdAt);

  const open = () => {
    onRead();
    if (!n.target) return;
    if (n.target.kind === 'post') nav.openPost(n.target.id);
    else if (n.target.kind === 'comuna') nav.openComuna(n.target.id);
    else if (n.target.kind === 'moderation') openModeration(n.target.id);
    else nav.openProfile(n.target.id);
  };

  return (
    <View style={[styles.row, unread && styles.rowUnread]}>
      {unread ? <View style={styles.dot} /> : null}
      <Pressable
        onPress={open}
        accessibilityRole={n.target ? 'link' : undefined}
        accessibilityLabel={`${unread ? 'Não lido. ' : ''}${actorName} ${n.text}${n.subject ? ` ${n.subject}` : ''}${n.quote ? `: ${n.quote}` : ''}. ${time}`}
        style={({ pressed }) => [styles.rowTap, pressed && styles.pressed]}>
        <View style={styles.avatarWrap}>
          {n.actor.kind === 'user' ? (
            <Avatar initials={n.actor.user.initials} tone={n.actor.user.tone} size={44} />
          ) : (
            <ComunaMark initials={n.actor.comuna.initials} tone={n.actor.comuna.tone} size={44} />
          )}
          <KindBadge kind={n.kind} />
        </View>
        <View style={styles.text}>
          <AppText style={styles.sentence} color={unread ? Colors.ink : Colors.inkSoft}>
            <AppText style={[styles.sentence, styles.strong]}>{actorName}</AppText> {n.text}
            {n.subject ? (
              <>
                {' '}
                <AppText style={[styles.sentence, styles.strong]}>{n.subject}</AppText>
              </>
            ) : null}
          </AppText>
          {n.quote ? (
            <AppText style={styles.quote} color={Colors.muted} numberOfLines={2}>
              “{n.quote}”
            </AppText>
          ) : null}
          <AppText style={styles.time} color={Colors.muted}>
            {time}
          </AppText>
        </View>
      </Pressable>
      {n.kind === 'follow' && n.actor.kind === 'user' ? (
        <View style={styles.followAction}>
          <FollowButton user={n.actor.user} idleLabel="Seguir de volta" />
        </View>
      ) : null}
    </View>
  );
}

const BADGE_ICONS: Record<Exclude<NotificationKind, 'mention'>, IconName> = {
  reply: 'comment',
  support: 'support',
  follow: 'plus',
  comuna: 'echo',
  moderation: 'shield',
};

/** Selo no canto do avatar com o tipo do aviso. */
function KindBadge({ kind }: { kind: NotificationKind }) {
  const red = kind === 'reply' || kind === 'mention' || kind === 'support';
  return (
    <View style={[styles.badge, { backgroundColor: red ? Colors.red : Colors.ink }]}>
      {kind === 'mention' ? (
        <AppText style={styles.badgeAt} color={Colors.paper} maxFontSizeMultiplier={1}>
          @
        </AppText>
      ) : (
        <Icon
          name={BADGE_ICONS[kind]}
          size={kind === 'comuna' ? 12 : 11}
          color={Colors.paper}
          filled={kind === 'support'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.five,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  readAll: {
    minHeight: 40,
    justifyContent: 'center',
  },
  readAllLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  filters: {
    marginHorizontal: -Spacing.five,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  list: {
    paddingBottom: Spacing.six,
  },
  groupTitle: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
    paddingVertical: 14,
    paddingHorizontal: Spacing.five,
  },
  rowUnread: {
    backgroundColor: Colors.paper,
  },
  dot: {
    position: 'absolute',
    left: 6,
    top: 31,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.red,
  },
  rowTap: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  avatarWrap: {
    width: 44,
    height: 44,
  },
  badge: {
    position: 'absolute',
    right: -5,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAt: {
    fontFamily: Fonts.extrabold,
    fontSize: 11,
    lineHeight: 13,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  sentence: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  strong: {
    fontFamily: Fonts.bold,
    color: Colors.ink,
  },
  quote: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 3,
  },
  time: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 4,
  },
  followAction: {
    paddingLeft: 44 + Spacing.three,
    paddingTop: Spacing.two,
    alignItems: 'flex-start',
  },
});
