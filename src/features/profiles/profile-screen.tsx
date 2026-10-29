import { shareDestination } from '@/features/links/share';
import { useListVisibility, mediaViewabilityConfig } from '@/hooks/use-list-visibility';
import { useQuery } from '@tanstack/react-query';
import { PopulariaList } from '@/components/list/popularia-list';
import { PopulariaListSkeleton } from '@/components/list/popularia-list-skeleton';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { accessDenied, contentPolicy, queryClient } from '@/lib/query/client';
import { mergeById } from '@/lib/pagination';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StatRow } from '@/components/stat-row';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
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
import { formatPeople } from '@/lib/format';
import { goBack, useNav } from '@/lib/routes';
import type { Comuna, CreatorInfo, FeedItem, Profile } from '@/types/models';

import { ComposerPrompt } from '@/features/feed/components/composer-prompt';
import { LibraryPane } from '@/features/library/library-screen';

import { ProfilePhoto } from './profile-photo';
import { getProfile, getUserPostsPage, toProfile } from './api';
import { FollowButton } from './components/follow-button';
import { ProfileMediaGrid } from './components/profile-media-grid';

type ProfileTab = 'posts' | 'media' | 'episodios' | 'comunas' | 'biblioteca';

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
  const localPosts = useLocalFeedItems((p) => isMe && p.authorId === 'me');
  const [tab, setTab] = useState<ProfileTab>('posts');

  // No próprio perfil, nome, @, bio, cidade e comunas vêm do cadastro e do estado local.
  const user = isMe ? me : profile.user;
  const bio = isMe ? account.bio.trim() || profile.bio : profile.bio;
  const metaLines = isMe
    ? [account.city.trim(), ...profile.meta.split(' · ').filter((part) => part.trim() && part.trim().toLowerCase() !== account.city.trim().toLowerCase())].filter(Boolean)
    : profile.meta.split(' · ').filter(Boolean);
  const postItems = useMemo(() => mergeById(localPosts, posts.items), [localPosts, posts.items]);
  const stats = [{ value: `${postItems.length}${posts.hasMore ? '+' : ''}`, label: 'Publicações' }, ...profile.stats.filter((stat) => stat.label.toLowerCase() !== 'publicações')];
  // Própria conta: participação local ou, na API, a informada pelo servidor com cada comuna.
  const comunas = useMemo(
    () =>
      isMe
        ? allComunas.filter((c) => membershipOf(c.id) ?? c.viewerIsMember ?? false)
        : profile.comunaIds.map((cid) => allComunas.find((c) => c.id === cid)).filter((c): c is Comuna => !!c),
    [isMe, membershipOf, profile.comunaIds, allComunas],
  );

  const tabs: TabOption<ProfileTab>[] = [
    { key: 'posts', label: 'Publicações' },
    { key: 'media', label: 'Mídia' },
    ...(profile.creator ? [{ key: 'episodios' as const, label: 'Episódios' }] : []),
    { key: 'comunas', label: 'Comunas' },
    { key: 'biblioteca', label: 'Biblioteca pessoal' },
  ];

  const soon = (what: string) => () => toast.show(`${what} chega numa próxima etapa.`);

  if (tab === 'biblioteca') return <Screen>{header(user.handle, undefined, () => setTab('posts'))}
    <LibraryPane scope="personal" owner={user.id} canAdd={isMe} profileContext
      header={<UnderlineTabs options={tabs} value={tab} onChange={setTab} />} />
  </Screen>;

  type Row = { kind: 'identity'; id: string } | { kind: 'tabs'; id: string } | { kind: 'content'; id: string } | { kind: 'post'; id: string; item: FeedItem; index: number } | { kind: 'media'; id: string; items: FeedItem[] };
  const rows: Row[] = [{ kind: 'identity', id: 'identity' }, { kind: 'tabs', id: 'tabs' }, { kind: 'content', id: 'content' }];
  if (tab === 'posts') postItems.forEach((item, index) => rows.push({ kind: 'post', id: item.id, item, index }));
  if (tab === 'media') {
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
                <AppText style={styles.name} accessibilityRole="header">
                  {user.name}
                </AppText>
                <AppText variant="caption" style={styles.handle}>
                  @{user.handle}
                </AppText>
                {isMe ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Editar perfil"
                    onPress={() => router.push('/conta/meus-dados' as never)}
                    style={({ pressed }) => [styles.editAction, pressed && styles.pressed]}>
                    <Icon name="edit" size={18} color={Colors.ink} />
                    <AppText style={styles.editLabel}>Editar perfil</AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {profile.isPrivate ? <AppText variant="caption">Perfil privado · Novos seguidores precisam de aprovação. Cada PDF mantém o acesso escolhido.</AppText> : null}
            <AppText style={styles.bio}>{bio}</AppText>
            <View style={styles.metaList}>
              {metaLines.map((line, index) => (
                <View key={line} style={styles.metaRow}>
                  <Icon name={index === 0 ? 'pin' : 'calendar'} size={21} color={Colors.ink} />
                  <AppText style={styles.meta} color={Colors.muted}>{line}</AppText>
                </View>
              ))}
            </View>
            <StatRow stats={stats} />

            {isMe ? <View style={styles.actions}>
              <EditorialAction label="Itens salvos" icon="bookmark" iconPosition="trailing" onPress={() => router.push('/biblioteca' as never)} style={styles.action} />
              <EditorialAction label="Meus interesses" icon="heart" iconPosition="trailing" onPress={() => router.push('/interesses')} style={styles.action} />
            </View> : (
              <View style={styles.actions}>
                <FollowButton user={user} size="lg" display style={styles.action} />
                <PillButton
                  label="Mensagem"
                  onPress={soon('Mensagens')}
                  variant="outline"
                  size="lg"
                  display
                  style={styles.action}
                />
              </View>
            )}

            {isMe && comunas.length > 0 ? <ComunasShortcut count={comunas.length} onPress={() => setTab('comunas')} /> : null}

            {profile.creator ? <CollectiveSupport creatorName={profile.creator.mastheadTitle} /> : null}
          </View>
        </View>);
  const tabBar = (<View style={styles.tabs}>
          <View style={styles.column}>
            <UnderlineTabs options={tabs} value={tab} onChange={setTab} height={46} />
          </View>
        </View>);
  const content = (<View style={styles.column}>
          {tab === 'posts' ? (
            <>
              {isMe ? <ComposerPrompt placeholder="O que você quer compartilhar?" /> : null}
              {posts.status === 'loading' && postItems.length === 0 ? (
                <PopulariaListSkeleton />
              ) : null}
              {posts.status === 'error' ? (
                <StateView kind="error" message="Não conseguimos carregar as publicações." onRetry={posts.refresh} />
              ) : null}
              {posts.status === 'success' && postItems.length === 0 ? (
                <AppText style={styles.emptyText} color={Colors.muted}>
                  Nenhuma publicação ainda.
                </AppText>
              ) : null}

            </>
          ) : null}

          {tab === 'episodios' && profile.creator ? (
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

          {tab === 'comunas' ? (
            <>
              <View style={styles.listPad}>
              {comunasState.status === 'loading' && !comunasState.data ? <StateView kind="loading" message="Carregando comunas" /> : null}
              {comunasState.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as comunas." onRetry={comunasState.reload} /> : null}
              {comunasState.status === 'success' && comunas.length === 0 ? (
                <AppText style={styles.emptyRow} color={Colors.muted}>
                  Ainda não participa de nenhuma comuna.
                </AppText>
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
  return (
    <Screen>
      {header(user.handle, isMe ? undefined : () => sheet.open(profileTarget(user, bio)))}
      <PopulariaList<Row>
        data={rows}
        extraData={visibility.visibleIds}
        onViewableItemsChanged={visibility.onViewableItemsChanged}
        viewabilityConfig={mediaViewabilityConfig}
        keyExtractor={(row) => row.id}
        getItemType={(row) => row.kind === 'post' ? (row.item.poll ? 'post-poll' : 'post') : row.kind}
        stickyHeaderIndices={[1]}
        refreshing={refreshing} onRefresh={onRefresh}
        contentContainerStyle={styles.scroll}
        onEndReached={tab === 'posts' && !posts.loadMoreError ? posts.loadMore : undefined}
        renderItem={({ item }) => item.kind === 'identity' ? identity : item.kind === 'tabs' ? tabBar : item.kind === 'content' ? content : item.kind === 'post'
          ? <View style={styles.column}><PostCard item={item.item} mediaVisible={visibility.visibleIds.has(item.id)} showRule={item.index > 0} showMuted /></View>
          : <View style={styles.column}><ProfileMediaGrid posts={item.items} onOpen={nav.openPost} /></View>}
        ListFooterComponent={tab === 'posts' || tab === 'media' ? <View style={styles.column}>
          {posts.refreshError ? <StateView kind="error" message="Não conseguimos atualizar as publicações." onRetry={posts.refresh} /> : null}
          {tab === 'media' && posts.status === 'loading' ? <PopulariaListSkeleton variant="row" /> : null}
          {tab === 'media' && posts.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar a mídia." onRetry={posts.refresh} /> : null}
          {tab === 'media' && rows.length === 3 && posts.status === 'success' ? <AppText style={styles.emptyText} color={Colors.muted}>{posts.hasMore ? 'Nenhuma mídia nesta página. Carregue mais publicações para continuar.' : 'Nenhuma imagem ou vídeo publicado ainda.'}</AppText> : null}
          {posts.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais publicações." onRetry={posts.loadMore} />
            : posts.hasMore ? <PillButton label={posts.loadingMore ? 'Carregando…' : 'Carregar mais publicações'} variant="outline" disabled={posts.loadingMore} onPress={posts.loadMore} /> : null}
        </View> : undefined}
      />
    </Screen>
  );
}

type ProfileBarProps = { isMe: boolean; canGoBack: boolean; handle?: string; onMore?: () => void; onBack?: () => void; onShare?: () => void };

function ProfileBar({ isMe, canGoBack, handle, onMore, onBack, onShare }: ProfileBarProps) {
  return (
    <View style={styles.bar}>
      {canGoBack ? <IconButton icon="back" accessibilityLabel="Voltar" onPress={onBack ?? goBack} /> : <View style={styles.barSpacer} />}
      <AppText style={styles.barHandle} numberOfLines={1} accessibilityRole="header">
        {handle ? `@${handle}` : ''}
      </AppText>
      {isMe ? (
        <View style={styles.barActions}>
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

function ComunasShortcut({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Minhas comunas, ${count} ${count === 1 ? 'comuna' : 'comunas'}`}
      style={({ pressed }) => [styles.comunasShortcut, pressed && styles.pressed]}>
      <Icon name="shield" size={28} color={Colors.red} />
      <View style={styles.modText}>
        <AppText style={styles.modTitle} color={Colors.cream}>Minhas comunas</AppText>
        <AppText style={styles.modSub} color={Colors.onInkMuted}>{count} comunas · Membro e moderação</AppText>
      </View>
      <Icon name="chevronRight" size={22} color={Colors.cream} />
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  barSpacer: {
    width: 10,
  },
  barSpacerRight: {
    width: 44,
  },
  barHandle: {
    flex: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 12.5,
    lineHeight: 16,
  },
  barActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -Spacing.two,
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
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.four,
    gap: 14,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  editAction: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingVertical: Spacing.one,
    paddingRight: Spacing.three,
  },
  editLabel: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    lineHeight: 16,
    textDecorationLine: 'underline',
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
    fontFamily: Fonts.condensed,
    fontSize: 18,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  handle: {
    fontSize: 13.5,
    marginTop: 4,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
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
  action: {
    flex: 1,
    minHeight: 58,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  comunasShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.ink,
  },
  modShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.ink,
  },
  pressed: {
    opacity: 0.8,
  },
  modText: {
    flex: 1,
    minWidth: 0,
  },
  modTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  modSub: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  support: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    borderRadius: 14,
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
    fontSize: 14,
    lineHeight: 20,
  },
  tiers: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tier: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.strawDark,
    borderRadius: Radius.lg,
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
    backgroundColor: Colors.cream,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  emptyText: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
    fontSize: 14.5,
    textAlign: 'center',
  },
  listPad: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.one,
  },
  emptyRow: {
    paddingVertical: Spacing.five,
    fontSize: 14.5,
    textAlign: 'center',
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
