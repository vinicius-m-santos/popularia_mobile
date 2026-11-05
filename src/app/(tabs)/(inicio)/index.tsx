import { MediaVisibilityProvider, useListVisibility, mediaViewabilityConfig } from '@/hooks/use-list-visibility';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import type { FlashListRef } from '@shopify/flash-list';
import { useScrollToTop } from 'expo-router';

import { DayRule } from '@/components/day-rule';
import { Screen } from '@/components/screen';
import { PopulariaList } from '@/components/list/popularia-list';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { contentPolicy } from '@/lib/query/client';
import { useToast } from '@/components/toast';
import { Colors, Spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { getFeed, isFeedTabAvailable } from '@/features/feed/api';
import { ComposerPrompt } from '@/features/feed/components/composer-prompt';
import { FeedHeader } from '@/features/feed/components/feed-header';
import { WelcomeBanner } from '@/features/feed/components/welcome-banner';
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
  const feedKey = DEMO_MODE && tab === 'seguindo' ? ['feed', tab, joinedKey, followedKey] : ['feed', tab, joinedKey];
  const feed = useCachedPages({ queryKey: feedKey, load, performanceScope: 'feed', ...contentPolicy.feed });
  const { refreshError } = feed;
  // Pessoas bloqueadas somem antes de agrupar os dias: assim nenhuma regra de dia fica órfã.
  const items = useMemo(
    () => feed.items.filter((item) => !isOn('mutedUsers', item.author.handle)),
    [feed.items, isOn],
  );
  const tabs = useMemo<FeedTab[]>(() => ['para-voce', 'seguindo', 'minhas', 'perto'], []);
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
      <View style={styles.swipeArea} {...panResponder.panHandlers}>{body}</View>
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
