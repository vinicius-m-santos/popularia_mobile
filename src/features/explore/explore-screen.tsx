import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
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
import { useAsyncData } from '@/hooks/use-async-data';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { formatPeople } from '@/lib/format';
import { queryClient } from '@/lib/query/client';
import { goBack, useNav } from '@/lib/routes';
import type { Comuna, Topic } from '@/types/models';

import { getDiscoveryData, searchDiscovery, type DiscoveryData, type DiscoveryEntry, type DiscoveryFilter } from './api';
import { DiscoveryEventRow } from './discovery-event-row';
import { DiscoveryPostRow } from './discovery-post-row';

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

type DiscoveryRow =
  | { key: string; kind: 'controls' | 'topics' | 'library' }
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
  const { interests } = useAccount();
  const interestKey = (interests ?? []).join(',');
  const load = useCallback(() => {
    // Recarrega as prioridades quando interesses mudam no perfil.
    void interestKey;
    return getDiscoveryData(me.id, topicId);
  }, [me.id, topicId, interestKey]);
  const data = useAsyncData(load);
  const { reload } = data;
  const list = useRef<FlatList<DiscoveryRow>>(null);
  const titleHeight = useRef(0);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const [topicsOpen, setTopicsOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const topic = data.data?.topics.find((t) => t.id === topicId);
  const showHome = !query.trim() && filter === 'all';
  const short = !!query.trim() && (query.trim().replace(/^@/, '').length < 3 || !/[\p{L}\p{N}]{3}/u.test(query));
  const settled = query.trim() === debounced;
  const searchEnabled = !!data.data && (!topicId || !!topic) && !showHome && !short && settled;
  const title = topicId ? topic?.shortLabel ?? 'Assunto' : 'Explorar';
  const searchLabel = topicId ? `Buscar em ${title}` : 'Buscar na Popularia';
  const result = useInfiniteQuery({
    queryKey: ['search', debounced, filter, topicId ?? null],
    queryFn: ({ pageParam, signal }) => searchDiscovery(me.id, debounced, filter, topicId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: searchEnabled,
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  }, queryClient);
  const refreshSearch = result.refetch;
  const focusedOnce = useRef(false);
  const revalidateRef = useRef(() => {});
  useEffect(() => {
    revalidateRef.current = () => {
      reload();
      if (searchEnabled) void refreshSearch();
    };
  }, [reload, refreshSearch, searchEnabled]);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) revalidateRef.current();
    focusedOnce.current = true;
  }, []));
  const refresh = useCallback(() => {
    if (showHome || !data.data) reload();
    else if (searchEnabled) void refreshSearch();
  }, [showHome, data.data, reload, searchEnabled, refreshSearch]);
  const pullRefresh = useManualRefresh(showHome || !data.data ? data.status === 'loading' : result.isRefetching, refresh);
  const items = dedupe(result.data?.pages.flatMap((page) => page.items) ?? []);
  const loadMore = () => {
    if (searchEnabled && result.hasNextPage && !result.isFetching) void result.fetchNextPage();
  };
  const changeFilter = (next: DiscoveryFilter) => {
    setFilter(next);
    list.current?.scrollToOffset({ offset: next === 'all' && !query.trim() ? 0 : titleHeight.current, animated: false });
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    list.current?.scrollToOffset({ offset: !next.trim() && filter === 'all' ? 0 : titleHeight.current, animated: false });
  };
  const openTopic = (selected: Topic) => {
    setTopicsOpen(false);
    router.push({ pathname: '/explorar/assunto/[id]', params: { id: selected.id } });
  };

  const rows: DiscoveryRow[] = [{ key: 'controls', kind: 'controls' }];
  const addState = (key: string, content: ReactNode) => rows.push({ key, kind: 'state', content });
  if (data.status === 'error') addState('discovery-error', <StateView kind="error" message="Não conseguimos atualizar a descoberta." onRetry={reload} />);
  if (!data.data) {
    if (data.status === 'loading') addState('discovery-loading', <StateView kind="loading" message="Carregando descoberta" />);
  } else if (topicId && !topic) {
    addState('unknown-topic', <StateView kind="empty" title="Assunto não encontrado" />);
  } else if (showHome) {
    rows.push(...discoveryRows(data.data, topic));
  } else if (short) {
    addState('short-query', <StateView kind="empty" title="Continue escrevendo" message="Use pelo menos três letras ou números seguidos para buscar." />);
  } else if (!settled || result.isPending || result.isPlaceholderData) {
    addState('search-loading', <PopulariaListSkeleton rows={4} variant="row" />);
  } else {
    if (result.isError && !result.isFetchNextPageError) addState('search-error', <StateView kind="error" message={items.length ? 'Não conseguimos atualizar a busca.' : 'Não conseguimos buscar agora.'} onRetry={() => { void refreshSearch(); }} />);
    if (!result.isError && !items.length) addState('search-empty', <StateView kind="empty" title={debounced ? 'Nada por aqui ainda.' : 'Nada nesta categoria por enquanto.'} message={debounced ? 'Tente outro termo ou explore as comunas.' : undefined} />);
    if (filter === 'all') {
      for (const section of FILTERS.filter((option) => option.key !== 'all')) {
        const group = items.filter((entry) => entry.kind === section.key);
        if (!group.length) continue;
        rows.push({ key: `section-${section.key}`, kind: 'section', label: section.label, filter: section.key, action: section.action });
        rows.push(...hitRows(group));
      }
    } else {
      rows.push(...hitRows(items));
    }
  }

  return <Screen>
    <KeyboardView style={styles.flex}>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(item) => item.key}
        style={styles.flex}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        // O título rola; a primeira célula (busca/filtros) permanece acessível e montada.
        stickyHeaderIndices={[1]}
        removeClippedSubviews={false}
        initialNumToRender={12}
        refreshControl={<RefreshControl refreshing={pullRefresh.refreshing} onRefresh={pullRefresh.onRefresh} tintColor={Colors.red} />}
        ListHeaderComponent={<View onLayout={(event) => { titleHeight.current = event.nativeEvent.layout.height; }} style={styles.titleWrap}>
          {topicId ? <View style={styles.topicChrome}><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><View style={styles.barDivider} /><AppText variant="label">Assuntos da Popularia</AppText></View> : null}
          <AppText variant="display" accessibilityRole="header" style={styles.title}>{title}</AppText>
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
            <ExploreFilters options={FILTERS.filter((f) => f.key === 'all' || !topicId || f.key !== 'people')} value={filter} onChange={changeFilter} />
          </View>;
          if (item.kind === 'section') return <View style={styles.section}>
            <SectionHeading appearance="editorial" label={item.label} actionLabel={item.filter ? item.action ?? 'Ver todas' : undefined} onAction={item.filter ? () => changeFilter(item.filter!) : undefined} />
          </View>;
          if (item.kind === 'hit') return <View style={styles.hit}><DiscoveryHit entry={item.entry} topics={data.data?.topics ?? []} nav={nav} /></View>;
          if (item.kind === 'topics') return <View style={styles.topicsSection}>
            <SectionHeading appearance="editorial" label="Assuntos" actionLabel={(data.data?.topics.length ?? 0) > TOPIC_PREVIEW_LIMIT ? 'Ver todos' : undefined} onAction={() => setTopicsOpen(true)} />
            <TopicLinks topics={(data.data?.topics ?? []).slice(0, TOPIC_PREVIEW_LIMIT)} onSelect={openTopic} />
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
      <TopicLinks topics={data.data?.topics ?? []} onSelect={openTopic} />
    </BottomSheet>
  </Screen>;
}

function hitRows(entries: DiscoveryEntry[]): DiscoveryRow[] {
  return entries.map((entry) => ({ key: `${entry.kind}:${entry.id}`, kind: 'hit', entry }));
}

/** A entrada apresenta amostras; as categorias continuam dando acesso aos resultados completos. */
function discoveryRows(data: DiscoveryData, topic?: Topic): DiscoveryRow[] {
  const rows: DiscoveryRow[] = [];
  const add = (label: string, filter: DiscoveryFilter, entries: DiscoveryEntry[]) => {
    if (!entries.length) return;
    rows.push({ key: `section-${label}`, kind: 'section', label, filter });
    rows.push(...hitRows(entries.slice(0, PREVIEW_LIMIT)));
  };
  add(topic ? 'Em destaque' : 'Discussões em destaque', 'posts', data.posts.map((value) => ({ id: value.id, kind: 'posts', value })));
  if (!topic && data.topics.length) rows.push({ key: 'topics', kind: 'topics' });
  add('Pessoas para acompanhar', 'people', data.people.map((value) => ({ id: value.id, kind: 'people', value })));
  add(topic ? 'Comunas' : 'Comunas para conhecer', 'comunas', data.comunas.map((value) => ({ id: value.id, kind: 'comunas', value })));
  const recent = data.recentPosts.filter((post) => !data.posts.some((featured) => featured.id === post.id));
  add('Publicações recentes', 'posts', recent.map((value) => ({ id: value.id, kind: 'posts', value })));
  if (!topic) rows.push({ key: 'library', kind: 'library' });
  if (!data.posts.length && !data.people.length && !data.comunas.length && !recent.length) rows.push({ key: 'discovery-empty', kind: 'state', content: <>
    <StateView kind="empty" title="Ainda não há muita coisa por aqui." message="Outros assuntos e comunas estão à sua espera." />
    {topic ? <PillButton label="Descobrir outros assuntos" variant="outline" onPress={() => router.navigate('/explorar')} /> : null}
  </> });
  return rows;
}

function ExploreFilters({ options, value, onChange }: {
  options: { key: DiscoveryFilter; label: string }[]; value: DiscoveryFilter; onChange: (filter: DiscoveryFilter) => void;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<string, number>>({});
  useEffect(() => { scroll.current?.scrollTo({ x: Math.max(0, (positions.current[value] ?? 0) - Spacing.five), animated: true }); }, [value]);
  return <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filtrar resultados">
    {options.map((option) => <Pressable key={option.key} accessibilityRole="radio" accessibilityLabel={option.label}
      accessibilityState={{ checked: value === option.key }} onPress={() => onChange(option.key)}
      onLayout={(event) => { positions.current[option.key] = event.nativeEvent.layout.x; }}
      style={({ pressed }) => [styles.filter, value === option.key && styles.filterActive, pressed && styles.pressed]}>
      <AppText variant="button" color={value === option.key ? Colors.paper : Colors.ink}>{option.label}</AppText>
    </Pressable>)}
  </ScrollView>;
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
  topicChrome: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 58 },
  barDivider: { width: 1.5, height: 28, backgroundColor: Colors.ink },
  controls: { backgroundColor: Colors.cream, paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.two },
  searchGroup: { marginHorizontal: Spacing.five, gap: Spacing.two },
  searchLabel: { lineHeight: 16 },
  search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontFamily: Fonts.regular, fontSize: 18, lineHeight: 24, color: Colors.ink, paddingVertical: Spacing.two, outlineWidth: 0 },
  filters: { flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Spacing.five },
  filter: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.strawLight, borderRadius: Radius.sm, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  filterActive: { backgroundColor: Colors.ink },
  section: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  hit: { paddingHorizontal: Spacing.five },
  state: { paddingHorizontal: Spacing.five },
  footer: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two },
  document: { marginVertical: Spacing.one },
  topicsSection: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.one, gap: Spacing.one },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  topic: { minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderWidth: 1, borderColor: Colors.inkSoft, borderRadius: Radius.sm, backgroundColor: Colors.paper, justifyContent: 'center', alignItems: 'center', flexGrow: 1, maxWidth: '100%' },
  topicLabel: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20, textAlign: 'center', flexShrink: 1 },
  libraryWrap: { paddingHorizontal: Spacing.five, paddingTop: Spacing.six },
  libraryCard: { minHeight: 144, overflow: 'hidden', position: 'relative', backgroundColor: Colors.ink },
  libraryArt: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  libraryContent: { width: '74%', padding: Spacing.four, gap: Spacing.one },
  libraryHeading: { fontFamily: Fonts.condensed, fontSize: 30, lineHeight: 35, textTransform: 'uppercase' },
  libraryDescription: { fontSize: 15.5, lineHeight: 22 },
  libraryArrow: { position: 'absolute', right: Spacing.four, bottom: Spacing.four },
  pressed: { opacity: 0.75 },
});
