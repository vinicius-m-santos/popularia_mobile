import { keepPreviousData, useInfiniteQuery, useQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams, useScrollToTop } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialBar } from '@/components/editorial-bar';
import { FilterChipRow } from '@/components/filter-chips';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PopulariaListSkeleton } from '@/components/list/popularia-list-skeleton';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { ComunaRow } from '@/features/comunas/components/comuna-row';
import { JoinButton } from '@/features/comunas/components/join-button';
import { DocumentCard } from '@/features/library/document-card';
import { PersonRow } from '@/features/profiles/components/person-row';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { useStickyControlsScroll } from '@/hooks/use-sticky-controls-scroll';
import { formatPeople } from '@/lib/format';
import type { Page } from '@/lib/pagination';
import { contentPolicy, queryClient, revalidateIfStale } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { goBack, useNav } from '@/lib/routes';
import type { Comuna, FeedItem, Topic, TopicId } from '@/types/models';

import { searchDiscovery, type DiscoveryData, type DiscoveryEntry, type DiscoveryFilter } from './api';
import { ComunasToKnowSection, suggestedComunas } from './comunas-carousel';
import { DiscoveryEventRow } from './discovery-event-row';
import { DiscoveryPostRow } from './discovery-post-row';
import { useDiscovery } from './queries';
import { selectTrendingPosts, TrendingNowSection, TrendingNowSkeleton } from './trending-now';

const FILTERS: { key: DiscoveryFilter; label: string; action: string }[] = [
  { key: 'all', label: 'Tudo', action: 'Ver todas' },
  { key: 'comunas', label: 'Comunas', action: 'Ver todas' },
  { key: 'people', label: 'Pessoas', action: 'Ver todas' },
  { key: 'posts', label: 'Publicações', action: 'Ver todas' },
  { key: 'events', label: 'Eventos', action: 'Ver todos' },
  { key: 'documents', label: 'Documentos', action: 'Ver todos' },
];
const PREVIEW_LIMIT = 3;
const TOPIC_PREVIEW_LIMIT = 6;
// O título é o cabeçalho da lista (índice 0); a célula de busca/filtros é o
// primeiro item (índice 1). A referência precisa ser estável entre renders para
// a lista não reavaliar o header fixo a cada tecla.
const STICKY_HEADER_INDICES = [1];
const EMPTY_TOPICS: Topic[] = [];
const EMPTY_INTERESTS: TopicId[] = [];
const EMPTY_POSTS: FeedItem[] = [];
const EMPTY_COMUNAS: Comuna[] = [];
const INTERESTS_CACHE_LIMIT = 32;
const interestsCache = new Map<string, TopicId[]>();

/**
 * A conta pode entregar uma referência nova de `interests` com o mesmo conteúdo
 * (por exemplo, depois de `reloadAccount`). O cache devolve a referência antiga
 * para a lista de descoberta não reconstruir as linhas. É um cache de módulo,
 * então também compartilha a identidade entre montagens; o React Compiler só
 * memoiza por instância e não cobriria esse caso.
 */
export function stableInterestsFor(interests: TopicId[] | undefined, key: string): TopicId[] {
  const current = interests ?? EMPTY_INTERESTS;
  const cached = interestsCache.get(key);
  if (cached && cached.length === current.length && cached.every((id, index) => id === current[index])) {
    return cached;
  }
  if (!cached && interestsCache.size >= INTERESTS_CACHE_LIMIT) {
    const oldest = interestsCache.keys().next().value;
    if (oldest !== undefined) interestsCache.delete(oldest);
  }
  interestsCache.set(key, current);
  return current;
}
// A busca agrupa os mesmos tipos da descoberta, sem repetir a lista a cada render.
const SEARCH_SECTIONS = FILTERS.filter((option) => option.key !== 'all');

type DiscoveryRow =
  | { key: string; kind: 'controls' | 'topics' | 'library' | 'trending' | 'trending-skeleton' | 'comuna-carousel' }
  | { key: string; kind: 'section'; label: string; filter?: DiscoveryFilter; action?: string }
  | { key: string; kind: 'hit'; entry: DiscoveryEntry }
  | { key: string; kind: 'state'; content: ReactNode };

export default function ExploreScreen() {
  return <DiscoveryScreen />;
}

export function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DiscoveryScreen key={id} topicId={id} />;
}

/** Uma única lista mantém o campo montado ao trocar descoberta, busca e categorias. */
function DiscoveryScreen({ topicId }: { topicId?: string }) {
  const me = useMe();
  const nav = useNav();
  const { interests, profile } = useAccount();
  const interestKey = (interests ?? []).join(',');
  const stableInterests = stableInterestsFor(interests, interestKey);
  // A chave inclui os interesses porque a descoberta é personalizada por eles.
  const discovery = useDiscovery(me.id, topicId, interestKey);
  const data = discovery;
  const trending = useMemo(
    () => data.data ? selectTrendingPosts([...data.data.posts, ...data.data.recentPosts]) : EMPTY_POSTS,
    [data.data],
  );
  const suggestions = useMemo(
    () => data.data && !topicId ? suggestedComunas(data.data.comunas, stableInterests, profile.city) : EMPTY_COMUNAS,
    [data.data, topicId, stableInterests, profile.city],
  );
  const { reload } = data;
  const list = useRef<FlatList<DiscoveryRow>>(null);
  useScrollToTop(list);
  const stickyControls = useStickyControlsScroll(list);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const [topicsOpen, setTopicsOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const topic = data.data?.topics.find((t) => t.id === topicId);
  // O /explore?topic= não inclui documentos; usa a busca por assunto para trazer o acervo.
  const topicDocuments = useQuery<Page<DiscoveryEntry>>({
    queryKey: queryKeys.discovery.topicDocuments(me.id, topicId ?? ''),
    queryFn: ({ signal }) => searchDiscovery(me.id, '', 'documents', topicId, null, signal),
    enabled: !!topicId && !!topic,
    retry: false,
    ...contentPolicy.discovery,
    // Se a pessoa já abriu a categoria Documentos neste assunto, o preview usa
    // a mesma página em cache em vez de nascer com um loader.
    placeholderData: () => topicId ? cachedSearchPage(queryKeys.discovery.search(me.id, '', 'documents', topicId)) : undefined,
  }, queryClient);
  const topicDocumentItems = useMemo(
    () => (topicDocuments.data?.items ?? []).filter((entry): entry is Extract<DiscoveryEntry, { kind: 'documents' }> => entry.kind === 'documents'),
    [topicDocuments.data],
  );
  const refetchTopicDocuments = topicDocuments.refetch;
  const trimmedQuery = query.trim();
  const showHome = !trimmedQuery && filter === 'all';
  const short = !!trimmedQuery && (trimmedQuery.replace(/^@/, '').length < 3 || !/[\p{L}\p{N}]{3}/u.test(trimmedQuery));
  const settled = trimmedQuery === debounced;
  const searchEnabled = !!data.data && (!topicId || !!topic) && !showHome && !short && settled;
  const title = topicId ? topic?.shortLabel ?? 'Assunto' : 'Explorar';
  const searchLabel = topicId ? `Buscar em ${title}` : 'Buscar na Popularia';
  const result = useInfiniteQuery({
    queryKey: queryKeys.discovery.search(me.id, debounced, filter, topicId),
    queryFn: ({ pageParam, signal }) => searchDiscovery(me.id, debounced, filter, topicId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: searchEnabled,
    retry: false,
    ...contentPolicy.search,
    placeholderData: keepPreviousData,
  }, queryClient);
  const refreshSearch = result.refetch;
  const focusedOnce = useRef(false);
  const revalidateRef = useRef(() => {});
  useEffect(() => {
    revalidateRef.current = () => {
      // Descoberta só busca de novo fora da janela de frescor; uma busca ativa
      // é revalidada ao retornar para refletir novos resultados.
      revalidateIfStale(discovery.queryKey, contentPolicy.discovery.staleTime);
      if (topicId && topic) revalidateIfStale(queryKeys.discovery.topicDocuments(me.id, topicId), contentPolicy.topic.staleTime);
      if (searchEnabled) void refreshSearch();
    };
  }, [discovery.queryKey, refreshSearch, searchEnabled, topicId, topic, me.id]);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) revalidateRef.current();
    focusedOnce.current = true;
  }, []));
  const refresh = useCallback(() => {
    if (showHome || !data.data) {
      reload();
      if (topicId && topic) void refetchTopicDocuments();
    } else if (searchEnabled) void refreshSearch();
  }, [showHome, data.data, reload, searchEnabled, refreshSearch, topicId, topic, refetchTopicDocuments]);
  const pullRefresh = useManualRefresh(showHome || !data.data ? data.status === 'loading' : result.isRefetching, refresh);
  const items = useMemo(
    () => dedupe(result.data?.pages.flatMap((page) => page.items) ?? []),
    [result.data],
  );
  const filterOptions = useMemo(
    () => FILTERS.filter((option) => option.key === 'all' || !topicId || option.key !== 'people'),
    [topicId],
  );
  const topics = data.data?.topics ?? EMPTY_TOPICS;
  const previewTopics = useMemo(() => topics.slice(0, TOPIC_PREVIEW_LIMIT), [topics]);
  const loadMore = () => {
    if (searchEnabled && result.hasNextPage && !result.isFetching) void result.fetchNextPage();
  };
  const changeFilter = (next: DiscoveryFilter) => {
    setFilter(next);
    stickyControls.scrollToControls(next === 'all' && !trimmedQuery);
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    stickyControls.scrollToControls(!next.trim() && filter === 'all');
  };
  const openTopic = (selected: Topic) => {
    setTopicsOpen(false);
    router.push({ pathname: '/explorar/assunto/[id]', params: { id: selected.id } });
  };

  // `query` não entra nas dependências: enquanto o termo ainda aguarda o
  // debounce, as linhas continuam as mesmas e a lista não recria as células.
  const rows = useMemo(() => {
    const next: DiscoveryRow[] = [{ key: 'controls', kind: 'controls' }];
    const addState = (key: string, content: ReactNode) => next.push({ key, kind: 'state', content });
    if (data.status === 'error') addState('discovery-error', <StateView kind="error" message="Não conseguimos atualizar a descoberta." onRetry={reload} />);
    if (!data.data) {
      if (data.status === 'loading') {
        if (showHome) next.push({ key: 'trending-loading', kind: 'trending-skeleton' });
        else addState('discovery-loading', <StateView kind="loading" message="Carregando descoberta" />);
      }
    } else if (topicId && !topic) {
      addState('unknown-topic', <StateView kind="empty" title="Assunto não encontrado" />);
    } else if (showHome) {
      next.push(...discoveryRows(data.data, topic, topicDocumentItems, trending, suggestions));
    } else if (short) {
      addState('short-query', <StateView kind="empty" title="Continue escrevendo" message="Use pelo menos três letras ou números seguidos para buscar." />);
    } else if (!settled || result.isPending || result.isPlaceholderData) {
      addState('search-loading', <PopulariaListSkeleton rows={4} variant="row" />);
    } else {
      if (result.isError && !result.isFetchNextPageError) addState('search-error', <StateView kind="error" message={items.length ? 'Não conseguimos atualizar a busca.' : 'Não conseguimos buscar agora.'} onRetry={() => { void refreshSearch(); }} />);
      if (!result.isError && !items.length) addState('search-empty', <StateView kind="empty" title={debounced ? 'Nada por aqui ainda.' : 'Nada nesta categoria por enquanto.'} message={debounced ? 'Tente outro termo ou explore as comunas.' : undefined} />);
      if (filter === 'all') {
        for (const section of SEARCH_SECTIONS) {
          const group = items.filter((entry) => entry.kind === section.key);
          if (!group.length) continue;
          next.push({ key: `section-${section.key}`, kind: 'section', label: section.label, filter: section.key, action: section.action });
          next.push(...hitRows(group));
        }
      } else {
        next.push(...hitRows(items));
      }
    }
    return next;
  }, [
    data.data, data.status, debounced, filter, items, reload, refreshSearch,
    result.isError, result.isFetchNextPageError, result.isPending, result.isPlaceholderData,
    settled, short, showHome, suggestions, topic, topicDocumentItems, topicId, trending,
  ]);

  return <Screen>
    <KeyboardView style={styles.flex}>
      <FlatList
        ref={list}
        data={rows}
        testID="explore-list"
        keyExtractor={(item) => item.key}
        style={styles.flex}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        // O título rola; a primeira célula (busca/filtros) permanece acessível e montada.
        stickyHeaderIndices={STICKY_HEADER_INDICES}
        onLayout={stickyControls.onListLayout}
        onContentSizeChange={stickyControls.onContentSizeChange}
        onScrollBeginDrag={stickyControls.onScrollBeginDrag}
        removeClippedSubviews={false}
        initialNumToRender={12}
        refreshControl={<RefreshControl refreshing={pullRefresh.refreshing} onRefresh={pullRefresh.onRefresh} tintColor={Colors.red} />}
        ListHeaderComponent={<View onLayout={stickyControls.onHeaderLayout} style={styles.titleWrap}>
          {topicId ? <EditorialBar
            onBack={goBack}
            title={<AppText variant="label">Assuntos da Popularia</AppText>}
            divider
            minHeight={58}
            inset={0}
          /> : null}
          <AppText variant="display" accessibilityRole="header" style={[styles.title, topicId ? styles.topicTitle : null]}>{title}</AppText>
        </View>}
        renderItem={({ item }) => {
          if (item.kind === 'controls') return <View style={styles.controls}>
            <View style={styles.searchGroup}>
              <AppText variant="label" style={styles.searchLabel}>{searchLabel}</AppText>
              <View style={styles.search}>
                <Icon name="search" size={20} />
                <TextInput value={query} onChangeText={changeQuery} placeholder="Ex.: moradia ou @nome" accessibilityLabel={searchLabel}
                  accessibilityHint="Busca pessoas, comunas, publicações, eventos e documentos."
                  placeholderTextColor={Colors.muted} returnKeyType="search" autoCorrect={false} autoCapitalize="none" maxLength={100} style={styles.input} />
                {query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => changeQuery('')} /> : null}
              </View>
            </View>
            <ExploreFilters options={filterOptions} value={filter} onChange={changeFilter} />
          </View>;
          if (item.kind === 'section') return <View style={styles.section}>
            <SectionHeading appearance="editorial" label={item.label} actionLabel={item.filter ? item.action ?? 'Ver todas' : undefined} onAction={item.filter ? () => changeFilter(item.filter!) : undefined} />
          </View>;
          if (item.kind === 'hit') return <View style={styles.hit}><DiscoveryHit entry={item.entry} topics={topics} nav={nav} /></View>;
          if (item.kind === 'trending') return <TrendingNowSection posts={trending} onOpenPost={(post) => nav.openPost(post.id)} onSeeAll={() => changeFilter('posts')} />;
          if (item.kind === 'trending-skeleton') return <TrendingNowSkeleton />;
          if (item.kind === 'comuna-carousel') return <ComunasToKnowSection
            comunas={data.data?.comunas ?? []}
            interests={interests ?? []}
            city={profile.city}
            onOpenComuna={(comuna) => nav.openComuna(comuna.id)}
            onSeeAll={() => changeFilter('comunas')} />;
          if (item.kind === 'topics') return <View style={styles.topicsSection}>
            <SectionHeading appearance="editorial" label="Assuntos" actionLabel={topics.length > TOPIC_PREVIEW_LIMIT ? 'Ver todos' : undefined} onAction={() => setTopicsOpen(true)} />
            <TopicLinks topics={previewTopics} onSelect={openTopic} />
          </View>;
          if (item.kind === 'library') return <View style={styles.libraryWrap}><LibraryLink /></View>;
          if (item.kind === 'state') return <View style={styles.state}>{item.content}</View>;
          return null;
        }}
        ListFooterComponent={!showHome && searchEnabled && filter !== 'all' && !result.isPlaceholderData ? <View style={styles.footer}>
          {result.isFetchingNextPage ? <StateView kind="loading" message="Carregando mais resultados" /> : result.isFetchNextPageError ? <StateView kind="error" message="Não conseguimos carregar mais resultados." onRetry={loadMore} /> : result.hasNextPage ? <PillButton label="Carregar mais" variant="outline" onPress={loadMore} /> : null}
        </View> : undefined}
      />
    </KeyboardView>
    <BottomSheet visible={topicsOpen} onClose={() => setTopicsOpen(false)} title="Todos os assuntos">
      <TopicLinks topics={topics} onSelect={openTopic} />
    </BottomSheet>
  </Screen>;
}

function hitRows(entries: DiscoveryEntry[]): DiscoveryRow[] {
  return entries.map((entry) => ({ key: `${entry.kind}:${entry.id}`, kind: 'hit', entry }));
}

/** A entrada apresenta amostras; as categorias continuam dando acesso aos resultados completos. */
function discoveryRows(data: DiscoveryData, topic: Topic | undefined, topicDocuments: DiscoveryEntry[], trending: FeedItem[], suggestions: Comuna[]): DiscoveryRow[] {
  const rows: DiscoveryRow[] = [];
  const add = (label: string, filter: DiscoveryFilter, entries: DiscoveryEntry[], action?: string) => {
    if (!entries.length) return;
    rows.push({ key: `section-${label}`, kind: 'section', label, filter, ...(action ? { action } : {}) });
    rows.push(...hitRows(entries.slice(0, PREVIEW_LIMIT)));
  };
  const recent = data.recentPosts.filter((post) => !data.posts.some((featured) => featured.id === post.id));
  if (topic) {
    add('Em destaque', 'posts', data.posts.map((value) => ({ id: value.id, kind: 'posts', value })));
    add('Comunas', 'comunas', data.comunas.map((value) => ({ id: value.id, kind: 'comunas', value })));
    add('Documentos', 'documents', topicDocuments, 'Ver todos');
    add('Publicações recentes', 'posts', recent.map((value) => ({ id: value.id, kind: 'posts', value })));
  } else {
    if (trending.length) rows.push({ key: 'trending', kind: 'trending' });
    if (data.topics.length) rows.push({ key: 'topics', kind: 'topics' });
    if (suggestions.length) rows.push({ key: 'comuna-carousel', kind: 'comuna-carousel' });
    add('Pessoas para acompanhar', 'people', data.people.map((value) => ({ id: value.id, kind: 'people', value })));
    rows.push({ key: 'library', kind: 'library' });
  }
  if (!data.posts.length && !data.people.length && !data.comunas.length && !recent.length && !topicDocuments.length) rows.push({ key: 'discovery-empty', kind: 'state', content: <>
    <StateView kind="empty" title="Ainda não há muita coisa por aqui." message="Outros assuntos e comunas estão à sua espera." />
    {topic ? <PillButton label="Descobrir outros assuntos" variant="outline" onPress={() => router.navigate('/explorar')} /> : null}
  </> });
  return rows;
}

function ExploreFilters({ options, value, onChange }: {
  options: { key: DiscoveryFilter; label: string }[]; value: DiscoveryFilter; onChange: (filter: DiscoveryFilter) => void;
}) {
  return <FilterChipRow
    options={options}
    value={value}
    onChange={onChange}
    accessibilityLabel="Filtrar resultados"
    appearance="soft"
    gap={Spacing.one}
    inset={Spacing.five}
    labelVariant="button"
  />;
}

function TopicLinks({ topics, onSelect }: { topics: Topic[]; onSelect: (topic: Topic) => void }) {
  return <View style={styles.topics}>{topics.map((topic) => <Pressable key={topic.id} accessibilityRole="link" accessibilityLabel={`Explorar ${topic.shortLabel}`} onPress={() => onSelect(topic)} style={({ pressed }) => [styles.topic, pressed && styles.pressed]}>
    <AppText style={styles.topicLabel}>{topic.shortLabel}</AppText>
  </Pressable>)}</View>;
}

function LibraryLink() {
  return <Pressable accessibilityRole="link" accessibilityLabel="Abrir Biblioteca Pública" accessibilityHint="Vai para a Biblioteca Pública" onPress={() => router.push('/biblioteca')} style={({ pressed }) => [styles.libraryCard, pressed && styles.pressed]}>
    <Image fadeDuration={0} source={require('@/assets/library/library-explore-banner.png')} resizeMode="cover" style={styles.libraryArt} accessible={false} />
    <View style={styles.libraryContent}>
      <AppText variant="label" color={Colors.onInkSoft}>Acervo da comunidade</AppText>
      <AppText style={styles.libraryHeading} color={Colors.paper}>Biblioteca Pública</AppText>
      <AppText style={styles.libraryDescription} color={Colors.onInkSoft}>Cartilhas, atas e estudos.</AppText>
    </View>
    <View style={styles.libraryArrow}><Icon name="chevronRight" size={24} color={Colors.paper} /></View>
  </Pressable>;
}

function dedupe(items: DiscoveryEntry[]): DiscoveryEntry[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Páginas já carregadas de uma busca, no formato que o preview espera. */
function cachedSearchPage(key: QueryKey): Page<DiscoveryEntry> | undefined {
  const cached = queryClient.getQueryData<InfiniteData<Page<DiscoveryEntry>>>(key);
  if (!cached) return undefined;
  return {
    items: dedupe(cached.pages.flatMap((page) => page.items)),
    nextCursor: cached.pages[cached.pages.length - 1]?.nextCursor ?? null,
  };
}

function DiscoveryHit({ entry, topics, nav }: { entry: DiscoveryEntry; topics: Topic[]; nav: ReturnType<typeof useNav> }) {
  if (entry.kind === 'comunas') return <DiscoveryComuna comuna={entry.value} topics={topics} />;
  if (entry.kind === 'people') return <PersonRow user={entry.value} subtitle={`@${entry.value.handle}`} onOpen={() => nav.openProfile(entry.id)} />;
  if (entry.kind === 'posts') return <DiscoveryPostRow post={entry.value} />;
  if (entry.kind === 'events') return <DiscoveryEventRow event={entry.value} />;
  return <View style={styles.document}><DocumentCard document={entry.value} appearance={entry.value.isPublic ? 'public' : 'editorial'} /></View>;
}

function DiscoveryComuna({ comuna, topics }: { comuna: Comuna; topics: Topic[] }) {
  const nav = useNav();
  const topic = topics.find((t) => t.id === comuna.topics[0]);
  const privateComuna = comuna.visibility === 'private';
  const subtitle = [privateComuna ? 'Privada' : 'Pública', topic?.shortLabel, `${formatPeople(comuna.memberCount)} membros`].filter(Boolean).join(' · ');
  return <ComunaRow comuna={comuna} subtitle={subtitle} description={comuna.description} onOpen={() => nav.openComuna(comuna.id)}
    trailing={privateComuna ? <PillButton label={comuna.viewerIsMember ? 'Abrir' : 'Solicitar'} size="sm" variant="outline" onPress={() => nav.openComuna(comuna.id)} /> : <JoinButton comuna={comuna} short />} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: Spacing.seven },
  titleWrap: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  title: { fontFamily: Fonts.anton, fontSize: 54, lineHeight: 68, letterSpacing: -0.8 },
  topicTitle: { lineHeight: 80 },
  controls: { backgroundColor: Colors.cream, paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.two },
  searchGroup: { marginHorizontal: Spacing.five, gap: Spacing.two },
  searchLabel: { lineHeight: 16 },
  search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontFamily: Fonts.regular, fontSize: 18, lineHeight: 24, color: Colors.ink, paddingVertical: Spacing.two, outlineWidth: 0 },
  section: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  hit: { paddingHorizontal: Spacing.five },
  state: { paddingHorizontal: Spacing.five },
  footer: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two },
  document: { marginVertical: Spacing.one },
  topicsSection: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.one, gap: Spacing.one },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  topic: { minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderWidth: 1.5, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, justifyContent: 'center', alignItems: 'center', flexGrow: 1, maxWidth: '100%' },
  topicLabel: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 23, textAlign: 'center', flexShrink: 1 },
  libraryWrap: { paddingHorizontal: Spacing.five, paddingTop: Spacing.six },
  libraryCard: { minHeight: 144, overflow: 'hidden', position: 'relative', backgroundColor: Colors.ink },
  libraryArt: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  libraryContent: { width: '74%', padding: Spacing.four, gap: Spacing.one },
  libraryHeading: { fontFamily: Fonts.condensed, fontSize: 30, lineHeight: 38, textTransform: 'uppercase' },
  libraryDescription: { fontSize: 15.5, lineHeight: 22 },
  libraryArrow: { position: 'absolute', right: Spacing.four, bottom: Spacing.four },
  pressed: { opacity: 0.75 },
});
