import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { initialsOf } from '@/lib/format';
import { topicGroups } from '@/mocks/topics';

import { listSquares, type Square } from './api';

const topicLabels = new Map(topicGroups.flatMap((group) => group.topics).map((topic) => [topic.id, topic.shortLabel]));

export function openSquare(id: string) { router.push({ pathname: '/praca/[id]', params: { id } }); }

export default function SquaresScreen() {
  if (DEMO_MODE) return <Screen><StateView kind="empty" title="A conversa acontece ao vivo" message="Conecte o aplicativo ao servidor para acessar as Praças." /></Screen>;
  return <ConnectedSquares />;
}

function ConnectedSquares() {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const mine = usePaginatedData(useCallback((cursor: string | null) => listSquares('mine', cursor, term), [term]));
  const discover = usePaginatedData(useCallback((cursor: string | null) => listSquares('discover', cursor, term), [term]));
  const refreshMine = mine.refresh;
  const refreshDiscover = discover.refresh;
  const refresh = useCallback(() => { refreshMine(); refreshDiscover(); }, [refreshMine, refreshDiscover]);
  const revalidateMine = mine.revalidate;
  const revalidateDiscover = discover.revalidate;
  const revalidate = useCallback(() => { revalidateMine(); revalidateDiscover(); }, [revalidateMine, revalidateDiscover]);
  const revalidateRef = useRef(revalidate);
  const focusedOnce = useRef(false);
  useEffect(() => { revalidateRef.current = revalidate; }, [revalidate]);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) revalidateRef.current();
    focusedOnce.current = true;
  }, []));
  const mineIds = new Set(mine.items.map((s) => s.id));
  const items = [...mine.items, ...discover.items.filter((s) => !mineIds.has(s.id))];
  const loading = mine.status === 'loading' || discover.status === 'loading';
  const pullRefresh = useManualRefresh(loading || mine.isRefreshing || discover.isRefreshing, refresh);
  const noJoined = mine.status === 'success' && mine.items.length === 0;
  return (
    <Screen>
      <FlatList
        testID="squares-list"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(s) => s.id}
        refreshing={pullRefresh.refreshing}
        onRefresh={pullRefresh.onRefresh}
        renderItem={({ item, index }) => <>
          {index === 0 || (index > 0 && mineIds.has(items[index - 1].id) && !mineIds.has(item.id)) ? <SquaresSection label={mineIds.has(item.id) ? 'Suas Praças' : 'Acontecendo agora'} /> : null}
          <SquareRow square={item} />
        </>}
        ListHeaderComponent={<View style={styles.listHeader}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <AppText accessibilityRole="header" style={styles.heroTitle}>Praças</AppText>
              <AppText style={styles.heroSubtitle}>
                Encontre, participe e organize atividades na{`\n`}sua <AppText style={[styles.heroSubtitle, styles.heroSubtitleAccent]}>comunidade.</AppText>
              </AppText>
            </View>
            <Image
              source={require('@/assets/squares/squares-hero-park-illustration.png')}
              resizeMode="contain"
              style={styles.heroIllustration}
              accessible={false}
            />
          </View>
          <View style={styles.search}><Icon name="search" size={24} /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar Praças" placeholderTextColor={Colors.placeholder} accessibilityLabel="Buscar Praças" autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.input} />{query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => setQuery('')} /> : null}</View>
        </View>}
        ListEmptyComponent={loading ? <StateView kind="loading" message="Carregando Praças" /> : !mine.error && !discover.error ? <StateView kind="empty" title={term ? 'Nenhuma Praça encontrada' : 'Abra uma conversa'} message={term ? 'Tente buscar por outro nome ou lugar.' : 'As Praças das comunas aparecerão aqui.'} /> : undefined}
        ListFooterComponent={<View style={styles.footer}>
          {mine.error || discover.error || mine.refreshError || discover.refreshError ? <StateView kind="error" message="Não foi possível atualizar as Praças." onRetry={refresh} /> : null}
          {mine.loadMoreError || discover.loadMoreError ? <StateView kind="error" message="Não foi possível carregar mais Praças." onRetry={() => { mine.loadMore(); discover.loadMore(); }} /> : null}
          {mine.hasMore ? <PillButton variant="outline" label={mine.loadingMore ? 'Carregando…' : 'Mais das suas Praças'} onPress={mine.loadMore} disabled={mine.loadingMore} /> : null}
          {discover.hasMore ? <PillButton variant="outline" label={discover.loadingMore ? 'Carregando…' : 'Mais Praças acontecendo'} onPress={discover.loadMore} disabled={discover.loadingMore} /> : null}
          {noJoined ? <View style={styles.community}>
            <AppText variant="bodyStrong">Encontre sua comunidade</AppText>
            <AppText variant="caption">Descubra comunas e participe das conversas.</AppText>
            <PillButton variant="outline" label="→ Explorar comunas" onPress={() => router.navigate('/explorar')} />
          </View> : null}
        </View>}
      />
    </Screen>
  );
}

function SquareRow({ square: s }: { square: Square }) {
  const topics = (s.comuna?.topics ?? []).map((id) => topicLabels.get(id)).filter((label): label is string => !!label).slice(0, 2);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Entrar na Praça ${s.title}`} onPress={() => openSquare(s.id)} style={styles.row}>
    <View style={styles.markShell}>
      <ComunaMark initials={initialsOf(s.title)} tone={s.comuna?.tone ?? 'red'} size={64} style={styles.mark} />
    </View>
    <View style={styles.content}>
      <AppText variant="bodyStrong" style={styles.name}>{s.title}</AppText>
      {s.unread ? <AppText variant="caption" color={Colors.red}>{s.unread} novas mensagens</AppText> : null}
      <AppText style={styles.presence} color={s.status === 'active' ? Colors.red : Colors.muted}>{s.status === 'closed' ? 'Praça encerrada · histórico' : `● ${s.presence ?? 0} pessoas na praça`}</AppText>
      <AppText style={styles.origin} numberOfLines={1}>{s.comuna?.name ?? s.lastMessage?.author?.displayName ?? 'Comunidade Popularia'}</AppText>
      {topics.length ? <View style={styles.tags}>{topics.map((label) => <View key={label} style={styles.tag}><AppText variant="label" style={styles.tagText}>{label}</AppText></View>)}</View> : null}
    </View>
    <View style={styles.chevron}><Icon name="chevronRight" size={28} /></View>
  </Pressable>;
}

function SquaresSection({ label }: { label: string }) {
  return <View style={styles.section}>
    <View style={styles.sectionTitle}><View style={styles.sectionMark} /><AppText variant="label" style={styles.sectionText}>{label}</AppText></View>
    {label === 'Suas Praças' ? <View style={styles.sort}><AppText variant="label" style={styles.sortText}>Mais recentes</AppText><Icon name="chevronDown" size={20} /></View> : null}
  </View>;
}
const styles = StyleSheet.create({
  list: { paddingBottom: Spacing.seven },
  listHeader: {},
  hero: { minHeight: 178, position: 'relative', paddingHorizontal: Spacing.five, paddingTop: Spacing.three },
  heroCopy: { width: '64%', zIndex: 1, paddingTop: Spacing.one },
  heroTitle: { fontFamily: Fonts.anton, fontSize: 52, lineHeight: 62, letterSpacing: 0, textTransform: 'uppercase' },
  heroSubtitle: { width: '92%', marginTop: Spacing.three, fontFamily: Fonts.mono, fontSize: 13, lineHeight: 19, letterSpacing: 0.2, textTransform: 'uppercase', color: Colors.inkSoft },
  heroSubtitleAccent: { color: Colors.red, fontFamily: Fonts.monoSemibold },
  heroIllustration: { position: 'absolute', top: -3, right: Spacing.three, width: '56%', height: '105%' },
  search: { marginHorizontal: Spacing.five, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, paddingLeft: Spacing.four, paddingRight: 2 },
  input: { flex: 1, minWidth: 0, minHeight: 56, fontFamily: Fonts.regular, fontSize: 17, color: Colors.ink, paddingVertical: Spacing.two },
  section: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingHorizontal: Spacing.five, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sectionMark: { width: 12, height: 12, backgroundColor: Colors.red },
  sectionText: { fontSize: 13.5 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  sortText: { fontSize: 12 },
  row: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginHorizontal: Spacing.five, marginBottom: Spacing.three, padding: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  markShell: { width: 76, minHeight: 82, alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRightWidth: 1.5, borderRightColor: Colors.ink, paddingRight: Spacing.two },
  mark: { flexShrink: 0, borderRadius: 0 },
  content: { flex: 1, minWidth: 0, gap: Spacing.one },
  name: { fontFamily: Fonts.condensed, fontSize: 18, lineHeight: 21, textTransform: 'uppercase' },
  presence: { fontSize: 12, lineHeight: 16 },
  origin: { fontSize: 12, lineHeight: 16, color: Colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'nowrap', gap: Spacing.two, paddingTop: Spacing.half },
  tag: { minWidth: 0, borderWidth: 1.5, borderColor: Colors.ink, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 8.5, lineHeight: 12 },
  chevron: { width: 20, alignItems: 'flex-end' },
  footer: { padding: Spacing.five, gap: Spacing.three },
  community: { borderWidth: 1.5, borderColor: Colors.ink, borderRadius: 10, padding: Spacing.five, gap: 12, alignItems: 'center' },
});
