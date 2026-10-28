import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, PanResponder, RefreshControl, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Spacing } from '@/constants/theme';
import { getFeed, isFeedTabAvailable } from '@/features/feed/api';
import { ComposerPrompt } from '@/features/feed/components/composer-prompt';
import { FeedHeader } from '@/features/feed/components/feed-header';
import { WelcomeBanner } from '@/features/feed/components/welcome-banner';
import { useInteractions } from '@/features/interactions/interactions-context';
import { PostCard } from '@/features/posts/components/post-card';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { describeError } from '@/lib/errors';
import type { FeedTab } from '@/types/models';

const EMPTY_MESSAGES: Record<FeedTab, { title: string; message: string }> = {
  'para-voce': { title: 'Nenhuma publicação ainda', message: 'Bora interagir? Compartilhe uma ideia e puxe a conversa.' },
  minhas: { title: 'Nenhuma comuna ainda', message: 'Participe de uma comuna para ver as publicações dela aqui.' },
  perto: { title: 'Nada perto de você', message: 'Ainda não há comunas na cidade do seu perfil.' },
};

const UNAVAILABLE = { title: 'Em breve', message: '"Perto de mim" chega numa próxima etapa.' };

/** Feed principal (design 1a). */
export default function FeedScreen() {
  const [tab, setTab] = useState<FeedTab>('para-voce');
  const { joinedComunaIds, postsVersion } = useInteractions();
  const { show: showToast } = useToast();
  // "Minhas comunas" recarrega quando a pessoa entra ou sai de uma comuna.
  const joinedKey = tab === 'minhas' ? joinedComunaIds.join(',') : '';
  const load = useCallback(
    (cursor: string | null) => getFeed({ tab, joinedComunaIds: joinedKey ? joinedKey.split(',') : [], cursor }),
    [tab, joinedKey],
  );
  const feed = usePaginatedData(load);
  const { refresh, refreshError } = feed;
  const tabs = useMemo<FeedTab[]>(() => ['para-voce', 'minhas', 'perto'], []);
  const tabIndex = tabs.indexOf(tab);
  const changeBySwipe = useCallback((direction: 1 | -1) => {
    const next = tabs[tabIndex + direction];
    if (next) setTab(next);
  }, [tabIndex, tabs]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 48 || Math.abs(gesture.dx) < Math.abs(gesture.dy) * 1.25) return;
      changeBySwipe(gesture.dx < 0 ? 1 : -1);
    },
  }), [changeBySwipe]);

  // Depois de publicar, recarrega o feed para mostrar a publicação nova no topo.
  const seenVersion = useRef(postsVersion);
  useEffect(() => {
    if (seenVersion.current === postsVersion) return;
    seenVersion.current = postsVersion;
    refresh();
  }, [postsVersion, refresh]);

  // Falha ao atualizar com itens na tela: eles continuam, e um aviso explica.
  useEffect(() => {
    if (refreshError) showToast(`Não foi possível atualizar o feed. ${describeError(refreshError)}`);
  }, [refreshError, showToast]);

  let body;
  if (feed.status === 'error') {
    body = (
      <StateView
        kind="error"
        message={`Não conseguimos carregar o feed. ${describeError(feed.error)}`}
        onRetry={feed.refresh}
      />
    );
  } else {
    body = (
      <FlatList
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        data={feed.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <PostCard item={item} showRule={index > 0} />}
        ListHeaderComponent={
          <>
            <WelcomeBanner />
            <ComposerPrompt />
          </>
        }
        ListEmptyComponent={
          feed.status === 'loading' ? (
            <StateView kind="loading" message="Carregando publicações" />
          ) : (
            <StateView kind="empty" {...(isFeedTabAvailable(tab) ? EMPTY_MESSAGES[tab] : UNAVAILABLE)} />
          )
        }
        ListFooterComponent={
          feed.loadMoreError ? (
            <StateView kind="error" message="Não conseguimos carregar mais publicações." onRetry={feed.loadMore} />
          ) : feed.loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={Colors.red} accessibilityLabel="Carregando mais publicações" />
            </View>
          ) : undefined
        }
        // Depois de uma falha, só tenta de novo pelo botão (sem repetir a cada rolagem).
        onEndReached={feed.loadMoreError ? undefined : feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefreshing}
            onRefresh={feed.refresh}
            tintColor={Colors.red}
            colors={[Colors.red]}
          />
        }
        contentContainerStyle={styles.list}
      />
    );
  }

  return (
    <Screen>
      <FeedHeader tab={tab} onTabChange={setTab} />
      <View style={styles.swipeArea} {...panResponder.panHandlers}>{body}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: Spacing.seven,
  },
  footer: {
    paddingVertical: Spacing.five,
  },
  swipeArea: {
    flex: 1,
  },
});
