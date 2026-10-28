import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { initialsOf } from '@/lib/format';

import { listSquares, type Square } from './api';

export function openSquare(id: string) { router.push({ pathname: '/praca/[id]', params: { id } }); }

export default function SquaresScreen() {
  if (DEMO_MODE) return <Screen title="Praças"><StateView kind="empty" title="A conversa acontece ao vivo" message="Conecte o aplicativo ao servidor para acessar as Praças." /></Screen>;
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
    <Screen title="Praças">
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
          {index === 0 || (index > 0 && mineIds.has(items[index - 1].id) && !mineIds.has(item.id)) ? <AppText variant="label" color={Colors.muted} style={styles.section}>{mineIds.has(item.id) ? 'Suas Praças' : 'Acontecendo agora'}</AppText> : null}
          <SquareRow square={item} />
        </>}
        ListHeaderComponent={<View style={styles.search}><Icon name="search" size={20} /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar Praças" placeholderTextColor={Colors.placeholder} accessibilityLabel="Buscar Praças" autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.input} />{query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => setQuery('')} /> : null}</View>}
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
  return <Pressable accessibilityRole="button" accessibilityLabel={`Entrar na Praça ${s.title}`} onPress={() => openSquare(s.id)} style={styles.row}>
    <ComunaMark initials={initialsOf(s.title)} tone={s.comuna?.tone ?? 'red'} size={46} />
    <View style={styles.content}>
      <AppText variant="bodyStrong" style={styles.name}>{s.title}</AppText>
      {s.unread ? <AppText variant="caption" color={Colors.red}>{s.unread} novas mensagens</AppText> : null}
      <AppText variant="caption" color={s.status === 'active' ? Colors.red : Colors.muted}>{s.status === 'closed' ? 'Praça encerrada · histórico' : `● ${s.presence ?? 0} pessoas na praça`}</AppText>
      {s.lastMessage?.author ? <AppText variant="caption" numberOfLines={1}>{s.lastMessage.author.displayName}: {s.lastMessage.body ?? 'Figurinha'}</AppText> : null}
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  list: { paddingTop: Spacing.three },
  search: { marginHorizontal: Spacing.five, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1.5, borderColor: Colors.ink, borderRadius: Radius.pill, backgroundColor: Colors.paper, paddingLeft: 14, paddingRight: 2 },
  input: { flex: 1, minWidth: 0, minHeight: 46, fontFamily: Fonts.regular, fontSize: 15.5, color: Colors.ink, paddingVertical: Spacing.two },
  section: { paddingHorizontal: Spacing.five, paddingTop: Spacing.six, paddingBottom: Spacing.two },
  row: { flexDirection: 'row', gap: 14, padding: Spacing.five, borderBottomWidth: 1, borderColor: Colors.rule },
  content: { flex: 1, gap: 4 }, name: { textTransform: 'uppercase' },
  footer: { padding: Spacing.five, gap: Spacing.three },
  community: { borderWidth: 1.5, borderColor: Colors.ink, borderRadius: 10, padding: Spacing.five, gap: 12, alignItems: 'center' },
});
