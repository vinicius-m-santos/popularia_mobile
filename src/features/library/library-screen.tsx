import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, FlatList, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { ChipRow } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { goBack } from '@/lib/routes';
import type { TopicId } from '@/types/models';
import { getCollection, listCollections, listDocuments, saveDocument } from './api';
import { CollectionEditor } from './collection-editor';
import { DocumentCard } from './document-card';
import type { LibraryCollection, LibraryDocument, LibraryScope } from './types';

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ scope?: string; owner?: string; comuna?: string; collection?: string; add?: string; q?: string; topic?: TopicId }>();
  const scope: LibraryScope = ['personal', 'comuna', 'saved'].includes(params.scope ?? '') ? params.scope as LibraryScope : 'public';
  const me = useMe();
  const loader = useCallback(() => params.collection ? getCollection(params.collection) : Promise.resolve(null), [params.collection]);
  const collection = useAsyncData(loader);
  const [editingCollection, setEditingCollection] = useState(false);
  if (params.collection && !collection.data) return <Screen><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><StateView kind={collection.status === 'error' ? 'error' : 'loading'} message="Não foi possível carregar esta coleção." {...(collection.status === 'error' ? { onRetry: collection.reload } : {})} /></Screen>;
  const canAdd = params.collection ? collection.data?.canAdd : scope === 'personal' ? !params.owner || params.owner === me.id : params.add === '1';
  return <Screen>
    <View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><AppText variant="label">{collection.data ? 'Coleção' : 'Biblioteca'}</AppText></View>
    <LibraryPane initialQuery={params.q} initialTopic={params.topic} scope={scope} owner={params.owner} comuna={params.comuna} collection={params.collection} canAdd={canAdd}
      title={collection.data?.name} header={collection.data ? <View style={styles.header}><AppText>{collection.data.description}</AppText>{collection.data.canManage ? <PillButton label="Editar coleção" variant="outline" onPress={() => setEditingCollection(true)} /> : null}</View> : null} />
    {collection.data ? <CollectionEditor key={`${collection.data.id}-${editingCollection}`} visible={editingCollection} initial={collection.data} onClose={() => setEditingCollection(false)} onDone={(value) => { if (value) collection.reload(); else goBack(); }} /> : null}
  </Screen>;
}

export function LibraryPane({ scope, owner, comuna, collection, canAdd = false, title, header, onSelect, initialQuery, initialTopic }: {
  scope: LibraryScope; initialQuery?: string; initialTopic?: TopicId; owner?: string; comuna?: string; collection?: string; canAdd?: boolean; title?: string; header?: ReactNode; onSelect?: (document: LibraryDocument) => void;
}) {
  const me = useMe();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [term, setTerm] = useState(initialQuery ?? '');
  const [topic, setTopic] = useState<TopicId | null>(initialTopic ?? null);
  const [origin, setOrigin] = useState<'all' | 'people' | 'comunas'>('all');
  const [order, setOrder] = useState<'recent' | 'relevance' | null>(null);
  const sort = order ?? (term ? 'relevance' : 'recent');
  const [newCollection, setNewCollection] = useState(false);
  const [removedSaves, setRemovedSaves] = useState<string[]>([]);
  const [saveError, setSaveError] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const load = useCallback((cursor: string | null) => listDocuments({ scope, owner, comuna, collection, q: term, topic: topic ?? undefined, origin, sort }, cursor), [scope, owner, comuna, collection, term, topic, origin, sort]);
  const loadCollections = useCallback((cursor: string | null) => scope === 'saved' || !!collection ? Promise.resolve({ items: [] as LibraryCollection[], nextCursor: null }) : listCollections({ scope, owner, comuna }, cursor), [scope, owner, comuna, collection]);
  const documents = usePaginatedData(load);
  const collections = usePaginatedData(loadCollections);
  const refreshDocuments = documents.refresh;
  const refreshCollections = collections.refresh;
  const refresh = useCallback(() => { refreshDocuments(); refreshCollections(); }, [refreshDocuments, refreshCollections]);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useFocusEffect(useCallback(() => { refreshRef.current(); }, []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refreshRef.current(); });
    return () => sub.remove();
  }, []);
  const own = scope === 'personal' && (!owner || owner === me.id);
  const filtered = !!term || topic !== null || origin !== 'all';
  const emptyTitle = filtered ? 'Nenhum resultado' : own ? 'Sua biblioteca está vazia' : 'Nada disponível para você';
  const emptyMessage = filtered ? `Nenhum documento ${scope === 'public' ? 'público ' : ''}neste filtro. Tente outra palavra ou assunto.` : own ? 'Guarde cartilhas, atas e estudos em PDF. Cada um fica numa coleção e você decide quem pode abrir.' : scope === 'comuna' && canAdd ? 'Ninguém adicionou documentos aqui ainda. Que tal o primeiro?' : 'Nenhum documento disponível para você.';
  const add = () => router.push({ pathname: '/biblioteca/enviar', params: { ...(comuna ? { comuna } : {}), ...(collection ? { collection } : {}) } });
  return <>
    <FlatList style={styles.flex} contentContainerStyle={styles.content} data={documents.items.filter((item) => !removedSaves.includes(item.id))} keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled" refreshing={documents.isRefreshing} onRefresh={refresh} onEndReached={() => documents.loadMore()} onEndReachedThreshold={0.4}
      ListHeaderComponent={<>
        {header}
        <View style={styles.header}>
          <AppText variant="display" accessibilityRole="header">{title ?? (scope === 'public' ? 'Biblioteca pública' : own ? 'Minha biblioteca' : scope === 'saved' ? 'Documentos salvos' : 'Biblioteca')}</AppText>
          <AppText variant="caption">{scope === 'public' ? 'Só aparecem aqui PDFs que pessoas e comunas escolheram abrir para qualquer pessoa.' : scope === 'saved' ? 'Salvar é guardar uma referência. O acesso pode mudar.' : 'O original fica na biblioteca de origem. Cada lugar tem alcance próprio.'}</AppText>
          {canAdd ? <View style={styles.actions}><PillButton label="Adicionar PDF" onPress={add} /><PillButton label="Criar coleção" variant="outline" onPress={() => setNewCollection(true)} /></View> : null}
          {own && !onSelect ? <PillButton label="Documentos salvos" variant="outline" onPress={() => router.push({ pathname: '/biblioteca', params: { scope: 'saved' } })} /> : null}
          {scope !== 'saved' ? <><TextField label="Buscar na biblioteca" placeholder="Título, coleção, responsável ou assunto" value={query} onChangeText={setQuery} maxLength={100} autoCorrect={false} />
            <SingleTopicField value={topic} onChange={setTopic} optional /></> : null}
        </View>
        {scope === 'public' ? <ChipRow options={[{ key: 'all', label: 'Tudo' }, { key: 'people', label: 'De pessoas' }, { key: 'comunas', label: 'De comunas' }]} value={origin} onChange={setOrigin} accessibilityLabel="Origem dos documentos" /> : null}
        {!collection && scope !== 'saved' ? <View style={styles.header}>
          <SectionHeading label={scope === 'public' ? 'Coleções com documentos públicos' : 'Coleções'} />
          {collections.status === 'loading' ? <StateView kind="loading" message="Carregando coleções" /> : null}
          {collections.status === 'error' || collections.refreshError ? <StateView kind="error" message="Não conseguimos carregar as coleções." onRetry={collections.refresh} /> : null}
          {collections.items.map((item) => <View key={item.id} style={styles.collection}>
            <AppText variant="bodyStrong">{item.name}</AppText><AppText variant="caption">{item.description}</AppText>
            <AppText variant="caption">{item.documentCount} PDFs · {item.origin.name}</AppText>
            <PillButton label={`Abrir coleção ${item.name}`} variant="outline" onPress={() => router.push({ pathname: '/biblioteca', params: { scope, owner, comuna, collection: item.id } })} />
          </View>)}
          {collections.hasMore ? <PillButton label={collections.loadingMore ? 'Carregando…' : 'Mais coleções'} disabled={collections.loadingMore} onPress={collections.loadMore} variant="outline" /> : null}
          {collections.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais coleções." onRetry={collections.loadMore} /> : null}
        </View> : null}
        <View style={styles.header}><SectionHeading label={scope === 'public' ? 'Documentos públicos' : 'Documentos'} /><AppText variant="caption">{sort === 'relevance' ? 'Relevância' : 'Mais recentes'}</AppText></View>
        {term ? <ChipRow options={[{ key: 'relevance', label: 'Relevância' }, { key: 'recent', label: 'Mais recentes' }]} value={sort} onChange={setOrder} accessibilityLabel="Ordenar documentos" /> : null}
        {saveError ? <AppText>{saveError}</AppText> : null}
        {documents.refreshError ? <StateView kind="error" message="Não conseguimos atualizar os documentos." onRetry={documents.refresh} /> : null}
      </>}
      renderItem={({ item }) => <View style={styles.row}><DocumentCard document={item} shared={scope === 'comuna' && item.origin?.kind === 'personal'} onPress={onSelect && item.state === 'available' ? () => onSelect(item) : scope === 'comuna' ? () => router.push({ pathname: '/biblioteca/documento/[id]', params: { id: item.id, comuna } }) : undefined} />{scope === 'saved' ? <PillButton label="Remover dos salvos" variant="outline" onPress={async () => { try { await saveDocument(item.id, false); setRemovedSaves((ids) => [...ids, item.id]); } catch { setSaveError('Não conseguimos remover dos salvos. Tente novamente.'); } }} /> : null}</View>}
      ListEmptyComponent={documents.status === 'loading' ? <StateView kind="loading" message="Carregando documentos" /> : documents.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar a biblioteca." onRetry={documents.refresh} /> : <StateView kind="empty" title={emptyTitle} message={emptyMessage} />}
      ListFooterComponent={documents.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais documentos." onRetry={documents.loadMore} /> : documents.hasMore ? <PillButton label={documents.loadingMore ? 'Carregando…' : 'Mais documentos'} disabled={documents.loadingMore} onPress={documents.loadMore} variant="outline" /> : undefined} />
    <CollectionEditor key={String(newCollection)} visible={newCollection} onClose={() => setNewCollection(false)} comuna={comuna} onDone={() => collections.refresh()} />
  </>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.seven }, header: { padding: Spacing.five, gap: Spacing.three }, actions: { gap: Spacing.two }, row: { paddingHorizontal: Spacing.five }, collection: { backgroundColor: Colors.paper, borderWidth: 1.5, borderColor: Colors.ink, padding: Spacing.four, borderRadius: 12, gap: Spacing.two } });
