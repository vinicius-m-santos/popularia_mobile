import { shareDestination } from '@/features/links/share';
import { useListVisibility, mediaViewabilityConfig } from '@/hooks/use-list-visibility';
import { useQuery } from '@tanstack/react-query';
import type { FlashListRef } from '@shopify/flash-list';
import { PopulariaList } from '@/components/list/popularia-list';
import { PopulariaListSkeleton } from '@/components/list/popularia-list-skeleton';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { accessDenied, contentPolicy, queryClient } from '@/lib/query/client';
import { mergeById } from '@/lib/pagination';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StatRow } from '@/components/stat-row';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { getComunas, getMyComunas, roleLabel } from '@/features/comunas/api';
import { ComunaRow } from '@/features/comunas/components/comuna-row';
import { useInteractions } from '@/features/interactions/interactions-context';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { profileTarget } from '@/features/moderation/targets';
import { PostCard } from '@/features/posts/components/post-card';
import { useLocalFeedItems } from '@/features/posts/use-local-posts';
import { useAsyncData, type AsyncData } from '@/hooks/use-async-data';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { NotFoundError } from '@/lib/errors';
import { dayKey, formatDayRule, formatPeople } from '@/lib/format';
import { goBack, useNav } from '@/lib/routes';
import type { Comuna, CreatorInfo, FeedItem, Profile } from '@/types/models';

import { ComposerPrompt } from '@/features/feed/components/composer-prompt';
import { ProfileProgress } from '@/features/gamification/progress-screen';
import { LibraryPane } from '@/features/library/library-screen';

import { ProfilePhoto } from './profile-photo';
import { getProfile, getUserPostsPage, toProfile } from './api';
import { FollowButton } from './components/follow-button';
import { ProfileMediaGrid } from './components/profile-media-grid';
import { ProfileSwipeContent, ProfileTabs, ProfileTabSwipe, useProfileTabPanGesture } from './profile-tab-swipe';
import { profileTabOptions, type ProfileTabKey } from './profile-tabs';

type ProfileRow =
  | { kind: 'identity'; id: string }
  | { kind: 'tabs'; id: string }
  | { kind: 'content'; id: string }
  | { kind: 'post'; id: string; item: FeedItem; index: number; dayLabel?: string }
  | { kind: 'media'; id: string; items: FeedItem[] };

function SwipeAwarePostCard(props: ComponentProps<typeof PostCard>) {
  const mediaGesture = useProfileTabPanGesture();
  return <PostCard {...props} mediaGesture={mediaGesture} />;
}

/**
 * Perfil pessoal (2i) na aba Perfil e perfil de outras pessoas (2j), inclusive
 * criadoras com podcast. Sem `id` na rota, mostra o perfil da própria pessoa.
 */
export default function ProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const me = useMe();
  const { account } = useAccount();
  const toast = useToast();
  const isMe = !params.id || params.id === me.id || params.id === account?.id;
  const id = isMe ? 'me' : params.id!;
  const isTabRoot = params.id === undefined;

  const { joinedComunaIds } = useInteractions();
  const author = isMe && !DEMO_MODE ? account?.handle ?? '' : id;
  const loadPosts = useCallback((cursor: string | null, signal: AbortSignal) => getUserPostsPage(author, cursor, signal), [author]);
  // Na API, o próprio perfil lista as comunas de que a pessoa participa, com o papel dado pelo servidor.
  const loadComunas = useCallback(() => (!DEMO_MODE && isMe ? getMyComunas() : getComunas()), [isMe]);
  const profileQuery = useQuery({ queryKey: ['profile', id],
    queryFn: ({ signal }) => getProfile(id, signal), ...contentPolicy.profile,
    initialData: isMe && !DEMO_MODE && account ? () => toProfile(account) : undefined,
    initialDataUpdatedAt: 0,
  }, queryClient);
  const profile = { data: accessDenied(profileQuery.error) ? null : profileQuery.data,
    status: profileQuery.isPending ? 'loading' : profileQuery.isError ? 'error' : 'success',
    error: profileQuery.error, reload: profileQuery.refetch };
  const posts = useCachedPages({ queryKey: ['profile-posts', author], load: loadPosts, ...contentPolicy.profile, enabled: !!author });
  const comunas = useAsyncData(loadComunas);
  const reloadProfile = profileQuery.refetch;
  const reloadPosts = posts.refresh;
  const reloadComunas = comunas.reload;
  const seen = useRef({ joined: joinedComunaIds.join(','), account });
  useEffect(() => {
    if (seen.current.joined !== joinedComunaIds.join(',')) reloadComunas();
    if (seen.current.account !== account) void reloadProfile();
    seen.current = { joined: joinedComunaIds.join(','), account };
  }, [joinedComunaIds, account, reloadPosts, reloadComunas, reloadProfile]);
  useFocusEffect(useCallback(() => {
    // Voltar imediatamente não gera requests; dados antigos revalidam sem loader.
    for (const queryKey of [['profile', id], ['profile-posts', author]]) {
      const cached = queryClient.getQueryState(queryKey);
      if (cached && cached.fetchStatus === 'idle' && cached.dataUpdatedAt > 0 && Date.now() - cached.dataUpdatedAt > contentPolicy.profile.staleTime) {
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }
    }
  }, [id, author]));
  const reloadProfileContent = useCallback(() => {
    void reloadProfile(); reloadPosts(); reloadComunas();
  }, [reloadProfile, reloadPosts, reloadComunas]);
  const requestsLoading = profileQuery.isFetching || posts.isFetching || comunas.status === 'loading';
  const pullRefresh = useManualRefresh(requestsLoading, reloadProfileContent);

  const header = (handle?: string, onMore?: () => void, onBack?: () => void) => (
    <ProfileBar isMe={isMe} canGoBack={!isTabRoot || onBack !== undefined} handle={handle} onMore={onMore} onBack={onBack} onShare={() => {
      if (account?.id) void shareDestination({ kind: 'profile', id: account.id }).catch(() => toast.show('Não conseguimos compartilhar este perfil.'));
      else toast.show('Este perfil ainda não possui um link público.');
    }} />
  );

  if (profile.status === 'loading' && !profile.data) {
    return (
      <Screen>
        {header()}
        <StateView kind="loading" message="Carregando perfil" />
      </Screen>
    );
  }

  if (!profile.data) {
    const notFound = profile.error instanceof NotFoundError;
    return (
      <Screen>
        {header()}
        {notFound ? (
          <StateView kind="empty" title="Perfil não encontrado" message="A conta pode ter sido removida." />
        ) : (
          <StateView kind="error" message="Não conseguimos carregar este perfil." onRetry={profile.reload} />
        )}
      </Screen>
    );
  }

  return (
    <ProfileContent
      profile={profile.data}
      isMe={isMe}
      header={header}
      posts={posts}
      allComunas={comunas.data ?? []}
      comunasState={comunas}
      refreshing={pullRefresh.refreshing}
      onRefresh={pullRefresh.onRefresh}
    />
  );
}

type ContentProps = {
  profile: Profile;
  isMe: boolean;
  header: (handle?: string, onMore?: () => void, onBack?: () => void) => ReactNode;
  posts: ReturnType<typeof useCachedPages<FeedItem>>;
  allComunas: Comuna[];
  comunasState: AsyncData<Comuna[]>;
  refreshing: boolean;
  onRefresh: () => void;
};

function ProfileContent({ profile, isMe, header, posts, allComunas, comunasState, refreshing, onRefresh }: ContentProps) {
  const visibility = useListVisibility();
  const toast = useToast();
  const nav = useNav();
  const sheet = useActionsSheet();
  const me = useMe();
  const { profile: account, replaceAvatarUrl } = useAccount();
  const { membershipOf } = useInteractions();
  const { width, fontScale } = useWindowDimensions();
  // Em telas estreitas ou com fonte ampliada, as ações irmãs viram uma coluna.
  const stackActions = width < 340 || fontScale > 1.2;
  const localPosts = useLocalFeedItems((p) => isMe && p.authorId === 'me');
  const [tab, setTab] = useState<ProfileTabKey>('posts');
  const tabs = useMemo(() => profileTabOptions(Boolean(profile.creator)), [profile.creator]);
  const tabKeys = useMemo(() => tabs.map((item) => item.key), [tabs]);
  const scrollY = useRef(0);
  const offsets = useRef<Partial<Record<ProfileTabKey, number>>>({});
  const listRef = useRef<FlashListRef<ProfileRow>>(null);
  const selectTab = useCallback((next: ProfileTabKey) => {
    const current = tabs.some((item) => item.key === tab) ? tab : 'posts';
    if (next === current) return;
    offsets.current[current] = scrollY.current;
    setTab(next);
  }, [tab, tabs]);
  const onListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);
  const pageKey = tabs.some((item) => item.key === tab) ? tab : 'posts';
  useLayoutEffect(() => {
    if (pageKey === 'biblioteca') return;
    const y = offsets.current[pageKey] ?? 0;
    scrollY.current = y;
    listRef.current?.scrollToOffset({ offset: y, animated: false });
  }, [pageKey]);

  // No próprio perfil, nome, @, bio, cidade e comunas vêm do cadastro e do estado local.
  const user = isMe ? me : profile.user;
  const bio = isMe ? account.bio.trim() || profile.bio : profile.bio;
  const metaLines = isMe
    ? [account.city.trim(), ...profile.meta.split(' · ').filter((part) => part.trim() && part.trim().toLowerCase() !== account.city.trim().toLowerCase())].filter(Boolean)
    : profile.meta.split(' · ').filter(Boolean);
  const postItems = useMemo(() => mergeById(localPosts, posts.items), [localPosts, posts.items]);
  const stats = [
    { value: `${postItems.length}${posts.hasMore ? '+' : ''}`, label: 'Publicações' },
    { value: formatPeople(profile.followerCount ?? 0), label: profile.followerCount === 1 ? 'Seguidor' : 'Seguidores', onPress: () => nav.openRelations('seguidores', isMe ? me.id : profile.user.id), accessibilityHint: 'Abre a lista de seguidores' },
    { value: formatPeople(profile.followingCount ?? 0), label: 'Seguindo', onPress: () => nav.openRelations('seguindo', isMe ? me.id : profile.user.id), accessibilityHint: 'Abre a lista de quem este perfil segue' },
    ...profile.stats.filter((stat) => !['publicações', 'seguidores', 'seguindo'].includes(stat.label.toLowerCase())),
  ];
  // Própria conta: participação local ou, na API, a informada pelo servidor com cada comuna.
  const comunas = useMemo(
    () =>
      isMe
        ? allComunas.filter((c) => membershipOf(c.id) ?? c.viewerIsMember ?? false)
        : profile.comunaIds.map((cid) => allComunas.find((c) => c.id === cid)).filter((c): c is Comuna => !!c),
    [isMe, membershipOf, profile.comunaIds, allComunas],
  );

  const soon = (what: string) => () => toast.show(`${what} chega numa próxima etapa.`);

  const rows: ProfileRow[] = [{ kind: 'identity', id: 'identity' }, { kind: 'tabs', id: 'tabs' }, { kind: 'content', id: 'content' }];
  if (pageKey === 'posts') postItems.forEach((item, index) => {
    const previous = index > 0 ? postItems[index - 1] : null;
    const newDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
    rows.push({ kind: 'post', id: item.id, item, index, ...(newDay ? { dayLabel: formatDayRule(item.createdAt) } : {}) });
  });
  if (pageKey === 'media') {
    const media = postItems.filter((item) => item.attachment);
    for (let index = 0; index < media.length; index += 3) rows.push({ kind: 'media', id: `media-${media[index].id}`, items: media.slice(index, index + 3) });
  }
  const identity = (<View style={styles.column}>
          {profile.creator ? <Masthead creator={profile.creator} /> : null}
          <View style={styles.identityBlock}>
            <View style={styles.identity}>
              <ProfilePhoto user={user} editable={isMe && !DEMO_MODE} onUploaded={replaceAvatarUrl} />
              <View style={styles.names}>
                {user.badge ? (
                  <View style={styles.badge}>
                    <Badge label={user.badge} tone="red" />
                  </View>
                ) : null}
                <AppText style={styles.name} accessibilityRole="header" numberOfLines={3}>
                  {user.name}
                </AppText>
                <AppText variant="label" style={styles.handle}>
                  @{user.handle}
                </AppText>
              </View>
            </View>
            {profile.isPrivate ? (
              <View style={styles.privateNote}>
                <Icon name="shield" size={18} color={Colors.red} />
                <AppText variant="caption" style={styles.privateText}>
                  Perfil privado · Novos seguidores precisam de aprovação. Cada PDF mantém o acesso escolhido.
                </AppText>
              </View>
            ) : null}
            {bio ? <AppText style={styles.bio}>{bio}</AppText> : null}
            {metaLines.length > 0 ? (
              <View style={styles.metaList}>
                {metaLines.map((line, index) => (
                  <View key={line} style={styles.metaRow}>
                    <Icon name={index === 0 ? 'pin' : 'calendar'} size={18} color={Colors.muted} />
                    <AppText style={styles.meta} color={Colors.muted}>{line}</AppText>
                  </View>
                ))}
              </View>
            ) : null}
            <StatRow stats={stats} />
            {isMe ? <ProfileProgress /> : null}

            {isMe ? (
              <View style={[styles.actionPair, stackActions && styles.actionStack]}>
                <ProfileShortcut
                  label="Itens salvos"
                  icon="bookmark"
                  tone="ink"
                  onPress={() => router.push({ pathname: '/biblioteca', params: { scope: 'personal', section: 'salvos' } })}
                  style={[styles.action, stackActions && styles.actionStackItem]}
                />
                <ProfileShortcut
                  label="Meus interesses"
                  icon="heart"
                  tone="red"
                  onPress={() => router.push('/interesses')}
                  style={[styles.action, stackActions && styles.actionStackItem]}
                />
              </View>
            ) : (
              <View style={[styles.actions, stackActions && styles.actionStack]}>
                <FollowButton
                  user={{ ...user, isPrivate: profile.isPrivate, viewerFollowing: profile.user.viewerFollowing, viewerRequested: profile.user.viewerRequested }}
                  appearance="editorial"
                  style={[styles.action, stackActions && styles.actionStackItem]}
                />
                <EditorialAction
                  label="Mensagem"
                  icon="comment"
                  labelVariant="button"
                  onPress={soon('Mensagens')}
                  style={[styles.action, styles.secondaryAction, stackActions && styles.actionStackItem]}
                />
              </View>
            )}


            {profile.creator ? <CollectiveSupport creatorName={profile.creator.mastheadTitle} /> : null}
          </View>
        </View>);
  const tabBar = (
    <View style={styles.tabs}>
      <View style={styles.column}>
        <ProfileTabs options={tabs} value={pageKey} onChange={selectTab} height={44} />
      </View>
    </View>
  );
  const content = (<View style={styles.column}>
          {pageKey === 'posts' ? (
            <>
              {isMe ? <ComposerPrompt placeholder="O que você quer compartilhar?" /> : null}
              {posts.status === 'loading' && postItems.length === 0 ? (
                <PopulariaListSkeleton />
              ) : null}
              {posts.status === 'error' ? (
                <StateView kind="error" message="Não conseguimos carregar as publicações." onRetry={posts.refresh} />
              ) : null}
              {posts.status === 'success' && postItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <AppText style={styles.emptyTitle} color={Colors.muted}>Nenhuma publicação ainda.</AppText>
                  <AppText variant="caption" style={styles.emptyCaption}>Puxe a conversa, camarada: a primeira ideia pode ser sua.</AppText>
                </View>
              ) : null}

            </>
          ) : null}

          {pageKey === 'episodios' && profile.creator ? (
            <View style={styles.listPad}>
              {profile.creator.episodes.map((e) => (
                <View key={e.number} style={styles.episode}>
                  <AppText style={styles.episodeNumber} maxFontSizeMultiplier={1.1}>
                    {e.number}
                  </AppText>
                  <View style={styles.episodeText}>
                    <AppText style={styles.episodeTitle}>{e.title}</AppText>
                    <AppText style={styles.episodeMeta} color={Colors.muted}>
                      {e.meta}
                    </AppText>
                  </View>
                  <IconButton
                    icon="play"
                    size={16}
                    color={Colors.cream}
                    background={Colors.ink}
                    accessibilityLabel={`Ouvir episódio ${e.number}: ${e.title}`}
                    onPress={soon('O player')}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {pageKey === 'comunas' ? (
            <>
              <View style={styles.listPad}>
              {comunasState.status === 'loading' && !comunasState.data ? <StateView kind="loading" message="Carregando comunas" /> : null}
              {comunasState.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as comunas." onRetry={comunasState.reload} /> : null}
              {comunasState.status === 'success' && comunas.length === 0 ? (
                <View style={styles.emptyState}>
                  <AppText style={styles.emptyTitle} color={Colors.muted}>Ainda não participa de nenhuma comuna.</AppText>
                  <AppText variant="caption" style={styles.emptyCaption}>Bora encontrar a sua comunidade?</AppText>
                  {isMe ? (
                    <EditorialAction
                      label="Explorar comunas"
                      icon="globe"
                      labelVariant="button"
                      onPress={() => router.navigate('/explorar')}
                      style={styles.emptyAction}
                    />
                  ) : null}
                </View>
              ) : null}
              {comunas.map((c) => (
                <ComunaRow
                  key={c.id}
                  comuna={c}
                  subtitle={`${formatPeople(c.memberCount)} membros · ${c.place}`}
                  onOpen={() => nav.openComuna(c.id)}
                  trailing={
                    <RoleTag
                      label={
                        !DEMO_MODE && isMe
                          ? `${roleLabel(c.viewerRole ?? 'member')}${c.status === 'archived' ? ' · arquivada' : ''}`
                          : c.moderatorIds.includes(user.id)
                            ? 'Moderação'
                            : 'Membro'
                      }
                    />
                  }
                />
              ))}
              </View>
            </>
          ) : null}
        </View>);
  const page = pageKey === 'biblioteca' ? (
    <ProfileSwipeContent>
      <LibraryPane scope="personal" owner={user.id} canAdd={isMe} profileContext
        header={<ProfileTabs options={tabs} value={pageKey} onChange={selectTab} height={44} />} />
    </ProfileSwipeContent>
  ) : (
    <PopulariaList<ProfileRow>
      ref={listRef}
      data={rows}
      extraData={visibility.visibleIds}
      onViewableItemsChanged={visibility.onViewableItemsChanged}
      viewabilityConfig={mediaViewabilityConfig}
      keyExtractor={(row) => row.id}
      getItemType={(row) => row.kind === 'post' ? (row.item.poll ? 'post-poll' : 'post') : row.kind}
      stickyHeaderIndices={[1]}
      refreshing={refreshing} onRefresh={onRefresh}
      onScroll={onListScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.scroll}
      onEndReached={pageKey === 'posts' && !posts.loadMoreError ? posts.loadMore : undefined}
      renderItem={({ item }) => {
        const node = item.kind === 'identity' ? identity : item.kind === 'tabs' ? tabBar : item.kind === 'content' ? content : item.kind === 'post'
          ? <View style={styles.column}>
              {item.dayLabel ? <ProfileDayRule label={item.dayLabel} /> : item.index > 0 ? <View style={styles.postRule} /> : null}
              <SwipeAwarePostCard item={item.item} mediaVisible={visibility.visibleIds.has(item.id)} showRule={false} showMuted />
            </View>
          : <View style={styles.column}><ProfileMediaGrid posts={item.items} onOpen={nav.openPost} /></View>;
        if (item.kind === 'identity' || item.kind === 'tabs') return node;
        return <ProfileSwipeContent>{node}</ProfileSwipeContent>;
      }}
      ListFooterComponent={pageKey === 'posts' || pageKey === 'media' ? <ProfileSwipeContent><View style={styles.column}>
        {posts.refreshError ? <StateView kind="error" message="Não conseguimos atualizar as publicações." onRetry={posts.refresh} /> : null}
        {pageKey === 'media' && posts.status === 'loading' ? <PopulariaListSkeleton variant="row" /> : null}
        {pageKey === 'media' && posts.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar a mídia." onRetry={posts.refresh} /> : null}
        {pageKey === 'media' && rows.length === 3 && posts.status === 'success' ? (
          posts.hasMore ? <AppText style={styles.emptyText} color={Colors.muted}>Nenhuma mídia nesta página. Carregue mais publicações para continuar.</AppText> : (
            <View style={styles.emptyState}>
              <AppText style={styles.emptyTitle} color={Colors.muted}>Nenhuma imagem ou vídeo publicado ainda.</AppText>
              <AppText variant="caption" style={styles.emptyCaption}>Quando você publicar uma foto ou vídeo, ele aparece aqui.</AppText>
            </View>
          )
        ) : null}
        {posts.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais publicações." onRetry={posts.loadMore} />
          : posts.hasMore ? <PillButton label={posts.loadingMore ? 'Carregando…' : 'Carregar mais publicações'} variant="outline" disabled={posts.loadingMore} onPress={posts.loadMore} /> : null}
      </View></ProfileSwipeContent> : undefined}
    />
  );
  return (
    <Screen>
      {header(user.handle, isMe ? undefined : () => sheet.open(profileTarget(user, bio)), pageKey === 'biblioteca' ? () => setTab('posts') : undefined)}
      <ProfileTabSwipe tabs={tabKeys} active={pageKey} onChange={selectTab}>
        {page}
      </ProfileTabSwipe>
    </Screen>
  );
}

type ProfileBarProps = { isMe: boolean; canGoBack: boolean; handle?: string; onMore?: () => void; onBack?: () => void; onShare?: () => void };

function ProfileBar({ isMe, canGoBack, handle, onMore, onBack, onShare }: ProfileBarProps) {
  return (
    <View style={styles.bar}>
      {canGoBack ? <IconButton icon="back" accessibilityLabel="Voltar" onPress={onBack ?? goBack} /> : <View style={styles.barSpacer} />}
      {canGoBack ? <View style={styles.barDivider} /> : null}
      <AppText variant="label" style={styles.barHandle} numberOfLines={1} accessibilityRole="header">
        {handle ? `@${handle}` : 'Perfil'}
      </AppText>
      {isMe ? (
        <View style={styles.barActions}>
          <IconButton icon="edit" accessibilityLabel="Editar perfil" onPress={() => router.push('/conta/meus-dados' as never)} />
          <IconButton icon="shareNodes" accessibilityLabel="Compartilhar perfil" onPress={() => onShare?.()} />
          <IconButton icon="settings" accessibilityLabel="Conta e sessões" onPress={() => router.push('/conta')} />
        </View>
      ) : onMore ? (
        <IconButton icon="more" size={20} accessibilityLabel="Mais opções do perfil" onPress={onMore} />
      ) : (
        <View style={styles.barSpacerRight} />
      )}
    </View>
  );
}

/** Abre o dia no perfil como a mesma regra editorial do feed. */
function ProfileDayRule({ label }: { label: string }) {
  return (
    <View style={styles.dayRule} accessibilityRole="header">
      <AppText variant="label">{label}</AppText>
      <View style={styles.dayRuleLine} />
    </View>
  );
}

/** Atalho do perfil com ícone colorido: diferença sem pesar como ação principal. */
function ProfileShortcut({ label, icon, tone, onPress, style }: {
  label: string;
  icon: IconName;
  tone: 'ink' | 'red';
  onPress: () => void;
  style?: ComponentProps<typeof View>['style'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed, style]}>
      <View style={[styles.shortcutMark, tone === 'red' ? styles.shortcutMarkRed : styles.shortcutMarkInk]}>
        <Icon name={icon} size={18} color={Colors.red} />
      </View>
      <AppText style={styles.shortcutLabel}>{label}</AppText>
    </Pressable>
  );
}

/** Faixa escura de criadora com o nome do podcast (2j). */
function Masthead({ creator }: { creator: CreatorInfo }) {
  return (
    <View style={styles.masthead} accessible accessibilityLabel={`${creator.mastheadTitle}. ${creator.mastheadKicker}`}>
      <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
        {creator.mastheadKicker}
      </AppText>
      <AppText style={styles.mastTitle} color={Colors.cream} maxFontSizeMultiplier={1.1}>
        {creator.mastheadTitle}
      </AppText>
      <View style={styles.mastFoot}>
        <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
          {creator.mastheadLeft}
        </AppText>
        <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
          {creator.mastheadRight}
        </AppText>
      </View>
    </View>
  );
}

const TIERS = [
  { value: 'R$ 5', label: 'Ouvinte' },
  { value: 'R$ 15', label: 'Apoiadora' },
  { value: 'R$ 30', label: 'Coletivo' },
];

/** Apresentação do apoio coletivo. Ainda não existe: nada aqui aceita pagamento. */
function CollectiveSupport({ creatorName }: { creatorName: string }) {
  return (
    <View style={styles.support}>
      <View style={styles.supportHead}>
        <AppText style={styles.supportTitle}>Apoio coletivo</AppText>
        <View style={styles.soonTag}>
          <AppText style={styles.soonText}>Em breve</AppText>
        </View>
      </View>
      <AppText style={styles.supportText} color={Colors.inkSoft}>
        Em breve será possível apoiar o {creatorName} com contribuições mensais. Quem apoia vê para onde vai cada real.
      </AppText>
      <View style={styles.tiers}>
        {TIERS.map((t) => (
          <View key={t.label} style={styles.tier}>
            <AppText style={styles.tierValue} color={Colors.inkSoft}>
              {t.value}
            </AppText>
            <AppText style={styles.tierLabel} color={Colors.muted}>
              {t.label} · por mês
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function RoleTag({ label }: { label: string }) {
  return (
    <View style={styles.soonTag}>
      <AppText style={styles.soonText}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  barDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: Colors.ink,
  },
  barSpacer: {
    width: 44,
  },
  barSpacerRight: {
    width: 44,
  },
  barHandle: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    letterSpacing: 0.4,
    textTransform: 'none',
  },
  barActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -Spacing.one,
  },
  scroll: {
    paddingBottom: Spacing.seven,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  masthead: {
    backgroundColor: Colors.ink,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    paddingBottom: 14,
    borderBottomWidth: 5,
    borderBottomColor: Colors.red,
  },
  mastKicker: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mastTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 64,
    lineHeight: 60,
    textTransform: 'uppercase',
    marginTop: 6,
    paddingTop: 4,
  },
  mastFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two + 2,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.inkRule,
  },
  identityBlock: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingBottom: 14,
    gap: 12,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  names: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  name: {
    fontFamily: Fonts.anton,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -0.4,
    textTransform: 'uppercase',
    paddingTop: 2,
  },
  handle: {
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: 0.4,
    textTransform: 'none',
    marginTop: 6,
  },
  bio: {
    fontSize: 15.5,
    lineHeight: 22,
  },
  privateNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    backgroundColor: Colors.strawLight,
  },
  privateText: {
    flex: 1,
    lineHeight: 18,
  },
  meta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaList: {
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionPair: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionStack: {
    flexDirection: 'column',
  },
  actionStackItem: {
    flex: 0,
    width: '100%',
  },
  action: {
    flex: 1,
    minHeight: 50,
    borderRadius: Radius.sm,
  },
  secondaryAction: {
    borderWidth: 1,
  },
  shortcut: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.two + 2,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  shortcutPressed: {
    backgroundColor: Colors.strawLight,
  },
  shortcutMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutMarkInk: {
    backgroundColor: Colors.strawLight,
  },
  shortcutMarkRed: {
    backgroundColor: Colors.redSoft,
  },
  shortcutLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  support: {
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    padding: Spacing.four,
    gap: Spacing.three,
    backgroundColor: Colors.paper,
  },
  supportHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  supportTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  supportText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  tiers: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tier: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.rule,
    padding: Spacing.two + 2,
  },
  tierValue: {
    fontFamily: Fonts.condensed,
    fontSize: 24,
    lineHeight: 26,
  },
  tierLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  soonTag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.straw,
  },
  soonText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tabs: {
    minHeight: 46,
    justifyContent: 'center',
    backgroundColor: Colors.cream,
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
  },
  dayRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingTop: 14,
    paddingBottom: 0,
  },
  dayRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.inkSoft,
  },
  postRule: {
    height: 1,
    backgroundColor: Colors.rule,
  },
  emptyText: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
    fontSize: 15,
    textAlign: 'center',
  },
  listPad: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.one,
  },
  emptyState: {
    paddingVertical: Spacing.five,
    gap: Spacing.three,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyCaption: {
    textAlign: 'center',
    maxWidth: 340,
  },
  emptyAction: {
    alignSelf: 'stretch',
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  episodeNumber: {
    minWidth: 46,
    fontFamily: Fonts.condensed,
    fontSize: 38,
    lineHeight: 36,
    color: Colors.red,
  },
  episodeText: {
    flex: 1,
    minWidth: 0,
  },
  episodeTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  episodeMeta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },
});
