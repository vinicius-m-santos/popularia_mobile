import { MediaVisibilityProvider, useListVisibility, mediaViewabilityConfig } from '@/hooks/use-list-visibility';
import { useRouteMediaFocus } from '@/hooks/use-route-media-focus';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, type PanGestureConfig } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { FlashListRef } from '@shopify/flash-list';
import { useScrollToTop } from 'expo-router';

import { DayRule } from '@/components/day-rule';
import { Screen } from '@/components/screen';
import { PopulariaList } from '@/components/list/popularia-list';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { contentPolicy } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { useToast } from '@/components/toast';
import { Colors, Spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { getFeed, isFeedTabAvailable } from '@/features/feed/api';
import { ComposerPrompt } from '@/features/feed/components/composer-prompt';
import { FeedHeader } from '@/features/feed/components/feed-header';
import { WelcomeBanner } from '@/features/feed/components/welcome-banner';
import { FEED_SWIPE_ACTIVATION_X, FEED_SWIPE_FAIL_Y, feedTabAfterSwipe } from '@/features/feed/feed-swipe';
import { HomeProgress } from '@/features/gamification/progress-screen';
import { useInteractions } from '@/features/interactions/interactions-context';
import { PostCard } from '@/features/posts/components/post-card';
import { describeError } from '@/lib/errors';
import { dayKey, formatDayRule } from '@/lib/format';
import type { FeedItem, FeedTab } from '@/types/models';

const EMPTY_MESSAGES: Record<FeedTab, { title: string; message: string }> = {
  'para-voce': { title: 'Nenhuma publicação ainda', message: 'Bora interagir? Compartilhe uma ideia e puxe a conversa.' },
  seguindo: { title: 'Nada de quem você segue', message: 'Siga pessoas para ver as publicações delas aqui.' },
  minhas: { title: 'Nenhuma comuna ainda', message: 'Participe de uma comuna para ver as publicações dela aqui.' },
  perto: { title: 'Nada perto de você', message: 'Ainda não há comunas na cidade do seu perfil.' },
};

const UNAVAILABLE = { title: 'Em breve', message: '"Perto de mim" chega numa próxima etapa.' };

/** Feed principal (design 1a). */
export default function FeedScreen() {
  const [tab, setTab] = useState<FeedTab>('para-voce');
  // A viewport é local à aba: ao trocar de aba a lista remonta e os IDs da janela
  // anterior não podem montar players antes da nova viewability.
  const visibility = useListVisibility(tab);
  // Fora do foco da rota (outra aba, publicação aberta por cima), a lista fica
  // no pôster e nenhum player novo é montado.
  useRouteMediaFocus(visibility);
  const listRef = useRef<FlashListRef<FeedItem>>(null);
  useScrollToTop(listRef);
  const { joinedComunaIds, followedUserIds, isOn } = useInteractions();
  const { show: showToast } = useToast();
  // "Minhas comunas" recarrega quando a pessoa entra ou sai de uma comuna.
  const joinedKey = tab === 'minhas' ? joinedComunaIds.join(',') : '';
  const followedKey = tab === 'seguindo' ? followedUserIds.join(',') : '';
  const load = useCallback(
    (cursor: string | null, signal: AbortSignal) => getFeed({
      tab,
      joinedComunaIds: joinedKey ? joinedKey.split(',') : [],
      followedUserIds: followedKey ? followedKey.split(',') : [],
      cursor,
      signal,
    }),
    [tab, joinedKey, followedKey],
  );
  // Na API a chave não inclui quem a pessoa segue: o cache é atualizado no follow.
  // No modo demonstração o servidor não existe, então a chave recarrega a lista.
  const feedKey = DEMO_MODE && tab === 'seguindo'
    ? queryKeys.feed.list(tab, joinedKey, followedKey)
    : queryKeys.feed.list(tab, joinedKey);
  const feed = useCachedPages({ queryKey: feedKey, load, performanceScope: 'feed', ...contentPolicy.feed });
  const { refreshError } = feed;
  // Pessoas bloqueadas somem antes de agrupar os dias: assim nenhuma regra de dia fica órfã.
  const items = useMemo(
    () => feed.items.filter((item) => !isOn('mutedUsers', item.author.handle)),
    [feed.items, isOn],
  );
  const tabs = useMemo<FeedTab[]>(() => ['para-voce', 'seguindo', 'minhas', 'perto'], []);
  // O gesto roda na UI thread; o estado só é atualizado no fim, com o resultado já decidido.
  const finishSwipe = useCallback((translationX: number, translationY: number) => {
    setTab((current) => feedTabAfterSwipe(tabs, current, translationX, translationY));
  }, [tabs]);
  const swipeConfig = useMemo<PanGestureConfig>(() => ({
    maxPointers: 1,
    activeOffsetX: [-FEED_SWIPE_ACTIVATION_X, FEED_SWIPE_ACTIVATION_X],
    failOffsetY: [-FEED_SWIPE_FAIL_Y, FEED_SWIPE_FAIL_Y],
    onDeactivate: (event) => {
      'worklet';
      // Um gesto interrompido pelo scroll ou por outro handler não troca de aba.
      if (!event.canceled) runOnJS(finishSwipe)(event.translationX, event.translationY);
    },
  }), [finishSwipe]);
  const swipeGesture = usePanGesture(swipeConfig);

  // Falha ao atualizar com itens na tela: eles continuam, e um aviso explica.
  useEffect(() => {
    if (refreshError) showToast(`Não foi possível atualizar o feed. ${describeError(refreshError)}`);
  }, [refreshError, showToast]);

  // `renderItem` não depende da viewport: os cartões assinam o próprio `postId`.
  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
    const previous = index > 0 ? items[index - 1] : null;
    const newDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
    return <>
      {newDay ? <DayRule label={formatDayRule(item.createdAt)} /> : <View style={styles.separator} />}
      <PostCard item={item} showRule={false} />
    </>;
  }, [items]);
  const getItemType = useCallback((item: FeedItem) => (
    `${item.poll ? 'poll' : 'text'}:${item.attachment?.type ?? (item.document ? 'document' : 'plain')}`
  ), []);

  const body = (
    <MediaVisibilityProvider visibility={visibility}>
      <PopulariaList
        ref={listRef}
        // Cada aba é uma lista própria: trocar de aba recomeça do topo, em vez de herdar a rolagem.
        key={tab}
        state={feed}
        performanceListId={`feed:${tab}`}
        onViewableItemsChanged={visibility.onViewableItemsChanged}
        viewabilityConfig={mediaViewabilityConfig}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemType={getItemType}
        ListHeaderComponent={<>{tab === 'para-voce' ? <WelcomeBanner /> : null}<HomeProgress /><ComposerPrompt /></>}
        emptyTitle={(isFeedTabAvailable(tab) ? EMPTY_MESSAGES[tab] : UNAVAILABLE).title}
        emptyMessage={(isFeedTabAvailable(tab) ? EMPTY_MESSAGES[tab] : UNAVAILABLE).message}
        contentContainerStyle={styles.list}
      />
    </MediaVisibilityProvider>
  );

  return (
    <Screen>
      <FeedHeader tab={tab} onTabChange={setTab} />
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.swipeArea} collapsable={false}>{body}</View>
      </GestureDetector>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: Spacing.seven,
  },
  swipeArea: {
    flex: 1,
  },
  separator: { height: 1, backgroundColor: Colors.rule },
});
