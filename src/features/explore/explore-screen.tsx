import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ChipRow } from '@/components/chip';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { TONE_COLORS } from '@/components/avatar';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { COMPACT_CARD_WIDTH, CompactComunaCard } from '@/features/comunas/components/comuna-card';
import { ComunaRow } from '@/features/comunas/components/comuna-row';
import { JoinButton } from '@/features/comunas/components/join-button';
import { rankByInterests } from '@/features/comunas/rank';
import { PersonRow } from '@/features/profiles/components/person-row';
import { useAsyncData } from '@/hooks/use-async-data';
import { formatCount, formatPeople } from '@/lib/format';
import { useNav } from '@/lib/routes';
import type { Comuna, ExploreFilter, FeedItem, Topic } from '@/types/models';

import { getExploreData, type ExploreData } from './api';
import { searchExplore, sectionLimit } from './search';

const FILTERS: { key: ExploreFilter; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'comunas', label: 'Comunas' },
  { key: 'pessoas', label: 'Pessoas' },
  { key: 'assuntos', label: 'Assuntos' },
  { key: 'posts', label: 'Publicações' },
];

/** Explorar e pesquisar (design 2e). */
export default function ExploreScreen() {
  const me = useMe();
  const load = useCallback(() => getExploreData(me.id), [me.id]);
  const data = useAsyncData(load);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExploreFilter>('tudo');

  const showHome = query.trim() === '' && filter === 'tudo';

  let body;
  if (data.status === 'error') {
    body = <StateView kind="error" message="Não conseguimos carregar o Explorar." onRetry={data.reload} />;
  } else if (!data.data) {
    body = <StateView kind="loading" message="Carregando" />;
  } else if (showHome) {
    body = <ExploreHome data={data.data} onSearch={setQuery} onSeeComunas={() => setFilter('comunas')} />;
  } else {
    body = (
      <ExploreResults
        data={data.data}
        query={query}
        filter={filter}
        onTopic={(t) => {
          setQuery(t.shortLabel);
          setFilter('tudo');
        }}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          Explorar
        </AppText>
        <View style={styles.search}>
          <Icon name="search" size={20} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Comunas, pessoas e assuntos"
            placeholderTextColor={Colors.placeholder}
            accessibilityLabel="Buscar comunas, pessoas e assuntos"
            returnKeyType="search"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? (
            <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => setQuery('')} />
          ) : null}
        </View>
        <View style={styles.filters}>
          <ChipRow options={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filtrar resultados" />
        </View>
      </View>
      {body}
    </Screen>
  );
}

type HomeProps = {
  data: ExploreData;
  onSearch: (query: string) => void;
  onSeeComunas: () => void;
};

function ExploreHome({ data, onSearch, onSeeComunas }: HomeProps) {
  const { interests } = useAccount();
  const nav = useNav();
  const recommended = useMemo(() => rankByInterests(data.comunas, interests).slice(0, 5), [data.comunas, interests]);
  const hot = useMemo(
    () => [...data.posts].sort((a, b) => b.supportCount - a.supportCount).slice(0, 4),
    [data.posts],
  );
  const popular = useMemo(
    () => [...data.comunas].sort((a, b) => b.memberCount - a.memberCount).slice(0, 4),
    [data.comunas],
  );

  return (
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.section}>
        <SectionHeading label="Assuntos em destaque" />
        <View style={styles.trends}>
          {data.trends.map((t, i) => {
            const tone = TONE_COLORS[t.tone];
            return (
              <Pressable
                key={t.label}
                onPress={() => onSearch(t.query)}
                accessibilityRole="button"
                accessibilityLabel={`${t.label}, ${t.postCountLabel}`}
                accessibilityHint="Busca por este assunto"
                style={({ pressed }) => [styles.trend, { backgroundColor: tone.bg }, pressed && styles.pressed]}>
                <AppText style={styles.trendRank} color={tone.fg}>
                  #{i + 1}
                </AppText>
                <View>
                  <AppText style={styles.trendLabel} color={tone.fg}>
                    {t.label}
                  </AppText>
                  <AppText style={styles.trendCount} color={tone.fg}>
                    {t.postCountLabel}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionWide}>
        <View style={styles.padded}>
          <SectionHeading label="Comunas para você" actionLabel="Ver todas" onAction={onSeeComunas} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={COMPACT_CARD_WIDTH + Spacing.two + 2}
          decelerationRate="fast"
          contentContainerStyle={styles.carousel}>
          {recommended.map((c) => (
            <CompactComunaCard key={c.id} comuna={c} onOpen={() => nav.openComuna(c.id)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionHeading label="Em alta hoje" />
        {hot.map((p, i) => (
          <PostRow key={p.id} post={p} rank={i + 1} onOpen={() => nav.openPost(p.id)} />
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeading label="Pessoas e criadores" />
        {data.featuredPeople.map((p) => (
          <PersonRow key={p.user.id} user={p.user} subtitle={p.summary} onOpen={() => nav.openProfile(p.user.id)} />
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeading label="Comunas populares" />
        {popular.map((c) => (
          <ComunaRow
            key={c.id}
            comuna={c}
            subtitle={comunaSubtitle(c, data.topics)}
            onOpen={() => nav.openComuna(c.id)}
            trailing={<JoinButton comuna={c} short />}
          />
        ))}
      </View>
    </ScrollView>
  );
}

type ResultsProps = {
  data: ExploreData;
  query: string;
  filter: ExploreFilter;
  onTopic: (topic: Topic) => void;
};

function ExploreResults({ data, query, filter, onTopic }: ResultsProps) {
  const nav = useNav();
  const results = useMemo(() => searchExplore(data, query), [data, query]);

  const comunas = results.comunas.slice(0, sectionLimit(filter, 'comunas'));
  const people = results.people.slice(0, sectionLimit(filter, 'pessoas'));
  const topics = results.topics.slice(0, sectionLimit(filter, 'assuntos'));
  const posts = results.posts.slice(0, sectionLimit(filter, 'posts'));
  const empty = comunas.length + people.length + topics.length + posts.length === 0;

  if (empty) {
    return (
      <StateView
        kind="empty"
        title="Nada por aqui"
        message={
          query.trim()
            ? `Nenhum resultado para “${query.trim()}”. Tente outra palavra.`
            : 'Nada nesta categoria por enquanto.'
        }
      />
    );
  }

  return (
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
      {comunas.length > 0 ? (
        <View>
          <ResultsLabel label="Comunas" count={results.comunas.length} first />
          {comunas.map((c) => (
            <ComunaRow
              key={c.id}
              comuna={c}
              subtitle={comunaSubtitle(c, data.topics)}
              onOpen={() => nav.openComuna(c.id)}
              trailing={<JoinButton comuna={c} short />}
            />
          ))}
        </View>
      ) : null}
      {people.length > 0 ? (
        <View>
          <ResultsLabel label="Pessoas" count={results.people.length} first={comunas.length === 0} />
          {people.map((p) => (
            <PersonRow key={p.user.id} user={p.user} subtitle={p.summary} onOpen={() => nav.openProfile(p.user.id)} />
          ))}
        </View>
      ) : null}
      {topics.length > 0 ? (
        <View>
          <ResultsLabel label="Assuntos" count={results.topics.length} first={comunas.length + people.length === 0} />
          <View style={styles.topicWrap}>
            {topics.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onTopic(t)}
                accessibilityRole="button"
                accessibilityHint="Busca por este assunto"
                style={({ pressed }) => [styles.topic, pressed && styles.pressed]}>
                <AppText style={styles.topicLabel}>{t.label}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {posts.length > 0 ? (
        <View>
          <ResultsLabel
            label="Publicações"
            count={results.posts.length}
            first={comunas.length + people.length + topics.length === 0}
          />
          {posts.map((p) => (
            <PostRow key={p.id} post={p} onOpen={() => nav.openPost(p.id)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ResultsLabel({ label, count, first = false }: { label: string; count: number; first?: boolean }) {
  return (
    <AppText variant="label" accessibilityRole="header" style={[styles.resultsLabel, first && styles.resultsLabelFirst]}>
      {label} · {count}
    </AppText>
  );
}

/** Publicação resumida: onde foi publicada, trecho e números. Com `rank`, numerada em vermelho. */
function PostRow({ post, rank, onOpen }: { post: FeedItem; rank?: number; onOpen: () => void }) {
  const where = post.comuna ? `c/ ${post.comuna.name}` : `@${post.author.handle}`;
  const meta = `${formatCount(post.supportCount)} apoios · ${formatCount(post.commentCount)} comentários`;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="link"
      accessibilityLabel={`${rank ? `${rank}º. ` : ''}${where}. ${post.text}. ${meta}`}
      accessibilityHint="Abre a discussão"
      style={({ pressed }) => [styles.postRow, pressed && styles.pressed]}>
      {rank ? (
        <AppText style={styles.postRank} maxFontSizeMultiplier={1.1}>
          {String(rank).padStart(2, '0')}
        </AppText>
      ) : null}
      <View style={styles.postText}>
        <AppText style={styles.postWhere} color={Colors.red} numberOfLines={1}>
          {where}
        </AppText>
        <AppText style={styles.postBody} numberOfLines={3}>
          {post.text}
        </AppText>
        <AppText style={styles.postMeta} color={Colors.muted}>
          {meta}
        </AppText>
      </View>
    </Pressable>
  );
}

function comunaSubtitle(comuna: Comuna, topics: Topic[]): string {
  const tags = comuna.topics
    .slice(0, 2)
    .map((id) => topics.find((t) => t.id === id)?.shortLabel)
    .filter(Boolean)
    .join(', ');
  return `${formatPeople(comuna.memberCount)} membros · ${tags}`;
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.one,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  title: {
    paddingHorizontal: Spacing.five,
  },
  search: {
    marginTop: Spacing.two,
    marginHorizontal: Spacing.five,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.pill,
    backgroundColor: Colors.paper,
    paddingLeft: 14,
    paddingRight: 2,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.regular,
    fontSize: 15.5,
    color: Colors.ink,
    paddingVertical: 0,
    // O anel de foco é a própria borda da caixa; sem o contorno padrão do navegador.
    outlineWidth: 0,
  },
  filters: {
    paddingTop: Spacing.two + 2,
    paddingBottom: Spacing.three,
  },
  scroll: {
    paddingBottom: Spacing.seven,
  },
  section: {
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    gap: Spacing.one,
  },
  sectionWide: {
    paddingTop: Spacing.five,
    gap: Spacing.two + 2,
  },
  padded: {
    paddingHorizontal: Spacing.five,
  },
  carousel: {
    paddingHorizontal: Spacing.five,
    gap: Spacing.two + 2,
  },
  trends: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  trend: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 108,
    borderRadius: Radius.xl,
    padding: Spacing.three,
    justifyContent: 'space-between',
  },
  trendRank: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10.5,
    lineHeight: 14,
  },
  trendLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 28,
    lineHeight: 27,
    textTransform: 'uppercase',
  },
  trendCount: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 5,
  },
  pressed: {
    opacity: 0.75,
  },
  postRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  postRank: {
    minWidth: 48,
    fontFamily: Fonts.condensed,
    fontSize: 42,
    lineHeight: 40,
    color: Colors.red,
  },
  postText: {
    flex: 1,
    minWidth: 0,
  },
  postWhere: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  postBody: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 3,
  },
  postMeta: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
  },
  results: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.seven,
  },
  resultsLabel: {
    paddingTop: Spacing.five,
    paddingBottom: 2,
  },
  resultsLabelFirst: {
    paddingTop: 14,
  },
  topicWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  topic: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    justifyContent: 'center',
  },
  topicLabel: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 18,
  },
});
