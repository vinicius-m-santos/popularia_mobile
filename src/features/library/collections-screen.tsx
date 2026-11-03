import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { goBack } from '@/lib/routes';
import { listCollections } from './api';
import { CollectionCard } from './collection-card';
import { CollectionEditor } from './collection-editor';
import type { LibraryCollection, LibraryScope } from './types';

/** Lista vertical de coleções; a faixa da Biblioteca manda para cá em “Ver mais”. */
export default function CollectionsScreen() {
  const params = useLocalSearchParams<{ scope?: string }>();
  const scope: LibraryScope = params.scope === 'personal' || params.scope === 'comuna' ? params.scope : 'public';
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [editor, setEditor] = useState(false);
  const load = useCallback((cursor: string | null) => listCollections({ scope }, cursor), [scope]);
  const collections = usePaginatedData(load);
  const filtered = term
    ? collections.items.filter((item) => `${item.name} ${item.origin.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))
    : collections.items;
  const open = (item: LibraryCollection) => router.push({ pathname: '/biblioteca', params: { scope, collection: item.id } });

  return <Screen>
    <EditorialHeader
      title="Coleções"
      subtitle="Leituras organizadas pela comunidade."
      onBack={goBack}
      actions={[{ icon: 'plus', label: 'Criar coleção', onPress: () => setEditor(true) }]}
    />
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshing={collections.isRefreshing}
      onRefresh={collections.refresh}
      onEndReached={collections.loadMoreError ? undefined : collections.loadMore}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.search}>
          <Icon name="search" size={20} />
          <TextInput
            value={query}
            onChangeText={(value) => { setQuery(value); setTerm(value.trim()); }}
            placeholder="Buscar coleção. Ex.: leituras"
            placeholderTextColor={Colors.muted}
            accessibilityLabel="Buscar coleção"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          {query ? <IconButton icon="close" size={16} accessibilityLabel="Limpar busca" onPress={() => { setQuery(''); setTerm(''); }} /> : null}
        </View>
        {term ? <AppText variant="caption">{filtered.length} {filtered.length === 1 ? 'coleção encontrada' : 'coleções encontradas'}</AppText> : null}
      </View>}
      renderItem={({ item }) => <View style={styles.row}><CollectionCard item={item} onPress={() => open(item)} /></View>}
      ListEmptyComponent={collections.status === 'loading'
        ? <StateView kind="loading" message="Carregando coleções" />
        : collections.status === 'error'
          ? <StateView kind="error" message="Não conseguimos carregar as coleções." onRetry={collections.refresh} />
          : <StateView kind="empty" title={term ? 'Nenhuma coleção encontrada' : 'Nenhuma coleção ainda'} message={term ? 'Tente outra palavra.' : 'Organize leituras em uma coleção. A primeira pode ser sua.'} />}
      ListFooterComponent={collections.loadMoreError
        ? <StateView kind="error" message="Não conseguimos carregar mais coleções." onRetry={collections.loadMore} />
        : collections.hasMore
          ? <EditorialAction label={collections.loadingMore ? 'Carregando…' : 'Mais coleções'} icon="chevronDown" labelVariant="button" disabled={collections.loadingMore} onPress={collections.loadMore} style={styles.more} />
          : undefined}
    />
    <CollectionEditor visible={editor} onClose={() => setEditor(false)} onDone={() => { setEditor(false); collections.refresh(); }} />
  </Screen>;
}

const styles = StyleSheet.create({
  list: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.five, paddingBottom: Spacing.seven, gap: Spacing.three },
  header: { paddingTop: Spacing.four, gap: Spacing.two },
  search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, paddingHorizontal: Spacing.four },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 0, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22, color: Colors.ink, outlineWidth: 0 },
  row: { width: '100%' },
  more: { alignSelf: 'center', minHeight: 52, borderRadius: Radius.sm, marginTop: Spacing.two },
});
