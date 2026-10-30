import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LibraryDocument } from './types';

export const accessLabel = (document: LibraryDocument) => document.isPublic ? 'Público' : ({ private: 'Só você', followers: 'Seguidores', visitors: 'Aberto na comuna', members: 'Só membros', moderators: 'Só coordenação' }[document.access ?? 'private']);
export const sizeLabel = (bytes: number | null) => bytes === null ? '' : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

export function DocumentCard({ document, onPress, shared = false, appearance = 'default', hideCollection = false }: { document: LibraryDocument; onPress?: () => void; shared?: boolean; appearance?: 'default' | 'editorial' | 'collection' | 'public'; hideCollection?: boolean }) {
  const locked = document.state !== 'available';
  const handlePress = onPress ?? (() => router.push({ pathname: '/biblioteca/documento/[id]', params: { id: document.id } }));
  // Variante restrita ao acervo público enquanto a direção visual é validada.
  if (appearance === 'public') return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${document.title ?? 'Documento indisponível'}, ${locked ? 'acesso restrito' : 'PDF'}`}
    onPress={handlePress}
    style={({ pressed }) => [styles.publicCard, pressed && styles.publicPressed]}>
    <View style={styles.publicCardHeading}>
      <View style={styles.publicDocumentMark}><Icon name="library" size={20} color={Colors.red} /></View>
      <AppText variant="bodyStrong" style={styles.publicTitle} numberOfLines={3}>{document.title ?? 'Documento indisponível'}</AppText>
      <Icon name="chevronRight" size={18} color={Colors.muted} />
    </View>
    {!locked ? <View style={styles.publicMetadata}>
      {document.author ? <AppText variant="caption" numberOfLines={2}>Autoria: {document.author}</AppText> : null}
      {document.origin?.name ? <AppText variant="caption" numberOfLines={2}>{document.origin.name}{!hideCollection && document.collection ? ` · ${document.collection.name}` : ''}</AppText> : !hideCollection && document.collection ? <AppText variant="caption">{document.collection.name}</AppText> : null}
      <AppText variant="caption" style={styles.publicFileMeta}>{['PDF', document.pageCount ? `${document.pageCount} págs` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
    </View> : <View style={styles.publicMetadata}>
      <AppText variant="label">Acesso restrito</AppText>
      <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>
    </View>}
  </Pressable>;
  if (appearance === 'collection') return <Pressable accessibilityRole="button" accessibilityLabel={`${document.title ?? 'Documento indisponível'}${locked ? ', acesso restrito' : ', PDF'}`}
    onPress={handlePress} style={({ pressed }) => [styles.collectionCard, locked && styles.collectionLocked, pressed && styles.pressed]}>
    <View style={[styles.collectionCover, locked && styles.lockedCover]}>
      <AppText variant="label" color={Colors.paper}>PDF</AppText>
      <View style={styles.collectionCoverMark}><Icon name="library" size={31} color={Colors.paper} /></View>
      <View style={styles.collectionCoverPlanet} />
    </View>
    <View style={styles.collectionCardBody}>
      <View style={styles.top}>
        <AppText variant="label" color={locked ? Colors.ink : Colors.red}>{locked ? 'PDF · acesso restrito' : 'PDF'}</AppText>
        <View style={[styles.accessTag, locked && styles.lockedTag]}><AppText variant="label" color={Colors.paper}>{locked ? 'Sem acesso' : accessLabel(document)}</AppText></View>
      </View>
      <AppText variant="bodyStrong" style={styles.collectionDocumentTitle} numberOfLines={3} ellipsizeMode="tail">{document.title ?? 'Poxa, não achamos este documento'}</AppText>
      {!locked ? <>
        {document.author ? <AppText style={styles.collectionMetadata} numberOfLines={1}>{document.author}</AppText> : null}
        <AppText style={styles.collectionMetadata}>{[document.pageCount ? `${document.pageCount} páginas` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
        {document.createdAt ? <AppText style={styles.collectionMetadata}>Adicionado em {new Date(document.createdAt).toLocaleDateString('pt-BR')}</AppText> : null}
      </> : <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>}
    </View>
    <View style={styles.collectionCardChevron}><Icon name="chevronRight" size={21} /></View>
  </Pressable>;
  if (appearance === 'editorial') return <Pressable accessibilityRole="button" accessibilityLabel={`${document.title ?? 'Documento indisponível'}${locked ? ', acesso restrito' : ', PDF'}`}
    onPress={handlePress} style={({ pressed }) => [styles.editorialCard, locked && styles.editorialLocked, pressed && styles.pressed]}>
    <View style={[styles.editorialCover, locked && styles.lockedCover]}>
      <AppText variant="label" color={Colors.paper}>PDF</AppText>
      <View style={styles.editorialCoverMark}><Icon name="library" size={31} color={Colors.paper} /></View>
      <View style={styles.editorialCoverPlanet} />
    </View>
    <View style={styles.editorialBody}>
      <View style={styles.top}>
        <AppText variant="label" color={locked ? Colors.ink : Colors.red}>{locked ? 'PDF · acesso restrito' : 'PDF'}</AppText>
        <View style={[styles.accessTag, locked && styles.lockedTag]}><AppText variant="label" color={Colors.paper}>{locked ? 'Sem acesso' : accessLabel(document)}</AppText></View>
      </View>
      <AppText variant="bodyStrong" style={styles.editorialTitle} numberOfLines={2} ellipsizeMode="tail">{document.title ?? 'Poxa, não achamos este documento'}</AppText>
      {!locked ? <>
        {!hideCollection && document.collection ? <AppText variant="caption" numberOfLines={1}>{document.collection.name}</AppText> : null}
        {document.author ? <AppText variant="caption" numberOfLines={1}>Autoria: {document.author}</AppText> : null}
        {!hideCollection ? <AppText variant="caption" numberOfLines={1}>{shared ? `Compartilhado por ${document.responsible?.name ?? 'uma pessoa'}` : document.origin?.name}</AppText> : null}
        <AppText variant="caption">{[document.pageCount ? `${document.pageCount} págs` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
      </> : <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>}
    </View>
    <View style={styles.editorialChevron}><Icon name="chevronRight" size={22} /></View>
  </Pressable>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${document.title ?? 'Documento indisponível'}${locked ? ', acesso restrito' : ', PDF'}`}
    onPress={handlePress} style={[styles.card, locked && styles.locked]}>
    <View style={styles.top}><AppText variant="label" color={locked ? Colors.ink : Colors.red}>{locked ? 'PDF · acesso restrito' : 'PDF'}</AppText>
      <Badge label={locked ? 'Sem acesso' : accessLabel(document)} tone={locked ? 'ink' : 'red'} /></View>
    <AppText variant="bodyStrong" numberOfLines={2} ellipsizeMode="tail">{document.title ?? 'Poxa, não achamos este documento'}</AppText>
    {!locked ? <>
      {document.collection ? <AppText variant="caption">{document.collection.name}</AppText> : null}
      {document.author ? <AppText variant="caption" numberOfLines={1}>Autoria: {document.author}</AppText> : null}
      <AppText variant="caption">{shared ? `Compartilhado por ${document.responsible?.name ?? 'uma pessoa'}` : document.origin?.name}</AppText>
      <AppText variant="caption">{[document.pageCount ? `${document.pageCount} págs` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
    </> : <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>}
  </Pressable>;
}
const styles = StyleSheet.create({
  publicCard: { padding: Spacing.four, gap: Spacing.two, borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: Colors.paper },
  publicPressed: { backgroundColor: Colors.strawLight },
  publicCardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  publicDocumentMark: { paddingTop: 2 },
  publicTitle: { flex: 1, minWidth: 0, fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 22 },
  publicMetadata: { gap: Spacing.one, paddingLeft: 28 },
  publicFileMeta: { marginTop: Spacing.one },
  card: { borderWidth: 1.5, borderLeftWidth: 5, borderColor: Colors.red, backgroundColor: Colors.paper, borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.one, marginVertical: Spacing.one },
  locked: { borderColor: Colors.ink },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  editorialCard: { minHeight: 142, flexDirection: 'row', borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.paper },
  editorialLocked: { opacity: 0.86 },
  editorialCover: { position: 'relative', width: 74, overflow: 'hidden', backgroundColor: Colors.ink, padding: Spacing.three, borderRightWidth: 1.5, borderRightColor: Colors.ink },
  editorialCoverMark: { position: 'absolute', top: 56, left: 0, right: 0, alignItems: 'center' },
  editorialCoverPlanet: { position: 'absolute', width: 82, height: 82, left: -31, bottom: -30, borderRadius: 999, backgroundColor: Colors.red },
  lockedCover: { backgroundColor: Colors.ink },
  editorialBody: { flex: 1, minWidth: 0, paddingVertical: Spacing.three, paddingLeft: Spacing.four, paddingRight: Spacing.two, gap: 2 },
  editorialTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 20 },
  accessTag: { backgroundColor: Colors.red, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  lockedTag: { backgroundColor: Colors.ink },
  editorialChevron: { width: 34, alignItems: 'center', justifyContent: 'center' },
  collectionCard: { minHeight: 166, flexDirection: 'row', alignItems: 'stretch', borderWidth: 1.5, borderColor: Colors.red, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.paper },
  collectionLocked: { borderColor: Colors.ink, opacity: 0.86 },
  collectionCover: { position: 'relative', width: 92, margin: Spacing.three, marginRight: 0, overflow: 'hidden', backgroundColor: Colors.ink, padding: Spacing.three },
  collectionCoverMark: { position: 'absolute', top: 45, left: 0, right: 0, alignItems: 'center' },
  collectionCoverPlanet: { position: 'absolute', width: 92, height: 92, left: -35, bottom: -35, borderRadius: 999, backgroundColor: Colors.red },
  collectionCardBody: { flex: 1, minWidth: 0, justifyContent: 'center', paddingVertical: Spacing.three, paddingLeft: Spacing.four, paddingRight: Spacing.two, gap: Spacing.one },
  collectionDocumentTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 20 },
  collectionMetadata: { fontSize: 13.5, lineHeight: 18, color: Colors.muted },
  collectionCardChevron: { width: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});
