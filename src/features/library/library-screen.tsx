import { AppText } from '@/components/app-text';
import { BottomSheet, InsideBottomSheet, PopulariaBottomSheetFlatList, PopulariaBottomSheetTextInput } from '@/components/bottom-sheet';
import { ChipRow } from '@/components/chip';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import { useAsyncData } from '@/hooks/use-async-data';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { goBack } from '@/lib/routes';
import type { TopicId } from '@/types/models';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, FlatList, Image, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { getCollection, listCollections, listDocuments, saveDocument } from './api';
import { LibrarySectionTabs, SavedPostsPane, type LibrarySection } from './saved-posts-pane';
import { CollectionEditor } from './collection-editor';
import { DocumentCard } from './document-card';
import type { LibraryCollection, LibraryDocument, LibraryScope } from './types';

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ scope?: string; owner?: string; comuna?: string; collection?: string; add?: string; q?: string; topic?: TopicId; section?: string }>();
  const scope: LibraryScope = ['personal', 'comuna', 'saved'].includes(params.scope ?? '') ? params.scope as LibraryScope : 'public';
  const section: LibrarySection = params.section === 'salvos' ? 'salvos' : 'documentos';
  const me = useMe();
  const loader = useCallback(() => params.collection ? getCollection(params.collection) : Promise.resolve(null), [params.collection]);
  const collection = useAsyncData(loader);
  const [editingCollection, setEditingCollection] = useState(false);
  if (params.collection && !collection.data) return <Screen><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><StateView kind={collection.status === 'error' ? 'error' : 'loading'} message="Não foi possível carregar esta coleção." {...(collection.status === 'error' ? { onRetry: collection.reload } : {})} /></Screen>;
  const canAdd = params.collection ? collection.data?.canAdd : scope === 'public' ? true : scope === 'personal' ? !params.owner || params.owner === me.id : params.add === '1';
  const editorialRoot = scope === 'public' && !params.collection;
  const collectionPage = !!collection.data;
  return <Screen>
    <View style={[styles.bar, (editorialRoot || collectionPage) && styles.editorialBar]}><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />{editorialRoot || collectionPage ? <View style={styles.barDivider} /> : null}<AppText variant="label" style={[(editorialRoot || collectionPage) && styles.barLabel, collectionPage && styles.collectionBarTitle]}>{collectionPage ? 'Coleção' : 'Biblioteca'}</AppText>{collectionPage && collection.data?.canManage ? <IconButton icon="more" accessibilityLabel="Mais opções da coleção" onPress={() => setEditingCollection(true)} /> : collectionPage ? <View style={styles.barSpacer} /> : null}</View>
    <LibraryPane key={`${scope}-${section}`} initialSection={section} initialQuery={params.q} initialTopic={params.topic} scope={scope} owner={params.owner} comuna={params.comuna} collection={params.collection} canAdd={canAdd}
      collectionData={collection.data ?? undefined} onEditCollection={() => setEditingCollection(true)} />
    {collection.data ? <CollectionEditor key={`${collection.data.id}-${editingCollection}`} visible={editingCollection} initial={collection.data} onClose={() => setEditingCollection(false)} onDone={(value) => { if (value) collection.reload(); else goBack(); }} /> : null}
  </Screen>;
}

export function LibraryPane({ initialSection, ...props }: {
  scope: LibraryScope; initialSection?: LibrarySection; initialQuery?: string; initialTopic?: TopicId; owner?: string; comuna?: string; collection?: string; canAdd?: boolean; title?: string; header?: ReactNode; collectionData?: LibraryCollection; onEditCollection?: () => void; onSelect?: (document: LibraryDocument) => void; profileContext?: boolean;
}) {
  const me = useMe();
  const own = props.scope === 'personal' && !props.collection && !props.onSelect && (!props.owner || props.owner === me.id);
  const [section, setSection] = useState<LibrarySection>(own && initialSection === 'salvos' ? 'salvos' : 'documentos');
  if (own && section === 'salvos') return <SavedPostsPane header={props.header} onShowDocuments={() => setSection('documentos')} />;
  return <DocumentLibrary {...props} onShowSaved={own ? () => setSection('salvos') : undefined} />;
}

function DocumentLibrary({ scope, owner, comuna, collection, canAdd = false, title, header, collectionData, onEditCollection, onSelect, initialQuery, initialTopic, profileContext = false, onShowSaved }: {
  scope: LibraryScope; initialQuery?: string; initialTopic?: TopicId; owner?: string; comuna?: string; collection?: string; canAdd?: boolean; title?: string; header?: ReactNode; collectionData?: LibraryCollection; onEditCollection?: () => void; onSelect?: (document: LibraryDocument) => void; profileContext?: boolean; onShowSaved?: () => void;
}) {
  const inSheet = useContext(InsideBottomSheet);
  const List = inSheet ? PopulariaBottomSheetFlatList : FlatList;
  const Input = inSheet ? PopulariaBottomSheetTextInput : TextInput;
  const me = useMe();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [term, setTerm] = useState(initialQuery ?? '');
  const [topic, setTopic] = useState<TopicId | null>(initialTopic ?? null);
  const [origin, setOrigin] = useState<'all' | 'people' | 'comunas'>('all');
  const sort = term ? 'relevance' : 'recent';
  const [newCollection, setNewCollection] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
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
  const revalidateDocuments = documents.revalidate;
  const revalidateCollections = collections.revalidate;
  const revalidate = useCallback(() => { revalidateDocuments(); revalidateCollections(); }, [revalidateDocuments, revalidateCollections]);
  const revalidateRef = useRef(revalidate);
  const focusedOnce = useRef(false);
  useEffect(() => { revalidateRef.current = revalidate; }, [revalidate]);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) revalidateRef.current();
    focusedOnce.current = true;
  }, []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') revalidateRef.current(); });
    return () => sub.remove();
  }, []);
  const pullRefresh = useManualRefresh(
    documents.status === 'loading' || documents.isRefreshing || collections.status === 'loading' || collections.isRefreshing,
    refresh,
  );
  const own = scope === 'personal' && (!owner || owner === me.id);
  const editorial = scope === 'public' && !collection && !profileContext && !onSelect;
  const editorialCollection = !!collection && !!collectionData && !profileContext && !onSelect;
  const editorialTitleSize = Math.min(50, Math.max(42, Math.round(width * 0.12)));
  const editorialIllustrationHeight = Math.min(230, Math.max(190, Math.round(width * 0.45)));
  const filtered = !!term || topic !== null || origin !== 'all';
  const emptyTitle = filtered ? 'Nenhum resultado' : own ? 'Sua biblioteca está vazia' : 'Poxa, não achamos nada por aqui';
  const emptyMessage = filtered ? `Nenhum documento ${scope === 'public' ? 'público ' : ''}neste filtro. Tente outra palavra ou assunto.` : own ? 'Guarde cartilhas, atas e estudos em PDF. Cada um fica numa coleção e você decide quem pode abrir.' : scope === 'comuna' && canAdd ? 'Ninguém adicionou documentos aqui ainda. Que tal o primeiro?' : 'Nenhum documento disponível por aqui ainda.';
  const isEmptyLibrary = !editorial && !editorialCollection && documents.status === 'success' && documents.items.length === 0 && !documents.hasMore && !filtered;
  const add = () => router.push({ pathname: '/biblioteca/enviar', params: { ...(comuna ? { comuna } : {}), ...(collection ? { collection } : {}) } });
  const sectionTabs = onShowSaved ? <LibrarySectionTabs value="documentos" onChange={(next) => { if (next === 'salvos') onShowSaved(); }} /> : null;
  return <>
    <List style={styles.flex} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content} data={documents.items.filter((item) => !removedSaves.includes(item.id))} keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled" refreshing={pullRefresh.refreshing} onRefresh={pullRefresh.onRefresh} onEndReached={documents.loadMoreError ? undefined : documents.loadMore} onEndReachedThreshold={0.4}
      ListHeaderComponent={<>
        {isEmptyLibrary ? <View style={styles.emptyLibrary}>
          {header}
          {sectionTabs}
          <StateView kind="empty" title="Poxa, não achamos nada por aqui" message={canAdd ? 'Esta biblioteca ainda está esperando o primeiro documento.' : 'Nenhum documento disponível por aqui ainda.'} />
          {canAdd ? <PillButton label="Adicionar um documento" onPress={add} /> : null}
        </View> : <>
        {header}
        {sectionTabs}
        {editorialCollection ? <View style={styles.collectionHero}>
          <View style={styles.collectionIdentity}>
            <View style={styles.collectionMonogram}><AppText variant="heading" style={styles.collectionMonogramText}>{collectionMonogram(collectionData.name)}</AppText></View>
            <View style={styles.collectionIdentityCopy}>
              <AppText variant="display" accessibilityRole="header" style={styles.collectionPageTitle}>{collectionData.name}</AppText>
              <AppText style={styles.collectionOrigin} numberOfLines={2}>{collectionData.origin.name}</AppText>
              <View style={styles.collectionMeta}><AppText>{collectionData.documentCount} {collectionData.documentCount === 1 ? 'documento' : 'documentos'}</AppText><View style={styles.metaDot} /><View style={styles.collectionScopeBadge}><AppText variant="label" color={Colors.paper}>{scope === 'public' ? 'Público' : scope === 'comuna' ? 'Comuna' : 'Pessoal'}</AppText></View></View>
            </View>
          </View>
          <AppText style={styles.collectionDescription}>{collectionData.description || (scope === 'public' ? 'PDFs compartilhados para qualquer pessoa.' : 'Documentos organizados nesta coleção.')}</AppText>
          {(canAdd || collectionData.canManage) ? <View style={styles.collectionActions}>
            {canAdd ? <EditorialAction label="Adicionar PDF" icon="plus" tone="red" onPress={add} style={styles.collectionAddAction} /> : null}
            {collectionData.canManage && onEditCollection ? <EditorialAction label="Editar coleção" icon="edit" onPress={onEditCollection} style={styles.collectionEditAction} /> : null}
          </View> : null}
          <View style={styles.searchBox}>
            <Icon name="search" size={22} />
            <Input accessibilityLabel="Buscar nesta coleção" placeholder="Buscar nesta coleção" placeholderTextColor={Colors.placeholder} value={query} onChangeText={setQuery} maxLength={100} autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
          </View>
          <SingleTopicField value={topic} onChange={setTopic} optional appearance="editorial" />
          <View style={styles.collectionResults}><AppText variant="label">Documentos</AppText><AppText variant="caption">{collectionData.documentCount} {collectionData.documentCount === 1 ? 'documento' : 'documentos'}{term ? ' · por relevância' : ' · mais recentes'}</AppText></View>
        </View> : editorial ? <View style={styles.editorialHero}>
          <View style={[styles.editorialIntro, { minHeight: editorialIllustrationHeight }]}>
            <View style={styles.editorialCopy}>
              <AppText
                accessibilityRole="header"
                style={[styles.editorialTitle, { fontSize: editorialTitleSize, lineHeight: Math.round(editorialTitleSize * 1.25) }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                {title ?? 'BIBLIOTECA\nPÚBLICA'}
              </AppText>
              <AppText style={styles.editorialSubtitle}>Acervo público da comunidade.</AppText>
            </View>
            <View pointerEvents="none" style={styles.editorialIllustrationWrap}>
              <Image fadeDuration={0}
                source={require('@/assets/library/library-hero-illustration.png')}
                resizeMode="contain"
                style={styles.editorialIllustration}
                accessible={false}
              />
            </View>
          </View>
          <View style={styles.editorialActions}>
            {canAdd ? <EditorialAction label="Adicionar PDF" icon="plus" tone="red" onPress={add} style={styles.addAction} /> : null}
            <EditorialAction label="Criar coleção" icon="folder" onPress={() => setNewCollection(true)} style={styles.createAction} />
          </View>
          <View style={styles.searchBox}>
            <Icon name="search" size={22} />
            <Input accessibilityLabel="Buscar na biblioteca" placeholder="Título, autoria, coleção ou assunto" placeholderTextColor={Colors.placeholder} value={query} onChangeText={setQuery} maxLength={100} autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
          </View>
          <SingleTopicField value={topic} onChange={setTopic} optional appearance="editorial" />
          <EditorialOriginTabs value={origin} onChange={setOrigin} />
        </View> : <View style={styles.header}>
          {!profileContext ? <>
            <AppText variant={scope === 'public' ? 'heading' : 'display'} accessibilityRole="header">{title ?? (scope === 'public' ? 'Biblioteca pública' : own ? 'Minha biblioteca' : scope === 'saved' ? 'Documentos salvos' : 'Biblioteca')}</AppText>
            <AppText variant="caption" numberOfLines={scope === 'public' ? 2 : undefined}>{scope === 'public' ? 'PDFs compartilhados por pessoas e comunas para qualquer pessoa.' : scope === 'saved' ? 'Salvar é guardar uma referência. O acesso pode mudar.' : 'O original fica na biblioteca de origem. Cada lugar tem alcance próprio.'}</AppText>
            {canAdd || (own && !onSelect) ? <View style={styles.actions}>
              {canAdd ? <PillButton label="Adicionar PDF" onPress={add} /> : null}
              {!collection || (own && !onSelect) ? <IconButton icon="more" accessibilityLabel="Mais ações da biblioteca" onPress={() => setActionsVisible(true)} /> : null}
            </View> : null}
          </> : null}
          {scope !== 'saved' ? <><TextField label="Buscar na biblioteca" placeholder="Título, autoria, coleção ou assunto" value={query} onChangeText={setQuery} maxLength={100} autoCorrect={false} />
            <SingleTopicField value={topic} onChange={setTopic} optional /></> : null}
        </View>}
        {scope === 'public' && !editorial && !editorialCollection ? <ChipRow options={[{ key: 'all', label: 'Tudo' }, { key: 'people', label: 'De pessoas' }, { key: 'comunas', label: 'De comunas' }]} value={origin} onChange={setOrigin} accessibilityLabel="Origem dos documentos" /> : null}
        {!profileContext && !collection && scope !== 'saved' ? <View style={styles.header}>
          {editorial ? <EditorialSectionHeading label="Coleções" actionLabel={collections.hasMore ? 'Ver todas' : undefined} onAction={collections.hasMore ? collections.loadMore : undefined} /> : <SectionHeading label={scope === 'public' ? 'Coleções com documentos públicos' : 'Coleções'} />}
          {collections.status === 'loading' ? <StateView kind="loading" message="Carregando coleções" /> : null}
          {collections.status === 'error' || collections.refreshError ? <StateView kind="error" message="Não conseguimos carregar as coleções." onRetry={collections.refresh} /> : null}
          {collections.items.map((item) => editorial ? <EditorialCollectionCard key={item.id} item={item} onPress={() => router.push({ pathname: '/biblioteca', params: { scope, owner, comuna, collection: item.id } })} /> : <View key={item.id} style={styles.collection}>
              <AppText variant="bodyStrong">{item.name}</AppText><AppText variant="caption">{item.description}</AppText>
              <AppText variant="caption">{item.documentCount} PDFs · {item.origin.name}</AppText>
              <PillButton label={`Abrir coleção ${item.name}`} variant="outline" onPress={() => router.push({ pathname: '/biblioteca', params: { scope, owner, comuna, collection: item.id } })} />
            </View>)}
          {scope === 'public' && collections.status === 'success' && collections.items.length === 0 && !collections.hasMore ? <StateView kind="empty" title="Nenhuma coleção pública ainda" message="Bora criar a primeira coleção?" /> : null}
          {collections.hasMore && !editorial ? <PillButton label={collections.loadingMore ? 'Carregando…' : 'Mais coleções'} disabled={collections.loadingMore} onPress={collections.loadMore} variant="outline" /> : null}
          {collections.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais coleções." onRetry={collections.loadMore} /> : null}
        </View> : null}
        {!profileContext && !editorialCollection ? <View style={styles.header}>{editorial ? <EditorialSectionHeading label="Documentos públicos" actionLabel={documents.hasMore ? 'Ver todos' : undefined} onAction={documents.hasMore ? documents.loadMore : undefined} /> : <SectionHeading label={scope === 'public' ? 'Documentos públicos' : 'Documentos'} />}{term && sort === 'relevance' ? <AppText variant="caption">Relevância</AppText> : null}</View> : null}
        {saveError ? <AppText>{saveError}</AppText> : null}
        {documents.refreshError ? <StateView kind="error" message="Não conseguimos atualizar os documentos." onRetry={documents.refresh} /> : null}
        </>}
      </>}
      renderItem={({ item }) => <View style={[styles.row, (editorial || editorialCollection || profileContext) && styles.editorialRow]}><DocumentCard document={item} appearance={onSelect || editorialCollection || editorial || profileContext ? 'editorial' : 'default'} hideCollection={editorialCollection} shared={scope === 'comuna' && item.origin?.kind === 'personal'} onPress={onSelect && item.state === 'available' ? () => onSelect(item) : scope === 'comuna' ? () => router.push({ pathname: '/biblioteca/documento/[id]', params: { id: item.id, comuna } }) : undefined} />{scope === 'saved' ? <PillButton label="Remover dos salvos" variant="outline" onPress={async () => { try { await saveDocument(item.id, false); setRemovedSaves((ids) => [...ids, item.id]); } catch { setSaveError('Não conseguimos remover dos salvos. Tente novamente.'); } }} /> : null}</View>}
      ListEmptyComponent={isEmptyLibrary ? undefined : documents.status === 'loading' ? <StateView kind="loading" message="Carregando documentos" /> : documents.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar a biblioteca." onRetry={documents.refresh} /> : <StateView kind="empty" title={emptyTitle} message={emptyMessage} />}
      ListFooterComponent={documents.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais documentos." onRetry={documents.loadMore} /> : documents.hasMore ? <PillButton label={documents.loadingMore ? 'Carregando…' : 'Mais documentos'} disabled={documents.loadingMore} onPress={documents.loadMore} variant="outline" /> : undefined} />
    <CollectionEditor key={String(newCollection)} visible={newCollection} onClose={() => setNewCollection(false)} comuna={comuna} onDone={() => collections.refresh()} />
    <BottomSheet visible={actionsVisible} onClose={() => setActionsVisible(false)} title="Ações da biblioteca">
      <View style={styles.actionsMenu}>
        {!collection ? <PillButton label="Criar coleção" variant="outline" onPress={() => { setActionsVisible(false); setNewCollection(true); }} /> : null}
        {own && !onSelect ? <PillButton label="Documentos salvos" variant="outline" onPress={() => { setActionsVisible(false); router.push({ pathname: '/biblioteca', params: { scope: 'saved' } }); }} /> : null}
      </View>
    </BottomSheet>
  </>;
}

function collectionMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) ?? 'CO').toUpperCase();
}

function EditorialOriginTabs({ value, onChange }: { value: 'all' | 'people' | 'comunas'; onChange: (value: 'all' | 'people' | 'comunas') => void }) {
  const options = [{ key: 'all', label: 'Tudo' }, { key: 'people', label: 'De pessoas' }, { key: 'comunas', label: 'De comunas' }] as const;
  return <View accessibilityRole="radiogroup" accessibilityLabel="Origem dos documentos" style={styles.originTabs}>
    {options.map((option) => {
      const active = value === option.key;
      return <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => onChange(option.key)} style={({ pressed }) => [styles.originTab, active && styles.originTabActive, pressed && styles.actionPressed]}>
        <AppText variant="label" color={active ? Colors.paper : Colors.ink} numberOfLines={1}>{option.label}</AppText>
      </Pressable>;
    })}
  </View>;
}

function EditorialSectionHeading({ label, actionLabel, onAction }: { label: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeading}>
    <View accessibilityRole="header" style={styles.sectionTitle}><View style={styles.sectionSquare} /><AppText variant="label" style={styles.sectionLabel}>{label}</AppText></View>
    {actionLabel && onAction ? <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${label}`} onPress={onAction} style={({ pressed }) => [styles.sectionAction, pressed && styles.actionPressed]}>
      <AppText variant="label">{actionLabel}</AppText><Icon name="chevronRight" size={16} />
    </Pressable> : null}
  </View>;
}

function EditorialCollectionCard({ item, onPress }: { item: LibraryCollection; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir coleção ${item.name}`} onPress={onPress} style={({ pressed }) => [styles.editorialCollection, pressed && styles.actionPressed]}>
    <View style={styles.collectionIcon}><Icon name="folder" size={32} /></View>
    <View style={styles.collectionBody}>
      <AppText variant="bodyStrong" style={styles.collectionTitle} numberOfLines={1}>{item.name}</AppText>
      <AppText variant="caption" numberOfLines={2}>{item.documentCount} {item.documentCount === 1 ? 'PDF' : 'PDFs'} · {item.origin.name}</AppText>
    </View>
    <View style={styles.collectionChevron}><Icon name="chevronRight" size={21} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  editorialBar: { minHeight: 58, paddingHorizontal: Spacing.one },
  barDivider: { width: 1.5, height: 28, backgroundColor: Colors.ink, marginRight: Spacing.two },
  barLabel: { fontSize: 12.5 },
  collectionBarTitle: { flex: 1 },
  barSpacer: { width: 44 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.seven },
  header: { padding: Spacing.five, gap: Spacing.two },
  emptyLibrary: { minHeight: 300, paddingHorizontal: Spacing.five, paddingBottom: Spacing.six, alignItems: 'stretch' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actionsMenu: { gap: Spacing.two },
  row: { paddingHorizontal: Spacing.five },
  editorialRow: { marginBottom: Spacing.three },
  collection: { backgroundColor: Colors.paper, borderWidth: 1.5, borderColor: Colors.ink, padding: Spacing.four, borderRadius: 12, gap: Spacing.two },
  collectionHero: { paddingHorizontal: Spacing.five, paddingTop: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.four },
  collectionIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.five },
  collectionMonogram: { width: 88, height: 88, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.strawLight },
  collectionMonogramText: { fontSize: 34, lineHeight: 38 },
  collectionIdentityCopy: { flex: 1, minWidth: 0, gap: Spacing.one },
  collectionPageTitle: { fontSize: 34, lineHeight: 38 },
  collectionOrigin: { color: Colors.muted },
  collectionMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.muted },
  collectionScopeBadge: { minHeight: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.red, paddingHorizontal: Spacing.three },
  collectionDescription: { color: Colors.muted },
  collectionActions: { flexDirection: 'row', gap: Spacing.three },
  collectionAddAction: { flex: 1.05 },
  collectionEditAction: { flex: 1 },
  collectionResults: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, borderTopWidth: 1.5, borderTopColor: Colors.ink, paddingTop: Spacing.three },
  editorialHero: { paddingHorizontal: Spacing.five, paddingTop: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.four },
  editorialIntro: { position: 'relative', justifyContent: 'flex-start' },
  editorialCopy: { width: '75%', zIndex: 1, paddingTop: Spacing.one },
  editorialTitle: { fontFamily: Fonts.anton, fontWeight: '400', letterSpacing: -0.8, textTransform: 'uppercase', color: '#0A0A08' },
  editorialSubtitle: { width: '78%', fontFamily: Fonts.mono, fontSize: 16, lineHeight: 23, letterSpacing: 0.3, marginTop: Spacing.three, color: '#0A0A08' },
  editorialIllustrationWrap: { position: 'absolute', top: -10, right: -14, width: '54%', height: '112%' },
  editorialIllustration: { width: '100%', height: '100%' },
  editorialActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  addAction: { flex: 1.12 },
  createAction: { flex: 1 },
  actionPressed: { opacity: 0.68 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper, paddingHorizontal: Spacing.four },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 0, fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 21, color: Colors.ink, outlineWidth: 0 },
  originTabs: { flexDirection: 'row', gap: Spacing.one },
  originTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.ink, paddingHorizontal: Spacing.one },
  originTabActive: { backgroundColor: Colors.ink },
  sectionHeading: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  sectionTitle: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sectionSquare: { width: 10, height: 10, backgroundColor: Colors.red },
  sectionLabel: { fontSize: 12.5 },
  sectionAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  editorialCollection: { minHeight: 76, flexDirection: 'row', borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  collectionIcon: { width: 64, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1.5, borderRightColor: Colors.ink },
  collectionBody: { flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: Spacing.four, gap: 2 },
  collectionTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 21 },
  collectionChevron: { width: 38, alignItems: 'center', justifyContent: 'center' },
});
