import { PopulariaList } from '@/components/list/popularia-list';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { goBack } from '@/lib/routes';
import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { ChipRow } from '@/components/chip';
import { Icon, type IconName } from '@/components/icon';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { FollowButton } from '@/features/profiles/components/follow-button';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { ApiError } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import type { AppNotification, NotificationKind } from '@/types/models';

import { getNotifications } from './api';
import { openNotificationTarget } from './navigation';
import { useNotifications } from './notifications-context';
import { PushPermissionPrompt } from './push-permission-prompt';
import { showsActorInMessage } from './presentation';

type NotificationFilter = 'tudo' | 'conversas' | 'comunas';

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'conversas', label: 'Comentários e respostas' },
  { key: 'comunas', label: 'Comunas' },
];

const MATCHES: Record<NotificationFilter, (kind: NotificationKind) => boolean> = {
  tudo: () => true,
  conversas: (k) => k === 'reply' || k === 'comment' || k === 'square_reply' || k === 'mention_post' || k === 'mention_comment',
  comunas: (k) => k.startsWith('join_') || k.startsWith('ownership_') || k.startsWith('event_'),
};

/** Existing Avisos design, backed by a paginated server history. */
export default function NotificationsScreen() {
  const load = useCallback((cursor: string | null) => getNotifications(cursor), []);
  const list = usePaginatedData(load);
  const [filter, setFilter] = useState<NotificationFilter>('tudo');
  const [busy, setBusy] = useState(false);
  const [allReadIds, setAllReadIds] = useState<ReadonlySet<string>>(new Set());
  const pending = useRef(false);
  const { revision, unreadCount, readIds, refreshUnread, read, readAll } = useNotifications();
  const toast = useToast();
  const refreshList = list.refresh;
  const focused = useRef(false);
  const active = useRef(false);

  const refresh = useCallback(() => {
    refreshList();
    void refreshUnread();
  }, [refreshList, refreshUnread]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    if (focused.current) refreshList();
    focused.current = true;
    void refreshUnread();
    return () => { active.current = false; };
  }, [refreshList, refreshUnread]));

  const previousRevision = useRef(revision);
  const revalidateList = list.revalidate;
  useEffect(() => {
    if (previousRevision.current === revision || list.status !== 'success') return;
    previousRevision.current = revision;
    revalidateList();
  }, [revision, revalidateList, list.status]);

  const isUnread = (n: AppNotification) => n.unread && !readIds.has(n.id) && !allReadIds.has(n.id);

  const markAllRead = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const ids = list.items.map((n) => n.id);
    try {
      await readAll();
      if (!active.current) return;
      setAllReadIds((previous) => new Set([...previous, ...ids]));
      refreshList();
      toast.show('Todas as notificações foram marcadas como lidas.');
    } catch {
      if (!active.current) return;
      toast.show('Não conseguimos marcar os avisos como lidos. Tente novamente.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const open = async (notification: AppNotification, navigate = true) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const current = await read(notification.id, isUnread(notification));
      if (!active.current) return;
      if (navigate) {
        if (current.target) openNotificationTarget(current.target);
        else toast.show('Este conteúdo não está mais disponível.');
      }
    } catch (error) {
      if (!active.current) return;
      if (error instanceof ApiError && [403, 404, 410].includes(error.status)) {
        toast.show('Este conteúdo não está mais disponível ou você não tem mais acesso.');
        refresh();
      } else {
        toast.show('Não conseguimos abrir este aviso. Tente novamente.');
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  let body;
  if (list.status === 'error' && list.items.length === 0) {
    body = <StateView kind="error" message="Não conseguimos carregar seus avisos." onRetry={refresh} />;
  } else if (list.status === 'loading') {
    body = <StateView kind="loading" message="Carregando avisos" />;
  } else {
    body = (
      <PopulariaList
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        data={list.items.filter((n) => MATCHES[filter](n.kind))}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={refresh} tintColor={Colors.red} />}
        renderItem={({ item }) => (
          <NotificationRow notification={item} unread={isUnread(item)} disabled={busy}
            onOpen={() => void open(item)} onInteract={() => void open(item, false)} />
        )}
        ListHeaderComponent={list.refreshError ? <StateView kind="error" message="Não conseguimos atualizar seus avisos." onRetry={refresh} /> : undefined}
        ListEmptyComponent={<StateView kind="empty" title="Nada por aqui" message={filter === 'tudo' ? 'Nenhuma notificação por enquanto.' : 'Nenhum aviso nesta categoria.'} />}
        ListFooterComponent={list.loadMoreError ? (
          <StateView kind="error" message="Não conseguimos carregar mais avisos." onRetry={list.loadMore} />
        ) : list.hasMore ? (
          <PillButton label={list.loadingMore ? 'Carregando…' : 'Carregar mais'} onPress={list.loadMore} disabled={list.loadingMore} variant="outline" style={styles.more} />
        ) : undefined}
        onEndReached={list.loadMoreError ? undefined : list.loadMore}
        onEndReachedThreshold={0.3}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
          <AppText variant="heading" accessibilityRole="header" style={styles.title}>Avisos</AppText>
          <Pressable
            onPress={markAllRead}
            disabled={busy || unreadCount === 0}
            accessibilityState={{ disabled: busy || unreadCount === 0, busy }}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.readAll}>
            <AppText style={styles.readAllLabel} color={Colors.red}>
              {busy ? 'Aguarde…' : 'Ler todas'}
            </AppText>
          </Pressable>
        </View>
        <View style={styles.filters}>
          <ChipRow options={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filtrar avisos" />
        </View>
      </View>
      <PushPermissionPrompt />
      {body}
    </Screen>
  );
}

type RowProps = {
  notification: AppNotification;
  unread: boolean;
  disabled: boolean;
  onOpen: () => void;
  onInteract: () => void;
};

function NotificationRow({ notification: n, unread, disabled, onOpen, onInteract }: RowProps) {
  const actorName = n.actor && showsActorInMessage(n.kind) ? `@${n.actor.handle}` : '';
  const time = formatRelative(n.createdAt);

  return (
    <View style={[styles.row, unread && styles.rowUnread]}>
      {unread ? <View style={styles.dot} /> : null}
      <Pressable
        onPress={onOpen}
        disabled={disabled}
        accessibilityRole={n.target ? 'link' : undefined}
        accessibilityLabel={`${unread ? 'Não lido. ' : ''}${actorName} ${n.text}${n.subject ? ` ${n.subject}` : ''}${n.quote ? `: ${n.quote}` : ''}. ${time}`}
        style={({ pressed }) => [styles.rowTap, pressed && styles.pressed]}>
        <View style={styles.avatarWrap}>
          {n.actor ? (
            <Avatar initials={n.actor.initials} tone={n.actor.tone} size={44} userId={n.actor.id} imageUrl={n.actor.avatarUrl} />
          ) : (
            <Avatar initials="C" tone="cream" size={44} />
          )}
          <KindBadge kind={n.kind} />
        </View>
        <View style={styles.text}>
          <AppText style={styles.sentence} color={unread ? Colors.ink : Colors.inkSoft}>
            {actorName ? <><AppText style={[styles.sentence, styles.strong]}>{actorName}</AppText>{' '}</> : null}{n.text}
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
      {n.kind === 'follow' && n.actor ? (
        <View style={styles.followAction}>
          <FollowButton user={n.actor} idleLabel="Seguir de volta" disabled={disabled} onChanged={onInteract} />
        </View>
      ) : null}
    </View>
  );
}

const BADGE_ICONS: Record<NotificationKind, IconName> = {
  comment_support: 'support',
  square_reply: 'comment',
  comment: 'comment',
  reply: 'comment',
  mention_post: 'user',
  mention_comment: 'user',
  follow: 'plus',
  join_requested: 'support', join_approved: 'check', join_rejected: 'close',
  ownership_proposed: 'shield', ownership_accepted: 'shield', ownership_declined: 'shield', ownership_cancelled: 'shield',
  event_rescheduled: 'pin', event_place_changed: 'pin', event_link_changed: 'pin', event_updated: 'pin', event_cancelled: 'pin', event_reminder: 'bell',
};

/** Selo no canto do avatar com o tipo do aviso. */
function KindBadge({ kind }: { kind: NotificationKind }) {
  const red = kind === 'reply' || kind === 'comment' || kind === 'square_reply' || kind === 'mention_post' || kind === 'mention_comment';
  return (
    <View style={[styles.badge, { backgroundColor: red ? Colors.red : Colors.ink }]}>
      <Icon name={BADGE_ICONS[kind]} size={11} color={Colors.paper} />
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
  title: { position: 'absolute', left: 88, right: 88, textAlign: 'center', textTransform: 'uppercase' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  readAll: {
    marginLeft: 'auto',
    minHeight: 44,
    justifyContent: 'center',
  },
  readAllLabel: {
    textAlign: 'right',
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
    flexGrow: 1,
  },
  more: { alignSelf: 'center', marginVertical: Spacing.four },
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
