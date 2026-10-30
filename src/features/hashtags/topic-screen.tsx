import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
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
import { contentPolicy, queryClient } from '@/lib/query/client';
import { goBack } from '@/lib/routes';

export function TopicScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const valid = validDestination({ kind: 'hashtag', id: slug });
  const info = useQuery({ queryKey: ['topic', slug], queryFn: ({ signal }) => getTopicInfo(slug, signal), enabled: valid, ...contentPolicy.profile }, queryClient);
  const load = useCallback((cursor: string | null, signal: AbortSignal) => listTopicPosts(slug, cursor, signal), [slug]);
  const page = useCachedPages({ queryKey: ['topic-posts', slug], load, enabled: valid, ...contentPolicy.feed });
  if (!valid) return <View style={styles.screen}><StateView kind="empty" title="Tópico indisponível" message="Este link não corresponde a um tópico." /></View>;
  return <View style={styles.screen}>
    <PopulariaList
      data={page.items}
      state={page}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      emptyTitle="Sem publicações visíveis"
      emptyMessage="Ainda não há publicações deste tópico que você possa ver."
      ListHeaderComponent={<View>
        <View style={styles.chrome}>
          <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
          <View style={styles.divider} />
          <AppText variant="label" style={styles.chromeTitle}>Tópico</AppText>
          {!DEMO_MODE && valid ? <IconButton icon="share" accessibilityLabel="Compartilhar tópico" onPress={() => { void shareDestination({ kind: 'hashtag', id: slug }); }} /> : <View style={styles.spacer} />}
        </View>
        <View style={styles.heading}>
          <AppText style={styles.name}>#{info.data?.displayName ?? slug}</AppText>
          <AppText style={styles.intro}>Publicações sobre este assunto</AppText>
        </View>
      </View>}
      renderItem={({ item, index }) => <PostCard item={item} showRule={index > 0} />}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.cream },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1, paddingBottom: Spacing.seven },
  chrome: { minHeight: 58, paddingHorizontal: Spacing.one, flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1.5, height: 28, backgroundColor: Colors.ink, marginHorizontal: Spacing.two },
  chromeTitle: { flex: 1 },
  spacer: { width: 44 },
  heading: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.four, borderBottomWidth: 1.5, borderBottomColor: Colors.ink },
  name: { fontFamily: Fonts.condensed, fontSize: 38, lineHeight: 48, color: Colors.ink },
  intro: { color: Colors.muted, marginTop: Spacing.one },
});
