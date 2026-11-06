import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PopulariaList } from '@/components/list/popularia-list';
import { UnderlineTabs } from '@/components/underline-tabs';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { listSavedPosts } from '@/features/posts/api';
import { PostCard } from '@/features/posts/components/post-card';
import { SAVED_POSTS_QUERY_KEY } from '@/features/posts/save';
import { ProfileSwipeGuard } from '@/features/profiles/profile-tab-swipe';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { MediaVisibilityProvider, mediaViewabilityConfig, useListVisibility } from '@/hooks/use-list-visibility';
import { useRouteMediaFocus } from '@/hooks/use-route-media-focus';
import { contentPolicy } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

export type LibrarySection = 'salvos' | 'documentos';

const SECTIONS = [{ key: 'salvos' as const, label: 'Salvos' }, { key: 'documentos' as const, label: 'Documentos' }];

export function LibrarySectionTabs({ value, onChange }: { value: LibrarySection; onChange: (value: LibrarySection) => void }) {
  return <View style={styles.tabs}><ProfileSwipeGuard><UnderlineTabs options={SECTIONS} value={value} onChange={onChange} /></ProfileSwipeGuard></View>;
}

export function useSavedPosts() {
  const load = useCallback((cursor: string | null, signal: AbortSignal) => listSavedPosts(cursor, signal), []);
  return useCachedPages({ queryKey: SAVED_POSTS_QUERY_KEY, load, performanceScope: 'saved-posts', ...contentPolicy.profile });
}

/** Publicações guardadas. O documento original continua na outra seção da Biblioteca. */
export function SavedPostsPane({ header, onShowDocuments }: { header?: ReactNode; onShowDocuments: () => void }) {
  const list = useSavedPosts();
  // Só o cartão na viewport monta o player; o restante continua no pôster.
  const visibility = useListVisibility();
  // A biblioteca pode ser uma aba do perfil/comuna ou a rota própria: em todos
  // os casos, sair do foco da rota desliga a mídia da lista.
  useRouteMediaFocus(visibility);
  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => (
    <PostCard item={item} showRule={index > 0} />
  ), []);
  return <MediaVisibilityProvider visibility={visibility}>
    <PopulariaList
      style={styles.list}
      contentContainerStyle={styles.content}
      state={list}
      data={list.items}
      onViewableItemsChanged={visibility.onViewableItemsChanged}
      viewabilityConfig={mediaViewabilityConfig}
      keyExtractor={(item) => item.id}
      emptyTitle="Nada salvo ainda"
      emptyMessage="Salve publicações que você quer encontrar novamente."
      ListHeaderComponent={<View>
        {header}
        <LibrarySectionTabs value="salvos" onChange={(next) => { if (next === 'documentos') onShowDocuments(); }} />
        <AppText variant="caption" style={styles.intro}>Publicações que você guardou para consultar depois. O acesso continua o de sempre.</AppText>
      </View>}
      renderItem={renderItem}
    />
  </MediaVisibilityProvider>;
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.seven, flexGrow: 1 },
  tabs: { paddingHorizontal: Spacing.five, paddingTop: Spacing.four },
  intro: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.three, color: Colors.muted },
});
