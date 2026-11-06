import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { PillButton } from '@/components/pill-button';
import { PopulariaList } from '@/components/list/popularia-list';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { type TabOption } from '@/components/underline-tabs';
import { DEMO_MODE } from '@/constants/config';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getComunaPosts, getPinnedPosts } from '@/features/comunas/api';
import { ComunaHero } from '@/features/comunas/components/comuna-hero';
import { MembersList, ServerMembersList } from '@/features/comunas/components/members-list';
import { PinnedCard } from '@/features/comunas/components/pinned-card';
import { PinnedPosts } from '@/features/comunas/components/pinned-posts';
import { RulesList } from '@/features/comunas/components/rules-list';
import { comunaKeys } from '@/features/comunas/keys';
import { movePinnedPost, useComunaPinPending } from '@/features/comunas/pins';
import { useComuna } from '@/features/comunas/queries';
import { useInteractions } from '@/features/interactions/interactions-context';
import { LibraryPane } from '@/features/library/library-screen';
import { ProfileSwipeContent, ProfileTabs, ProfileTabSwipe, useProfileTabPanGesture } from '@/features/profiles/profile-tab-swipe';
import { PostCard } from '@/features/posts/components/post-card';
import { preparePost } from '@/features/posts/queries';
import { rememberPost } from '@/features/posts/save';
import { useLocalFeedItems } from '@/features/posts/use-local-posts';
import { NextEvent } from '@/features/events/next-event';
import { SquareEntry } from '@/features/squares/square-entry';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { mediaViewabilityConfig, MediaVisibilityProvider, useListVisibility } from '@/hooks/use-list-visibility';
import { useRouteMediaFocus } from '@/hooks/use-route-media-focus';
import { ApiError, describeError, NotFoundError } from '@/lib/errors';
import { dayKey, formatDayRule, formatPeople } from '@/lib/format';
import { mergeById } from '@/lib/pagination';
import { contentPolicy, queryClient } from '@/lib/query/client';
import { useNav } from '@/lib/routes';
import type { FeedItem } from '@/types/models';

type ComunaTab = 'posts' | 'biblioteca' | 'regras' | 'membros';

const TABS: TabOption<ComunaTab>[] = [
  { key: 'posts', label: 'Publicações' },
  { key: 'biblioteca', label: 'Biblioteca' },
  { key: 'regras', label: 'Regras' },
  { key: 'membros', label: 'Membros' },
];
const TAB_KEYS = TABS.map((t) => t.key);
const TABS_HEIGHT = 44;

/** Índice da barra de abas em `rows`: ela fica fixa ao rolar (sticky header da FlashList). */
const TABS_ROW_INDEX = 1;
// Estáveis entre renders: a FlashList reavalia os headers fixos quando essas props mudam.
const STICKY_HEADER_INDICES = [TABS_ROW_INDEX];
const STICKY_HEADER_CONFIG = { hideRelatedCell: true };

/**
 * Linhas da lista: cabeçalho e abas são células estáveis (a FlashList fixa a de índice 1);
 * as publicações são recicladas. `kind` alimenta o `getItemType`.
 */
type ComunaRow =
  | { kind: 'hero'; id: string }
  | { kind: 'tabs'; id: string }
  | { kind: 'intro'; id: string }
  | { kind: 'empty'; id: string }
  | { kind: 'post'; id: string; item: FeedItem; index: number; dayLabel?: string }
  | { kind: 'rules'; id: string }
  | { kind: 'members'; id: string };

const ROW_IDS = {
  hero: 'comuna-hero',
  tabs: 'comuna-tabs',
  intro: 'comuna-posts-intro',
  empty: 'comuna-posts-empty',
  rules: 'comuna-rules',
  members: 'comuna-members',
} as const;

/** Publicação com o gesto de swipe da aba cedendo aos controles nativos do vídeo. */
function SwipeAwarePostCard(props: ComponentProps<typeof PostCard>) {
  const mediaGesture = useProfileTabPanGesture();
  return <PostCard {...props} mediaGesture={mediaGesture} />;
}

/** Página da comuna (design 1b). */
export default function ComunaScreen() {
  const { id, aba } = useLocalSearchParams<{ id: string; aba?: string }>();
  // "Ver regras da comuna" (depois de uma denúncia) abre direto na aba Regras.
  const [tab, setTab] = useState<ComunaTab>(TABS.some((t) => t.key === aba) ? (aba as ComunaTab) : 'posts');
  const insets = useSafeAreaInsets();
  // Trocar de aba ou de comuna remonta a lista. A viewport é local a esse par:
  // os IDs da janela anterior não valem para a próxima montagem e não devem
  // montar players antes de a nova viewability confirmar os cartões.
  const visibility = useListVisibility(`${id}:${tab}`);
  // Abrir uma publicação, trocar de aba ou sair da rota pausa a lista e deixa
  // os cartões no pôster; na volta, só a viewport retida volta a valer.
  useRouteMediaFocus(visibility);

  const loadPosts = useCallback((cursor: string | null) => getComunaPosts(id, cursor), [id]);
  const postsKey = useMemo(() => comunaKeys.posts(id), [id]);
  const comuna = useComuna(id);
  const posts = useCachedPages({
    queryKey: postsKey,
    load: loadPosts,
    performanceScope: 'comuna',
    // A lista mostra o erro com "Tentar de novo" em vez de repetir sozinha (como antes do cache).
    retry: false,
    ...contentPolicy.comuna,
  });
  // Modo demonstração: publicações feitas neste aparelho aparecem no topo, antes das dos mocks.
  const localPosts = useLocalFeedItems();
  // `useLocalFeedItems()` sem filtro é estável entre renders; filtrar aqui evita recriar
  // as linhas a cada mudança de viewability durante a rolagem.
  const postItems = useMemo(
    () => mergeById(localPosts.filter((p) => p.comunaId === id), posts.items),
    [id, localPosts, posts.items],
  );
  const { show: showToast } = useToast();
  const nav = useNav();
  const { postsVersion, membershipOf, setOn } = useInteractions();
  const viewerIsMember = membershipOf(id) ?? comuna.data?.viewerIsMember;
  const privateOutside = !DEMO_MODE && comuna.data?.visibility === 'private' && !viewerIsMember;
  const pins = useQuery({
    queryKey: comunaKeys.pins(id),
    queryFn: () => getPinnedPosts(id),
    enabled: !DEMO_MODE && tab === 'posts' && !!comuna.data && !privateOutside,
    ...contentPolicy.comuna,
  }, queryClient);
  const pinPending = useComunaPinPending(id);
  useEffect(() => {
    for (const item of pins.data ?? []) rememberPost(item);
  }, [pins.data]);

  // Depois de publicar (na API), recarrega as publicações para mostrar a nova.
  useEffect(() => {
    if (!DEMO_MODE && comuna.data) setOn('joinedComunas', [id], comuna.data.viewerIsMember ?? false);
  }, [comuna.data, id, setOn]);
  const seenVersion = useRef(postsVersion);
  const { refresh, refreshError } = posts;
  useEffect(() => {
    if (seenVersion.current === postsVersion) return;
    seenVersion.current = postsVersion;
    refresh();
  }, [postsVersion, refresh]);
  useEffect(() => {
    if (refreshError) showToast(`Não foi possível atualizar. ${describeError(refreshError)}`);
  }, [refreshError, showToast]);

  // A nova capa usa papel claro; a barra de status acompanha esse fundo.
  // Voltar dentro do staleTime não dispara nada: o detalhe e as páginas já estão no cache.
  const focusedOnce = useRef(false);
  const seenMembership = useRef(viewerIsMember);
  const privateComuna = comuna.data?.visibility === 'private';
  useEffect(() => {
    if (seenMembership.current !== undefined && seenMembership.current !== viewerIsMember) {
      // Em comuna privada o vínculo abre/fecha as publicações. Entrar/sair já invalida
      // a lista; evitar um refresh manual concorrente.
      if (privateComuna && !queryClient.getQueryState(postsKey)?.isInvalidated) refresh();
    }
    seenMembership.current = viewerIsMember;
  }, [viewerIsMember, privateComuna, postsKey, refresh]);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark');
      if (focusedOnce.current && !DEMO_MODE) {
        const cached = queryClient.getQueryState(comunaKeys.detail(id));
        if (cached?.dataUpdatedAt && Date.now() - cached.dataUpdatedAt > contentPolicy.comuna.staleTime) {
          void queryClient.invalidateQueries({ queryKey: comunaKeys.detail(id), exact: true });
        }
      }
      focusedOnce.current = true;
      return () => setStatusBarStyle('dark');
    }, [id]),
  );

  const rows = useMemo<ComunaRow[]>(() => {
    const next: ComunaRow[] = [
      { kind: 'hero', id: ROW_IDS.hero },
      { kind: 'tabs', id: ROW_IDS.tabs },
    ];
    if (tab === 'posts') {
      next.push({ kind: 'intro', id: ROW_IDS.intro });
      // Comuna privada sem participação: o recado substitui publicações e paginação.
      if (privateOutside) return next;
      if (posts.status === 'success' && postItems.length === 0) next.push({ kind: 'empty', id: ROW_IDS.empty });
      postItems.forEach((item, index) => {
        const previous = index > 0 ? postItems[index - 1] : null;
        const newDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
        next.push({ kind: 'post', id: item.id, item, index, ...(newDay ? { dayLabel: formatDayRule(item.createdAt) } : {}) });
      });
      return next;
    }
    next.push(tab === 'regras' ? { kind: 'rules', id: ROW_IDS.rules } : { kind: 'members', id: ROW_IDS.members });
    return next;
  }, [postItems, posts.status, privateOutside, tab]);

  // Ao recarregar, os dados anteriores continuam na tela.
  if (comuna.status === 'loading' && !comuna.data) {
    return (
      <Screen>
        <StateView kind="loading" message="Carregando comuna" />
      </Screen>
    );
  }

  if (!comuna.data) {
    const notFound = comuna.error instanceof NotFoundError;
    return (
      <Screen>
        {notFound ? (
          <StateView kind="empty" title="Comuna não encontrada" message="Ela pode ter sido removida ou o link está errado." />
        ) : (
          <StateView kind="error" message="Não conseguimos carregar esta comuna." onRetry={comuna.reload} />
        )}
      </Screen>
    );
  }

  const data = comuna.data;

  if (tab === 'biblioteca') {
    const canAddDocument = data.status !== 'archived' && (data.viewerRole === 'founder' || data.viewerRole === 'moderator');
    return <ProfileTabSwipe tabs={TAB_KEYS} active={tab} onChange={setTab}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ProfileSwipeContent fill>
          <LibraryPane scope="comuna" comuna={id} canAdd={canAddDocument} profileContext
            header={<View style={{ backgroundColor: Colors.cream }}>
              <ComunaHero comuna={data} onChanged={comuna.reload} postCountLabel={`${postItems.length}${posts.hasMore ? '+' : ''}`} />
              <ProfileTabs options={TABS} value={tab} onChange={setTab} height={TABS_HEIGHT} />
              {canAddDocument ? <View style={styles.libraryActions}>
                <EditorialAction label="Adicionar PDF à biblioteca" icon="plus" tone="red" onPress={() => router.push({ pathname: '/biblioteca/enviar', params: { comuna: id } })} />
              </View> : null}
            </View>} />
        </ProfileSwipeContent>
      </View>
    </ProfileTabSwipe>;
  }

  const postCountLabel = `${postItems.length}${posts.hasMore ? '+' : ''}`;
  const postsIntro = (
    <View style={styles.column}>
      <SquareEntry key={`${id}-${data.viewerRole}-${data.status}`} slug={id} />
      {privateOutside ? (
        <StateView kind="empty" title="Comuna privada" message="Só quem participa vê as publicações." />
      ) : (
        <>
          {!DEMO_MODE ? <NextEvent slug={id} /> : null}
          {DEMO_MODE && data.pinned ? <PinnedCard title={data.pinned.title} text={data.pinned.text} /> : null}
          {!DEMO_MODE ? (
            <PinnedPosts
              items={pins.data ?? []}
              status={pins.isError ? 'error' : pins.isPending ? 'loading' : 'success'}
              canReorder={data.status !== 'archived' && !!data.viewerPermissions?.canModerateContent}
              pending={pinPending}
              onRetry={() => { void pins.refetch(); }}
              onOpen={(postId) => {
                const item = (pins.data ?? []).find((pin) => pin.id === postId);
                if (item) preparePost(item);
                nav.openPost(postId);
              }}
              onMove={(postId, position) => { void movePinnedPost(id, postId, position, showToast); }}
            />
          ) : null}
          {posts.status === 'loading' ? <StateView kind="loading" message="Carregando publicações" /> : null}
          {posts.status === 'error' ? <PostsError error={posts.error} onRetry={posts.refresh} /> : null}
        </>
      )}
    </View>
  );

  const postsEmpty = (
    <View style={styles.column}>
      <View style={styles.emptyState}>
        <AppText style={styles.emptyTitle} color={Colors.muted}>Nenhuma publicação ainda.</AppText>
        <AppText variant="caption" style={styles.emptyCaption}>Seja a primeira pessoa a abrir a conversa, camarada.</AppText>
      </View>
    </View>
  );

  const footer = tab === 'posts' && !privateOutside ? (
    <ProfileSwipeContent>
      <View style={styles.column}>
        {posts.loadMoreError ? (
          <StateView kind="error" message="Não conseguimos carregar mais publicações." onRetry={posts.loadMore} />
        ) : posts.hasMore ? (
          <PillButton
            label={posts.loadingMore ? 'Carregando…' : 'Carregar mais publicações'}
            onPress={posts.loadMore}
            disabled={posts.loadingMore}
            variant="outline"
            style={styles.more}
          />
        ) : null}
      </View>
    </ProfileSwipeContent>
  ) : null;

  return (
    // Faixa escura atrás da barra de status; o conteúdo rola abaixo dela.
    <ProfileTabSwipe tabs={TAB_KEYS} active={tab} onChange={setTab}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <MediaVisibilityProvider visibility={visibility}>
          <PopulariaList<ComunaRow>
            data={rows}
            keyExtractor={(row) => row.id}
            getItemType={(row) => row.kind === 'post'
              ? `${row.item.poll ? 'poll' : 'text'}:${row.item.attachment?.type ?? (row.item.document ? 'document' : 'plain')}`
              : row.kind}
            stickyHeaderIndices={STICKY_HEADER_INDICES}
            stickyHeaderConfig={STICKY_HEADER_CONFIG}
            onViewableItemsChanged={visibility.onViewableItemsChanged}
            viewabilityConfig={mediaViewabilityConfig}
            performanceListId={`comuna:${id}:${tab}`}
            contentContainerStyle={styles.scroll}
            ListHeaderComponent={comuna.status === 'error' ? (
              <View style={styles.column}>
                <StateView kind="error" message="Não conseguimos atualizar a comuna." onRetry={comuna.reload} />
              </View>
            ) : null}
            ListFooterComponent={footer}
            renderItem={({ item }) => {
              if (item.kind === 'hero') {
                return (
                  <View style={styles.column}>
                    <ComunaHero comuna={data} onChanged={comuna.reload} postCountLabel={postCountLabel} />
                  </View>
                );
              }
              if (item.kind === 'tabs') {
                return (
                  <View style={styles.tabs}>
                    <View style={styles.column}>
                      <ProfileTabs options={TABS} value={tab} onChange={setTab} height={TABS_HEIGHT} />
                    </View>
                  </View>
                );
              }
              if (item.kind === 'post') {
                return (
                  <ProfileSwipeContent>
                    <View style={styles.column}>
                      {item.dayLabel ? <ComunaDayRule label={item.dayLabel} /> : <View style={styles.postRule} />}
                      <SwipeAwarePostCard
                        item={item.item}
                        showRule={false}
                        showComuna={false}
                      />
                    </View>
                  </ProfileSwipeContent>
                );
              }
              return (
                <ProfileSwipeContent>
                  {item.kind === 'intro' ? postsIntro
                    : item.kind === 'empty' ? postsEmpty
                      : item.kind === 'rules' ? (
                        <View style={styles.column}>
                          <RulesList rules={data.rules} moderationNote={data.moderationNote} moderators={data.moderators} />
                        </View>
                      ) : (
                        <View style={styles.column}>
                          {DEMO_MODE ? (
                            <MembersList members={data.members} totalLabel={formatPeople(data.memberCount)} />
                          ) : (
                            <ServerMembersList comuna={data} />
                          )}
                        </View>
                      )}
                </ProfileSwipeContent>
              );
            }}
          />
        </MediaVisibilityProvider>
      </View>
    </ProfileTabSwipe>
  );
}

/** Abre o dia na comuna como a mesma regra editorial do feed e do perfil. */
function ComunaDayRule({ label }: { label: string }) {
  return (
    <View style={styles.dayRule} accessibilityRole="header">
      <AppText variant="label">{label}</AppText>
      <View style={styles.dayRuleLine} />
    </View>
  );
}

/** Comuna privada sem participação: a API recusa as publicações (403 /errors/comuna-private). */
function PostsError({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  if (error instanceof ApiError && error.type === '/errors/comuna-private') {
    return <StateView kind="empty" title="Comuna privada" message="Só quem participa vê as publicações." />;
  }
  return <StateView kind="error" message={`Não conseguimos carregar as publicações. ${describeError(error)}`} onRetry={onRetry} />;
}

const styles = StyleSheet.create({
  libraryActions: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.three,
  },
  more: {
    alignSelf: 'center',
    marginVertical: Spacing.five,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  scroll: {
    paddingBottom: Spacing.seven,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
    paddingTop: Spacing.five,
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
  emptyState: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyCaption: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
