import { useListVisibility, mediaViewabilityConfig } from '@/hooks/use-list-visibility';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
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
import type { FeedTab } from '@/types/models';

const EMPTY_MESSAGES: Record<FeedTab, { title: string; message: string }> = {
  'para-voce': { title: 'Nenhuma publicação ainda', message: 'Bora interagir? Compartilhe uma ideia e puxe a conversa.' },
  seguindo: { title: 'Nada de quem você segue', message: 'Siga pessoas para ver as publicações delas aqui.' },
  minhas: { title: 'Nenhuma comuna ainda', message: 'Participe de uma comuna para ver as publicações dela aqui.' },
  perto: { title: 'Nada perto de você', message: 'Ainda não há comunas na cidade do seu perfil.' },
};

const UNAVAILABLE = { title: 'Em breve', message: '"Perto de mim" chega numa próxima etapa.' };

/** Feed principal (design 1a). */
export default function FeedScreen() {
  const visibility = useListVisibility();
  const [tab, setTab] = useState<FeedTab>('para-voce');
  const { joinedComunaIds, followedUserIds } = useInteractions();
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
  const feed = useCachedPages({ queryKey: feedKey, load, ...contentPolicy.feed });
  const { refreshError } = feed;
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

  const body = <PopulariaList
    // Cada aba é uma lista própria: trocar de aba recomeça do topo, em vez de herdar a rolagem.
    key={tab}
    state={feed}
    extraData={visibility.visibleIds}
    onViewableItemsChanged={visibility.onViewableItemsChanged}
    viewabilityConfig={mediaViewabilityConfig}
    data={feed.items}
    keyExtractor={(item) => item.id}
    renderItem={({ item, index }) => {
      const previous = index > 0 ? feed.items[index - 1] : null;
      const newDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
      return <>
        {newDay ? <DayRule label={formatDayRule(item.createdAt)} /> : <View style={styles.separator} />}
        <PostCard item={item} mediaVisible={visibility.visibleIds.has(item.id)} showRule={false} />
      </>;
    }}
    getItemType={(item) => `${item.poll ? 'poll' : 'text'}:${item.attachment?.type ?? (item.document ? 'document' : 'plain')}`}
    ListHeaderComponent={<><WelcomeBanner /><HomeProgress /><ComposerPrompt /></>}
    emptyTitle={(isFeedTabAvailable(tab) ? EMPTY_MESSAGES[tab] : UNAVAILABLE).title}
    emptyMessage={(isFeedTabAvailable(tab) ? EMPTY_MESSAGES[tab] : UNAVAILABLE).message}
    contentContainerStyle={styles.list}
  />;

  return (
    <Screen>
      <FeedHeader tab={tab} onTabChange={setTab} />
      <View style={styles.swipeArea} {...panResponder.panHandlers}>{body}</View>
    </Screen>
  );
}

/** Abre o dia no feed como uma regra editorial: "Hoje", "Ontem", "7 nov". */
function DayRule({ label }: { label: string }) {
  return <View style={styles.dayRule} accessibilityRole="header">
    <AppText variant="label">{label}</AppText>
    <View style={styles.dayRuleLine} />
  </View>;
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: Spacing.seven,
  },
  swipeArea: {
    flex: 1,
  },
  dayRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.one,
  },
  dayRuleLine: { flex: 1, height: 1, backgroundColor: Colors.inkSoft },
  separator: { height: 1, backgroundColor: Colors.rule },
});
