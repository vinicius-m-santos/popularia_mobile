import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Radius, Shadows, Spacing } from '@/constants/theme';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { initialsOf } from '@/lib/format';

import { listSquares, type Square } from './api';

type Row =
  | { kind: 'heading'; key: string; label: string; aside?: string }
  | { kind: 'square'; key: string; square: Square; joined: boolean };

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
  const discoverItems = discover.items.filter((s) => !mineIds.has(s.id) && s.status !== 'closed');
  const rows: Row[] = [];
  if (mine.items.length) {
    rows.push({ kind: 'heading', key: 'mine-heading', label: 'Suas Praças' });
    rows.push(...mine.items.map((square) => ({ kind: 'square' as const, key: `mine-${square.id}`, square, joined: true })));
  }
  if (discoverItems.length) {
    rows.push({ kind: 'heading', key: 'discover-heading', label: 'Movimentadas agora', aside: 'perto de você' });
    rows.push(...discoverItems.map((square) => ({ kind: 'square' as const, key: `discover-${square.id}`, square, joined: false })));
  }
  const loading = mine.status === 'loading' || discover.status === 'loading';
  const pullRefresh = useManualRefresh(loading || mine.isRefreshing || discover.isRefreshing, refresh);
  const noJoined = mine.status === 'success' && mine.items.length === 0 && !term;
  const bothEmpty = mine.status === 'success' && discover.status === 'success' && mine.items.length === 0 && discoverItems.length === 0;
  return (
    <Screen>
      <FlatList
        testID="squares-list"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(row) => row.key}
        refreshing={pullRefresh.refreshing}
        onRefresh={pullRefresh.onRefresh}
        renderItem={({ item }) => item.kind === 'heading'
          ? <View style={styles.section}>
              <SectionHeading appearance="editorial" label={item.label} trailing={item.aside ? <AppText variant="caption">{item.aside}</AppText> : undefined} />
            </View>
          : <SquareRow square={item.square} joined={item.joined} />}
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.intro}>
            <View style={styles.introCopy}>
              <AppText accessibilityRole="header" style={styles.heroTitle}>Praças</AppText>
              <AppText style={styles.heroSubtitle}>A conversa ao vivo de cada <AppText style={styles.heroSubtitleAccent}>comunidade.</AppText></AppText>
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
          <View style={styles.search}>
            <Icon name="search" size={17} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Buscar praça. Ex.: tarifa zero" placeholderTextColor={Colors.muted} accessibilityLabel="Buscar praça" autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.input} />
            {query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => setQuery('')} /> : null}
          </View>
        </View>}
        ListEmptyComponent={loading
          ? <StateView kind="loading" message="Carregando Praças" />
          : !mine.error && !discover.error
            ? <StateView kind="empty" title={term ? 'Nenhuma Praça encontrada' : 'Abra uma conversa'} message={term ? 'Tente buscar por outro nome ou lugar.' : 'As Praças das comunas aparecerão aqui.'} />
            : undefined}
        ListFooterComponent={<View style={styles.footer}>
          {mine.error || discover.error || mine.refreshError || discover.refreshError ? <StateView kind="error" message="Não foi possível atualizar as Praças." onRetry={refresh} /> : null}
          {mine.loadMoreError || discover.loadMoreError ? <StateView kind="error" message="Não foi possível carregar mais Praças." onRetry={() => { mine.loadMore(); discover.loadMore(); }} /> : null}
          {mine.hasMore ? <EditorialAction label={mine.loadingMore ? 'Carregando…' : 'Mais das suas Praças'} icon="chevronDown" labelVariant="button" disabled={mine.loadingMore} onPress={mine.loadMore} style={styles.moreAction} /> : null}
          {discover.hasMore ? <EditorialAction label={discover.loadingMore ? 'Carregando…' : 'Mais Praças acontecendo'} icon="chevronDown" labelVariant="button" disabled={discover.loadingMore} onPress={discover.loadMore} style={styles.moreAction} /> : null}
          {noJoined && !bothEmpty ? <View style={styles.community}>
            <View style={styles.communityCopy}>
              <AppText variant="bodyStrong">Encontre sua comunidade</AppText>
              <AppText variant="caption">Descubra comunas e participe das conversas.</AppText>
            </View>
            <EditorialAction label="Explorar comunas" labelVariant="button" icon="globe" onPress={() => router.navigate('/explorar')} style={styles.moreAction} />
          </View> : null}
        </View>}
      />
    </Screen>
  );
}

function SquareMark({ title, tone, highlight = false }: { title: string; tone: 'red' | 'black' | 'cream'; highlight?: boolean }) {
  return <ComunaMark
    initials={initialsOf(title)}
    tone={tone}
    size={50}
    initialScale={0.38}
    style={[styles.mark, highlight && tone === 'cream' && styles.markLive]}
  />;
}

function messagePreview(square: Square) {
  const message = square.lastMessage;
  if (!message) return 'Ninguém falou ainda. Puxa o assunto!';
  const author = message.author?.displayName ?? 'Alguém';
  const body = message.status === 'deleted' ? 'Mensagem apagada' : message.body ?? (message.sticker ? `Figurinha ${message.sticker.label}` : 'Mensagem');
  return `${author}: ${body}`;
}

function messageTime(square: Square) {
  const createdAt = square.lastMessage?.createdAt;
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function SquareRow({ square: s, joined }: { square: Square; joined: boolean }) {
  const presence = s.presence ?? 0;
  const time = messageTime(s);
  const unread = s.unread ?? 0;
  if (!joined) {
    return <View style={styles.discoverCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Espiar a Praça ${s.title}`} onPress={() => openSquare(s.id)} style={({ pressed }) => [styles.discoverMain, pressed && styles.discoverPressed]}>
        <SquareMark title={s.title} tone={s.comuna?.tone ?? 'cream'} highlight />
        <View style={styles.discoverCopy}>
          <AppText style={styles.discoverTitle} numberOfLines={2}>{s.title}</AppText>
          <View style={styles.activity}>
            {presence > 0 ? <View style={styles.liveDot} /> : null}
            <AppText variant="caption" style={styles.discoverPresence}>{presence > 0 ? `${presence} ${presence === 1 ? 'pessoa conversando' : 'pessoas conversando'} agora` : 'Ninguém conversando agora'}</AppText>
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Espiar ${s.title}`}
        onPress={() => openSquare(s.id)}
        style={({ pressed }) => [styles.peek, pressed && styles.peekPressed]}>
        <AppText style={styles.peekLabel}>Espiar</AppText>
      </Pressable>
    </View>;
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={`Entrar na Praça ${s.title}`} onPress={() => openSquare(s.id)} style={({ pressed }) => [styles.card, unread > 0 && styles.cardUnread, pressed && styles.cardPressed]}>
    <SquareMark title={s.title} tone={s.comuna?.tone ?? 'red'} />
    <View style={styles.cardBody}>
      <View style={styles.titleRow}>
        <AppText style={styles.cardTitle} numberOfLines={1}>{s.title}</AppText>
        {time ? <AppText variant="caption" style={styles.time}>{time}</AppText> : null}
      </View>
      <View style={styles.previewRow}>
        <AppText style={[styles.preview, !s.lastMessage && styles.previewEmpty]} numberOfLines={1}>{messagePreview(s)}</AppText>
        {unread > 0 ? <View style={styles.unread}><AppText style={styles.unreadText} color={Colors.paper}>{unread > 99 ? '99+' : unread}</AppText></View> : null}
      </View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: Spacing.seven },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.five },
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  introCopy: { flex: 1, minWidth: 0, gap: Spacing.one },
  heroTitle: { fontFamily: Fonts.anton, fontSize: 54, lineHeight: 68, letterSpacing: -0.8, textTransform: 'uppercase' },
  illustrationWrap: { width: '40%', aspectRatio: 1.5, marginTop: Spacing.two },
  illustration: { width: '100%', height: '100%' },
  heroSubtitle: { fontSize: 16, lineHeight: 23, color: Colors.muted },
  heroSubtitleAccent: { fontFamily: Fonts.bold, color: Colors.red },
  search: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: Colors.ink, borderRadius: 5, backgroundColor: Colors.paper, paddingHorizontal: Spacing.four },
  input: { flex: 1, minWidth: 0, minHeight: 46, fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 21, color: Colors.ink, paddingVertical: Spacing.two, outlineWidth: 0 },
  section: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, paddingBottom: 6 },
  card: { marginHorizontal: Spacing.four, marginBottom: Spacing.two, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 2, borderColor: Colors.ink, borderRadius: 5, backgroundColor: Colors.paper },
  cardUnread: { ...Shadows.offset, boxShadow: '3px 3px 0 #16120F' },
  cardPressed: { backgroundColor: Colors.strawLight },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { flex: 1, minWidth: 0, fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  time: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: Colors.muted },
  previewRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  preview: { flex: 1, minWidth: 0, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22 },
  previewEmpty: { fontFamily: Fonts.regular, color: Colors.muted },
  unread: { minWidth: 22, height: 22, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, backgroundColor: Colors.red },
  unreadText: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22 },
  mark: { borderWidth: 2, borderColor: Colors.ink, borderRadius: 5 },
  markLive: { backgroundColor: Colors.yellow },
  discoverCard: { marginHorizontal: Spacing.four, marginBottom: Spacing.two, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.ink, borderRadius: 5, backgroundColor: Colors.cream },
  discoverMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  discoverPressed: { opacity: 0.7 },
  discoverCopy: { flex: 1, minWidth: 0, gap: 3 },
  discoverTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  discoverPresence: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 23 },
  activity: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one },
  liveDot: { width: 6, height: 6, marginTop: 6, borderRadius: 3, backgroundColor: Colors.red },
  peek: { minHeight: 44, paddingHorizontal: Spacing.three, justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: 5, backgroundColor: Colors.paper },
  peekPressed: { backgroundColor: Colors.strawLight },
  peekLabel: { fontFamily: Fonts.extrabold, fontSize: 15.5, lineHeight: 24 },
  footer: { padding: Spacing.four, gap: Spacing.three },
  moreAction: { borderRadius: Radius.sm },
  community: { borderWidth: 2, borderColor: Colors.ink, borderRadius: 5, backgroundColor: Colors.paper, padding: Spacing.four, gap: Spacing.three },
  communityCopy: { gap: Spacing.one },
});
