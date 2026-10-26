import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getComuna, getComunaPosts } from '@/features/comunas/api';
import { ComunaHero } from '@/features/comunas/components/comuna-hero';
import { MembersList } from '@/features/comunas/components/members-list';
import { PinnedCard } from '@/features/comunas/components/pinned-card';
import { RulesList } from '@/features/comunas/components/rules-list';
import { useInteractions } from '@/features/interactions/interactions-context';
import { PostCard } from '@/features/posts/components/post-card';
import { useLocalFeedItems } from '@/features/posts/use-local-posts';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { ApiError, describeError, NotFoundError } from '@/lib/errors';
import { formatPeople } from '@/lib/format';
import { mergeById } from '@/lib/pagination';

/** Cor de fundo da capa listrada escura. */
const COVER_DARK = '#221C18';

type ComunaTab = 'posts' | 'regras' | 'membros';

const TABS: TabOption<ComunaTab>[] = [
  { key: 'posts', label: 'Publicações' },
  { key: 'regras', label: 'Regras' },
  { key: 'membros', label: 'Membros' },
];

/** Página da comuna (design 1b). */
export default function ComunaScreen() {
  const { id, aba } = useLocalSearchParams<{ id: string; aba?: string }>();
  // "Ver regras da comuna" (depois de uma denúncia) abre direto na aba Regras.
  const [tab, setTab] = useState<ComunaTab>(TABS.some((t) => t.key === aba) ? (aba as ComunaTab) : 'posts');
  const insets = useSafeAreaInsets();

  const loadComuna = useCallback(() => getComuna(id), [id]);
  const loadPosts = useCallback((cursor: string | null) => getComunaPosts(id, cursor), [id]);
  const comuna = useAsyncData(loadComuna);
  const posts = usePaginatedData(loadPosts);
  // Modo demonstração: publicações feitas neste aparelho aparecem no topo, antes das dos mocks.
  const localPosts = useLocalFeedItems((p) => p.comunaId === id);
  const postItems = mergeById(localPosts, posts.items);
  const { show: showToast } = useToast();

  // Depois de publicar (na API), recarrega as publicações para mostrar a nova.
  const { postsVersion } = useInteractions();
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

  // A capa é escura: ícones claros na barra de status enquanto esta tela está em foco.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

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

  return (
    // Faixa escura atrás da barra de status; o conteúdo rola abaixo dela.
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView stickyHeaderIndices={[1]} style={styles.scrollView} contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <ComunaHero comuna={data} />
        </View>
        <View style={styles.tabs}>
          <View style={styles.column}>
            <UnderlineTabs options={TABS} value={tab} onChange={setTab} height={46} />
          </View>
        </View>
        <View style={styles.column}>
          {tab === 'posts' ? (
            <>
              {data.pinned ? <PinnedCard title={data.pinned.title} text={data.pinned.text} /> : null}
              {posts.status === 'loading' ? <StateView kind="loading" message="Carregando publicações" /> : null}
              {posts.status === 'error' ? <PostsError error={posts.error} onRetry={posts.refresh} /> : null}
              {posts.status === 'success' && postItems.length === 0 ? (
                <StateView kind="empty" title="Nenhuma publicação ainda" />
              ) : null}
              {postItems.map((item) => (
                <PostCard key={item.id} item={item} showRule showComuna={false} />
              ))}
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
            </>
          ) : null}
          {tab === 'regras' ? (
            <RulesList rules={data.rules} moderationNote={data.moderationNote} moderators={data.moderators} />
          ) : null}
          {tab === 'membros' ? (
            <MembersList members={data.members} totalLabel={formatPeople(data.memberCount)} />
          ) : null}
        </View>
      </ScrollView>
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
  more: {
    alignSelf: 'center',
    marginVertical: Spacing.five,
  },
  root: {
    flex: 1,
    backgroundColor: COVER_DARK,
  },
  scrollView: {
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
    backgroundColor: Colors.cream,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
});
