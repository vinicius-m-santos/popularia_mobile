import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PopulariaList } from '@/components/list/popularia-list';
import { PopulariaListSkeleton } from '@/components/list/popularia-list-skeleton';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, Spacing } from '@/constants/theme';
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

export default function ExploreScreen() {
  return <DiscoveryScreen />;
}

export function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DiscoveryScreen key={id} topicId={id} />;
}

/** Mesma linguagem e componentes para descoberta global e universo de um assunto. */
function DiscoveryScreen({ topicId }: { topicId?: string }) {
  const me = useMe();
  const { interests } = useAccount();
  const interestKey = (interests ?? []).join(',');
  const load = useCallback(() => {
    // Recarrega as prioridades quando interesses mudam no perfil.
    void interestKey;
    return getDiscoveryData(me.id, topicId);
  }, [me.id, topicId, interestKey]);
  const data = useAsyncData(load);
  const { reload } = data;
  const focusedOnce = useRef(false);
  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; }, [reload]);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) reloadRef.current();
    focusedOnce.current = true;
  }, []));
  const pullRefresh = useManualRefresh(data.status === 'loading', reload);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const topic = data.data?.topics.find((t) => t.id === topicId);
  const showHome = !query.trim() && filter === 'all';
  const short = !!query.trim() && (query.trim().replace(/^@/, '').length < 3 || !/[\p{L}\p{N}]{3}/u.test(query));
  const settled = query.trim() === debounced;
  const debouncedReady = debounced.replace(/^@/, '').length >= 3 && /[\p{L}\p{N}]{3}/u.test(debounced);
  const title = topicId ? topic?.shortLabel ?? 'Assunto' : 'Explorar';
  const placeholder = topicId ? `Buscar em ${title}` : 'Buscar na Popularia';

  return (
    <Screen>
      <KeyboardView style={styles.flex}>
        <View style={[styles.header, topicId && styles.topicHeader]}>
          {topicId ? <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /> : null}
          <View style={styles.titleWrap}>
            {topicId ? <AppText variant="label" color={Colors.red}>Assuntos da Popularia</AppText> : null}
            <AppText variant="display" accessibilityRole="header" style={styles.title}>{title}</AppText>
          </View>
          <View style={styles.search}>
            <Icon name="search" size={20} />
            <TextInput value={query} onChangeText={setQuery} placeholder={placeholder} accessibilityLabel={placeholder}
              accessibilityHint="Busca pessoas, comunas, publicações, eventos e documentos."
              placeholderTextColor={Colors.placeholder} returnKeyType="search" autoCorrect={false} autoCapitalize="none" maxLength={100} style={styles.input} />
            {query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => setQuery('')} /> : null}
          </View>
          <ExploreFilters options={FILTERS.filter((f) => f.key === 'all' || !topicId || f.key !== 'people')} value={filter} onChange={setFilter} />
        </View>
        {data.status === 'error' ? <StateView kind="error" message="Não conseguimos atualizar a descoberta." onRetry={reload} /> : null}
        {!data.data ? (data.status === 'loading' ? <StateView kind="loading" message="Carregando descoberta" /> : null) :
          topicId && !topic ? <StateView kind="empty" title="Assunto não encontrado" /> :
          showHome ? <DiscoveryHome data={data.data} topic={topic} onSee={setFilter} refreshing={pullRefresh.refreshing} onRefresh={pullRefresh.onRefresh} /> :
          short ? <StateView kind="empty" title="Continue escrevendo" message="Use pelo menos três letras ou números seguidos para buscar." /> :
          !settled && !debouncedReady ? <PopulariaListSkeleton rows={4} variant="row" /> :
          <SearchResults ownUserId={me.id} query={debounced} filter={filter} topicId={topicId} topics={data.data.topics} onSee={setFilter} />}
      </KeyboardView>
    </Screen>
  );
}

function ExploreFilters({ options, value, onChange }: {
  options: { key: DiscoveryFilter; label: string }[]; value: DiscoveryFilter; onChange: (filter: DiscoveryFilter) => void;
}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filtrar resultados">
    {options.map((option) => {
      const active = option.key === value;
      return <Pressable
        key={option.key}
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
        onPress={() => onChange(option.key)}
        style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.pressed]}>
        <AppText style={styles.filterLabel} color={active ? Colors.paper : Colors.ink}>{option.label}</AppText>
      </Pressable>;
    })}
  </ScrollView>;
}

function DiscoveryHome({ data, topic, onSee, refreshing, onRefresh }: {
  data: DiscoveryData; topic?: Topic; onSee: (filter: DiscoveryFilter) => void; refreshing: boolean; onRefresh: () => void;
}) {
  const nav = useNav();
  const recent = data.recentPosts.filter((p) => !data.posts.some((featured) => featured.id === p.id));
  const empty = !data.comunas.length && !data.posts.length && !data.people.length && !recent.length;
  return (
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.red} />}>
      {!topic ? <Pressable accessibilityRole="link" accessibilityLabel="Abrir Biblioteca Pública" accessibilityHint="Vai para a Biblioteca Pública" onPress={() => router.push('/biblioteca')} style={({ pressed }) => [styles.libraryCard, pressed && styles.libraryCardPressed]}>
        <Image fadeDuration={0} source={require('@/assets/library/library-explore-banner.png')} resizeMode="cover" style={styles.libraryArt} accessible={false} />
        <View style={styles.libraryContent}>
          <View style={styles.libraryCardHead}>
            <View style={styles.libraryTitle}>
              <AppText variant="label" color={Colors.red}>Acervo público</AppText>
              <AppText style={styles.libraryHeading} color={Colors.paper}>Biblioteca Pública</AppText>
            </View>
          </View>
          <AppText style={styles.libraryDescription} color={Colors.onInkSoft}>Cartilhas, atas e estudos compartilhados pela comunidade.</AppText>
          <View style={styles.libraryArrow}><Icon name="chevronRight" size={30} color={Colors.paper} /></View>
        </View>
      </Pressable> : null}
      {!topic ? (
        <View style={styles.section}>
          <SectionHeading label="Assuntos" />
          <View style={styles.topics}>
            {data.topics.map((t) => <Pressable key={t.id} accessibilityRole="link" accessibilityLabel={`Explorar ${t.shortLabel}`}
              onPress={() => router.push({ pathname: '/explorar/assunto/[id]', params: { id: t.id } })} style={({ pressed }) => [styles.topic, pressed && styles.pressed]}>
              <AppText style={styles.topicLabel}>{t.shortLabel}</AppText>
            </Pressable>)}
          </View>
        </View>
      ) : null}
      {topic && data.posts.length ? <View style={styles.section}>
        <SectionHeading label="Em destaque" />
        {data.posts.map((p, i) => <DiscoveryPostRow key={p.id} post={p} rank={i + 1} />)}
      </View> : null}
      {data.comunas.length ? <View style={styles.section}>
        <SectionHeading label={topic ? 'Comunas' : 'Comunas para conhecer'} actionLabel="Ver todas" onAction={() => onSee('comunas')} />
        {data.comunas.map((c) => <DiscoveryComuna key={c.id} comuna={c} topics={data.topics} />)}
      </View> : null}
      {!topic && data.posts.length ? <View style={styles.section}>
        <SectionHeading label="Discussões em destaque" actionLabel="Ver todas" onAction={() => onSee('posts')} />
        {data.posts.map((p, i) => <DiscoveryPostRow key={p.id} post={p} rank={i + 1} />)}
      </View> : null}
      {data.people.length ? <View style={styles.section}>
        <SectionHeading label="Pessoas para acompanhar" actionLabel="Ver todas" onAction={() => onSee('people')} />
        {data.people.map((u) => <PersonRow key={u.id} user={u} subtitle={`@${u.handle}`} onOpen={() => nav.openProfile(u.id)} />)}
      </View> : null}
      {recent.length ? <View style={styles.section}>
        <SectionHeading label="Publicações recentes" actionLabel="Ver todas" onAction={() => onSee('posts')} />
        {recent.map((p) => <DiscoveryPostRow key={p.id} post={p} />)}
      </View> : null}
      {empty ? <View>
        <StateView kind="empty" title="Ainda não há muita coisa por aqui." message="Outros assuntos e comunas estão à sua espera." />
        {topic ? <PillButton label="Descobrir outros assuntos" variant="outline" onPress={() => router.navigate('/explorar')} /> : null}
      </View> : null}
    </ScrollView>
  );
}

function SearchResults({ ownUserId, query, filter, topicId, topics, onSee }: {
  ownUserId: string; query: string; filter: DiscoveryFilter; topicId?: string; topics: Topic[]; onSee: (filter: DiscoveryFilter) => void;
}) {
  const nav = useNav();
  const result = useInfiniteQuery({
    queryKey: ['search', query, filter, topicId ?? null],
    queryFn: ({ pageParam, signal }) => searchDiscovery(ownUserId, query, filter, topicId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  }, queryClient);
  const refresh = useCallback(() => { void result.refetch(); }, [result]);
  const loadMore = useCallback(() => { if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage(); }, [result]);
  const focusedOnce = useRef(false);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) refreshRef.current();
    focusedOnce.current = true;
  }, []));
  const items = dedupe(result.data?.pages.flatMap((page) => page.items) ?? []);
  const failed = result.isError;
  const loading = result.isPending && !result.data;
  const emptyTitle = query ? 'Nada por aqui ainda.' : 'Nada nesta categoria por enquanto.';
  const emptyMessage = query ? 'Tente outro termo ou explore as comunas.' : undefined;
  const footer = result.isFetchingNextPage ? null : result.hasNextPage
    ? <PillButton label="Carregar mais" variant="outline" onPress={loadMore} />
    : result.isFetchNextPageError ? <StateView kind="error" message="Não conseguimos carregar mais resultados." onRetry={loadMore} /> : null;

  if (filter !== 'all') {
    return <View style={styles.flex}>
      <PopulariaList<DiscoveryEntry>
        data={loading || (failed && !items.length) ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DiscoveryHit entry={item} topics={topics} nav={nav} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        onEndReached={undefined}
        state={{
          status: loading ? 'loading' : failed && !items.length ? 'error' : 'success',
          hasMore: false,
          loadingMore: result.isFetchingNextPage,
          loadMoreError: result.isFetchNextPageError ? new Error('mais') : null,
          isRefreshing: result.isRefetching && !result.isFetchingNextPage && items.length > 0,
          refreshError: failed && items.length ? new Error('atualizar') : null,
          refresh,
          loadMore,
        }}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        loadingComponent={<PopulariaListSkeleton rows={4} variant="row" />}
      />
      {footer}
    </View>;
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={result.isRefetching && items.length > 0} onRefresh={refresh} tintColor={Colors.red} />}>
      {loading ? <PopulariaListSkeleton rows={4} variant="row" /> : null}
      {failed && !items.length ? <StateView kind="error" message="Não conseguimos buscar agora." onRetry={refresh} /> : null}
      {failed && items.length ? <StateView kind="error" message="Não conseguimos atualizar a busca." onRetry={refresh} /> : null}
      {!loading && !failed && !items.length ? <StateView kind="empty" title={emptyTitle} message={emptyMessage} /> : null}
      {FILTERS.filter((section) => section.key !== 'all').map((section) => {
        const group = items.filter((item) => item.kind === section.key);
        return group.length ? <View key={section.key} style={styles.section}>
          <SectionHeading label={section.label} actionLabel={section.action} onAction={() => onSee(section.key)} />
          {group.map((entry) => <DiscoveryHit key={entry.id} entry={entry} topics={topics} nav={nav} />)}
        </View> : null;
      })}
    </ScrollView>
  );
}

function dedupe(items: DiscoveryEntry[]): DiscoveryEntry[] {
  const seen = new Set<string>();
  return items.filter((item) => seen.has(item.id) ? false : (seen.add(item.id), true));
}

function DiscoveryHit({ entry, topics, nav }: {
  entry: DiscoveryEntry; topics: Topic[]; nav: ReturnType<typeof useNav>;
}) {
  if (entry.kind === 'comunas') return <DiscoveryComuna comuna={entry.value} topics={topics} />;
  if (entry.kind === 'people') return <PersonRow user={entry.value} subtitle={`@${entry.value.handle}`} onOpen={() => nav.openProfile(entry.id)} />;
  if (entry.kind === 'posts') return <DiscoveryPostRow post={entry.value} />;
  if (entry.kind === 'events') return <DiscoveryEventRow event={entry.value} />;
  return <DocumentCard document={entry.value} appearance="editorial" />;
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
  header: { paddingTop: Spacing.three, paddingBottom: Spacing.two, backgroundColor: Colors.cream },
  topicHeader: { paddingTop: Spacing.one },
  titleWrap: { paddingHorizontal: Spacing.five, paddingTop: Spacing.one },
  title: { fontFamily: Fonts.anton, fontSize: 54, lineHeight: 66, letterSpacing: -0.8, paddingBottom: Spacing.one },
  search: { marginTop: Spacing.two, marginHorizontal: Spacing.five, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three },
  input: { flex: 1, minWidth: 0, minHeight: 58, fontFamily: Fonts.regular, fontSize: 18, color: Colors.ink, paddingVertical: Spacing.two, outlineWidth: 0 },
  filters: { flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.one },
  filter: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three },
  filterActive: { backgroundColor: Colors.ink },
  filterLabel: { fontFamily: Fonts.bold, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  content: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.seven, gap: Spacing.four },
  libraryCard: { height: 192, overflow: 'hidden', position: 'relative', backgroundColor: Colors.ink },
  libraryCardPressed: { opacity: 0.82 },
  libraryArt: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  libraryContent: { flex: 1, padding: Spacing.four, justifyContent: 'space-between' },
  libraryCardHead: { maxWidth: '62%' },
  libraryTitle: { gap: 2 },
  libraryHeading: { fontFamily: Fonts.condensed, fontSize: 30, lineHeight: 35, textTransform: 'uppercase' },
  libraryDescription: { maxWidth: '61%', fontSize: 15.5, lineHeight: 22 },
  libraryArrow: { position: 'absolute', right: Spacing.four, bottom: Spacing.four },
  section: { gap: Spacing.one, borderTopWidth: 1.5, borderTopColor: Colors.ink, paddingTop: Spacing.two },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.two },
  topic: { minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, justifyContent: 'center', alignItems: 'center', flexGrow: 1, maxWidth: '100%' },
  topicLabel: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
