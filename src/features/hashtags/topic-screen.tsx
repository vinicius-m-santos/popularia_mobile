import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialBar } from '@/components/editorial-bar';
import { StateView } from '@/components/state-view';
import { IconButton } from '@/components/icon-button';
import { PopulariaList } from '@/components/list/popularia-list';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/constants/config';
import { PostCard } from '@/features/posts/components/post-card';
import { getTopicInfo, listTopicPosts } from '@/features/hashtags/api';
import { validDestination } from '@/features/links/destinations';
import { shareDestination } from '@/features/links/share';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { MediaVisibilityProvider, mediaViewabilityConfig, useListVisibility } from '@/hooks/use-list-visibility';
import { useRouteMediaFocus } from '@/hooks/use-route-media-focus';
import { contentPolicy, queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { goBack } from '@/lib/routes';
import type { FeedItem } from '@/types/models';

export function TopicScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const valid = validDestination({ kind: 'hashtag', id: slug });
  const info = useQuery({ queryKey: queryKeys.topic.info(slug), queryFn: ({ signal }) => getTopicInfo(slug, signal), enabled: valid, ...contentPolicy.topic }, queryClient);
  const load = useCallback((cursor: string | null, signal: AbortSignal) => listTopicPosts(slug, cursor, signal), [slug]);
  const page = useCachedPages({ queryKey: queryKeys.topic.posts(slug), load, enabled: valid, performanceScope: 'topic', ...contentPolicy.feed });
  // Só o cartão na viewport monta o player; o restante continua no pôster.
  const visibility = useListVisibility(slug);
  // Ao abrir uma publicação ou sair do tópico, a lista perde o foco e não toca.
  useRouteMediaFocus(visibility);
  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => (
    <PostCard item={item} showRule={index > 0} />
  ), []);
  if (!valid) return <View style={styles.screen}><StateView kind="empty" title="Tópico indisponível" message="Este link não corresponde a um tópico." /></View>;
  return <View style={styles.screen}>
    <MediaVisibilityProvider visibility={visibility}>
      <PopulariaList
        data={page.items}
        state={page}
        onViewableItemsChanged={visibility.onViewableItemsChanged}
        viewabilityConfig={mediaViewabilityConfig}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        emptyTitle="Sem publicações visíveis"
        emptyMessage="Ainda não há publicações deste tópico que você possa ver."
        ListHeaderComponent={<View>
          <EditorialBar
            onBack={goBack}
            title={<AppText variant="label" style={styles.chromeTitle}>Tópico</AppText>}
            actions={!DEMO_MODE && valid ? <IconButton icon="shareNodes" accessibilityLabel="Compartilhar tópico" onPress={() => { void shareDestination({ kind: 'hashtag', id: slug }); }} /> : undefined}
            reserveActionSpace
            divider
            minHeight={58}
            inset={Spacing.one}
            gap={Spacing.two}
          />
          <View style={styles.heading}>
            <AppText style={styles.name}>#{info.data?.displayName ?? slug}</AppText>
            <AppText style={styles.intro}>Publicações sobre este assunto</AppText>
          </View>
        </View>}
        renderItem={renderItem}
      />
    </MediaVisibilityProvider>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.cream },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1, paddingBottom: Spacing.seven },
  chromeTitle: { fontSize: 12.5 },
  heading: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.four, borderBottomWidth: 1.5, borderBottomColor: Colors.ink },
  name: { fontFamily: Fonts.condensed, fontSize: 38, lineHeight: 48, color: Colors.ink },
  intro: { color: Colors.muted, marginTop: Spacing.one },
});
