import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
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
  const { width, fontScale } = useWindowDimensions();
  // Em telas estreitas ou com fonte ampliada, o título fica com a largura toda.
  const compactHero = width < 360 || fontScale > 1.2;
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
          {index === 0 || (index > 0 && mineIds.has(items[index - 1].id) && !mineIds.has(item.id)) ? <View style={styles.section}>
            <SectionHeading appearance="editorial" label={mineIds.has(item.id) ? 'Suas Praças' : 'Acontecendo agora'} />
          </View> : null}
          <SquareRow square={item} />
        </>}
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.intro}>
            <View style={styles.introCopy}>
              <AppText accessibilityRole="header" style={styles.heroTitle}>Praças</AppText>
              <AppText style={styles.heroSubtitle}>Encontre, participe e organize atividades na sua <AppText style={styles.heroSubtitleAccent}>comunidade</AppText>.</AppText>
            </View>
            {compactHero ? null : <View pointerEvents="none" style={styles.illustrationWrap}>
              <Image fadeDuration={0}
                source={require('@/assets/squares/squares-hero-park-illustration.png')}
                resizeMode="contain"
                style={styles.illustration}
                accessible={false}
              />
            </View>}
          </View>
          <View style={styles.searchGroup}>
            <AppText variant="label" style={styles.searchLabel}>Buscar Praças</AppText>
            <View style={styles.search}>
              <Icon name="search" size={20} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Ex.: tarifa zero" placeholderTextColor={Colors.muted} accessibilityLabel="Buscar Praças" autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.input} />
              {query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => setQuery('')} /> : null}
            </View>
          </View>
        </View>}
        ListEmptyComponent={loading ? <StateView kind="loading" message="Carregando Praças" /> : !mine.error && !discover.error ? <StateView kind="empty" title={term ? 'Nenhuma Praça encontrada' : 'Abra uma conversa'} message={term ? 'Tente buscar por outro nome ou lugar.' : 'As Praças das comunas aparecerão aqui.'} /> : undefined}
        ListFooterComponent={<View style={styles.footer}>
          {mine.error || discover.error || mine.refreshError || discover.refreshError ? <StateView kind="error" message="Não foi possível atualizar as Praças." onRetry={refresh} /> : null}
          {mine.loadMoreError || discover.loadMoreError ? <StateView kind="error" message="Não foi possível carregar mais Praças." onRetry={() => { mine.loadMore(); discover.loadMore(); }} /> : null}
          {mine.hasMore ? <PillButton variant="outline" label={mine.loadingMore ? 'Carregando…' : 'Mais das suas Praças'} onPress={mine.loadMore} disabled={mine.loadingMore} /> : null}
          {discover.hasMore ? <PillButton variant="outline" label={discover.loadingMore ? 'Carregando…' : 'Mais Praças acontecendo'} onPress={discover.loadMore} disabled={discover.loadingMore} /> : null}
          {noJoined ? <View style={styles.community}>
            <View style={styles.communityCopy}>
              <AppText variant="bodyStrong">Encontre sua comunidade</AppText>
              <AppText variant="caption">Descubra comunas e participe das conversas.</AppText>
            </View>
            <EditorialAction label="Explorar comunas" labelVariant="button" icon="globe" onPress={() => router.navigate('/explorar')} />
          </View> : null}
        </View>}
      />
    </Screen>
  );
}

function SquareRow({ square: s }: { square: Square }) {
  const topics = (s.comuna?.topics ?? []).map((id) => topicLabels.get(id)).filter((label): label is string => !!label).slice(0, 2);
  const presence = s.presence ?? 0;
  const presenceLabel = s.status === 'closed' ? 'Praça encerrada · histórico' : `${presence} ${presence === 1 ? 'pessoa' : 'pessoas'} na praça`;
  // A origem só acrescenta quando difere do título, como em "Tarifa Zero BH" dentro da própria comuna.
  const origin = s.comuna?.name ?? s.lastMessage?.author?.displayName ?? null;
  const showOrigin = !!origin && origin.trim().toLowerCase() !== s.title.trim().toLowerCase();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Entrar na Praça ${s.title}`} onPress={() => openSquare(s.id)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
    <View style={styles.cardRow}>
      <ComunaMark initials={initialsOf(s.title)} tone={s.comuna?.tone ?? 'red'} size={44} />
      <View style={styles.cardContent}>
        <AppText variant="bodyStrong" style={styles.cardTitle} numberOfLines={2}>{s.title}</AppText>
        {showOrigin ? <AppText variant="caption" numberOfLines={1}>{origin}</AppText> : null}
        <View style={styles.activity}>
          {s.status === 'active' && presence > 0 ? <View style={styles.liveDot} /> : null}
          <AppText variant="caption">{presenceLabel}</AppText>
        </View>
        {s.unread ? <AppText variant="caption" color={Colors.red} style={styles.unread}>{s.unread} {s.unread === 1 ? 'nova mensagem' : 'novas mensagens'}</AppText> : null}
        {topics.length ? <View style={styles.tags}>{topics.map((label) => <View key={label} style={styles.tag}><AppText style={styles.tagText}>{label}</AppText></View>)}</View> : null}
      </View>
      <Icon name="chevronRight" size={18} color={Colors.muted} />
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: Spacing.seven },
  header: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, gap: Spacing.three },
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  introCopy: { flex: 1, minWidth: 0, gap: Spacing.three },
  heroTitle: { fontFamily: Fonts.anton, fontSize: 54, lineHeight: 68, letterSpacing: -0.8, textTransform: 'uppercase' },
  illustrationWrap: { width: '40%', aspectRatio: 1.5, marginTop: Spacing.two },
  illustration: { width: '100%', height: '100%' },
  heroSubtitle: { fontSize: 16, lineHeight: 23, color: Colors.muted },
  heroSubtitleAccent: { fontFamily: Fonts.bold, color: Colors.red },
  searchGroup: { gap: Spacing.two },
  searchLabel: { lineHeight: 16 },
  search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontFamily: Fonts.regular, fontSize: 18, lineHeight: 24, color: Colors.ink, paddingVertical: Spacing.two, outlineWidth: 0 },
  section: { paddingHorizontal: Spacing.five, paddingTop: Spacing.four, paddingBottom: Spacing.one },
  card: { marginHorizontal: Spacing.five, marginBottom: Spacing.two, padding: Spacing.three, borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: Colors.paper },
  cardPressed: { backgroundColor: Colors.strawLight },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cardContent: { flex: 1, minWidth: 0, gap: Spacing.one },
  cardTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 22 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
  unread: { fontFamily: Fonts.bold },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingTop: Spacing.half },
  tag: { backgroundColor: Colors.strawLight, borderRadius: Radius.sm, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  tagText: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 17 },
  footer: { padding: Spacing.five, gap: Spacing.three },
  community: { borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: Colors.paper, padding: Spacing.five, gap: Spacing.three },
  communityCopy: { gap: Spacing.one },
});
