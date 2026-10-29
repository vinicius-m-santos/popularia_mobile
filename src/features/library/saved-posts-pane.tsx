import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PopulariaList } from '@/components/list/popularia-list';
import { UnderlineTabs } from '@/components/underline-tabs';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { listSavedPosts } from '@/features/posts/api';
import { PostCard } from '@/features/posts/components/post-card';
import { SAVED_POSTS_QUERY_KEY } from '@/features/posts/save';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { contentPolicy } from '@/lib/query/client';

export type LibrarySection = 'salvos' | 'documentos';

const SECTIONS = [{ key: 'salvos' as const, label: 'Salvos' }, { key: 'documentos' as const, label: 'Documentos' }];

export function LibrarySectionTabs({ value, onChange }: { value: LibrarySection; onChange: (value: LibrarySection) => void }) {
  return <View style={styles.tabs}><UnderlineTabs options={SECTIONS} value={value} onChange={onChange} /></View>;
}

export function useSavedPosts() {
  const load = useCallback((cursor: string | null, signal: AbortSignal) => listSavedPosts(cursor, signal), []);
  return useCachedPages({ queryKey: SAVED_POSTS_QUERY_KEY, load, ...contentPolicy.profile });
}

/** Publicações guardadas. O documento original continua na outra seção da Biblioteca. */
export function SavedPostsPane({ header, onShowDocuments }: { header?: ReactNode; onShowDocuments: () => void }) {
  const list = useSavedPosts();
  return <PopulariaList
    style={styles.list}
    contentContainerStyle={styles.content}
    state={list}
    data={list.items}
    keyExtractor={(item) => item.id}
    emptyTitle="Nada salvo ainda"
    emptyMessage="Salve publicações que você quer encontrar novamente."
    ListHeaderComponent={<View>
      {header}
      <LibrarySectionTabs value="salvos" onChange={(next) => { if (next === 'documentos') onShowDocuments(); }} />
      <AppText variant="caption" style={styles.intro}>Publicações que você guardou para consultar depois. O acesso continua o de sempre.</AppText>
    </View>}
    renderItem={({ item, index }) => <PostCard item={item} showRule={index > 0} />}
  />;
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.seven, flexGrow: 1 },
  tabs: { paddingHorizontal: Spacing.five, paddingTop: Spacing.four },
  intro: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.three, color: Colors.muted },
});
