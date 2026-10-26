import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ChipRow } from '@/components/chip';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { ComunaRow } from '@/features/comunas/components/comuna-row';
import { JoinButton } from '@/features/comunas/components/join-button';
import { PersonRow } from '@/features/profiles/components/person-row';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { formatPeople } from '@/lib/format';
import { goBack, useNav } from '@/lib/routes';
import type { Comuna, Topic } from '@/types/models';

import { getDiscoveryData, searchDiscovery, type DiscoveryData, type DiscoveryFilter } from './api';
import { DiscoveryPostRow } from './discovery-post-row';

const FILTERS: { key: DiscoveryFilter; label: string }[] = [
  { key: 'all', label: 'Tudo' }, { key: 'comunas', label: 'Comunas' },
  { key: 'people', label: 'Pessoas' }, { key: 'posts', label: 'Publicações' },
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
  const title = topicId ? topic?.shortLabel ?? 'Assunto' : 'Explorar';
  const placeholder = topicId ? `Buscar em ${title}` : 'Buscar na Popularia';

  return (
    <Screen>
      <KeyboardView style={styles.flex}>
        <View style={styles.header}>
          {topicId ? <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /> : null}
          <View style={styles.titleWrap}>
            {topicId ? <AppText variant="label" color={Colors.red}>Assuntos da Popularia</AppText> : null}
            <AppText variant="display" accessibilityRole="header" style={styles.title}>{title}</AppText>
          </View>
          <View style={styles.search}>
            <Icon name="search" size={20} />
            <TextInput value={query} onChangeText={setQuery} placeholder={placeholder} accessibilityLabel={placeholder}
              placeholderTextColor={Colors.placeholder} returnKeyType="search" autoCorrect={false} autoCapitalize="none" maxLength={100} style={styles.input} />
            {query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => setQuery('')} /> : null}
          </View>
          <View style={styles.filters}>
            <ChipRow options={FILTERS.filter((f) => !topicId || f.key !== 'people')} value={filter} onChange={setFilter} accessibilityLabel="Filtrar resultados" />
          </View>
        </View>
        {data.status === 'error' ? <StateView kind="error" message="Não conseguimos atualizar a descoberta." onRetry={reload} /> : null}
        {!data.data ? (data.status === 'loading' ? <StateView kind="loading" message="Carregando descoberta" /> : null) :
          topicId && !topic ? <StateView kind="empty" title="Assunto não encontrado" /> :
          showHome ? <DiscoveryHome data={data.data} topic={topic} onSee={setFilter} refreshing={data.isRefreshing} onRefresh={reload} /> :
          short ? <StateView kind="empty" title="Continue escrevendo" message="Use pelo menos três letras ou números seguidos para buscar." /> :
          query.trim() !== debounced ? <StateView kind="loading" message="Buscando" /> :
          <SearchResults ownUserId={me.id} query={debounced} filter={filter} topicId={topicId} topics={data.data.topics} onSee={setFilter} />}
      </KeyboardView>
    </Screen>
  );
}

function DiscoveryHome({ data, topic, onSee, refreshing, onRefresh }: {
  data: DiscoveryData; topic?: Topic; onSee: (filter: DiscoveryFilter) => void; refreshing: boolean; onRefresh: () => void;
}) {
  const nav = useNav();
  const recent = data.recentPosts.filter((p) => !data.posts.some((featured) => featured.id === p.id));
  const empty = !data.comunas.length && !data.posts.length && !data.people.length && !recent.length;
  return (
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.red} />}>
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
  const load = useCallback((cursor: string | null) => searchDiscovery(ownUserId, query, filter, topicId, cursor), [ownUserId, query, filter, topicId]);
  const result = usePaginatedData(load);
  const { refresh } = result;
  const focusedOnce = useRef(false);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) refreshRef.current();
    focusedOnce.current = true;
  }, []));
  return (
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={result.isRefreshing} onRefresh={refresh} tintColor={Colors.red} />}>
      {result.status === 'loading' ? <StateView kind="loading" message="Buscando" /> : null}
      {result.status === 'error' || result.refreshError ? <StateView kind="error" message="Não conseguimos buscar agora." onRetry={refresh} /> : null}
      {result.status === 'success' && !result.items.length ? <StateView kind="empty" title="Nenhum resultado" message={query ? `Nada para “${query}”. Tente outra palavra.` : 'Nada nesta categoria por enquanto.'} /> : null}
      {FILTERS.filter((f) => f.key !== 'all').map((section) => {
        const items = result.items.filter((item) => item.kind === section.key);
        return items.length ? <View key={section.key} style={styles.section}>
          <SectionHeading label={section.label} actionLabel={filter === 'all' ? 'Ver todas' : undefined} onAction={() => onSee(section.key)} />
          {items.map((entry) => entry.kind === 'comunas' ? <DiscoveryComuna key={entry.id} comuna={entry.value} topics={topics} /> :
            entry.kind === 'people' ? <PersonRow key={entry.id} user={entry.value} subtitle={`@${entry.value.handle}`} onOpen={() => nav.openProfile(entry.id)} /> :
            <DiscoveryPostRow key={entry.id} post={entry.value} />)}
        </View> : null;
      })}
      {result.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais resultados." onRetry={result.loadMore} /> :
        result.hasMore ? <PillButton label={result.loadingMore ? 'Carregando…' : 'Carregar mais'} variant="outline" disabled={result.loadingMore} onPress={result.loadMore} /> : null}
    </ScrollView>
  );
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
  header: { paddingTop: Spacing.one, paddingBottom: Spacing.three, borderBottomWidth: 1.5, borderBottomColor: Colors.ink, backgroundColor: Colors.cream },
  titleWrap: { paddingHorizontal: Spacing.five, paddingTop: Spacing.one },
  title: { lineHeight: 48, paddingBottom: Spacing.one },
  search: { marginTop: Spacing.two, marginHorizontal: Spacing.five, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1.5, borderColor: Colors.ink, borderRadius: Radius.pill, backgroundColor: Colors.paper, paddingLeft: 14, paddingRight: 2 },
  input: { flex: 1, minWidth: 0, minHeight: 46, fontFamily: Fonts.regular, fontSize: 15.5, color: Colors.ink, paddingVertical: Spacing.two, outlineWidth: 0 },
  filters: { paddingTop: Spacing.three },
  content: { paddingHorizontal: Spacing.five, paddingBottom: Spacing.seven, gap: Spacing.five },
  section: { paddingTop: Spacing.five, gap: Spacing.one },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.two },
  topic: { minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, justifyContent: 'center', maxWidth: '100%' },
  topicLabel: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.75 },
});
