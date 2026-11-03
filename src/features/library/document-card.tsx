import { useState } from 'react';
import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { topicGroups } from '@/mocks/topics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { PdfMark } from './pdf-mark';
import { openPdf } from './transfers';
import type { LibraryDocument } from './types';

export const accessLabel = (document: LibraryDocument) => document.isPublic ? 'Público' : ({ private: 'Só você', followers: 'Seguidores', visitors: 'Aberto na comuna', members: 'Só membros', moderators: 'Só coordenação' }[document.access ?? 'private']);
export const sizeLabel = (bytes: number | null) => bytes === null ? '' : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
const topicShort = new Map(topicGroups.flatMap((group) => group.topics).map((topic) => [topic.id, topic.shortLabel]));

export function DocumentCard({ document, onPress, shared = false, appearance = 'default', hideCollection = false }: { document: LibraryDocument; onPress?: () => void; shared?: boolean; appearance?: 'default' | 'editorial' | 'collection' | 'public'; hideCollection?: boolean }) {
  const locked = document.state !== 'available';
  const handlePress = onPress ?? (() => router.push({ pathname: '/biblioteca/documento/[id]', params: { id: document.id } }));
  // Acervo público e descoberta: capa de PDF pequena, título, autoria/origem e filtros.
  if (appearance === 'public') return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${document.title ?? 'Documento indisponível'}, ${locked ? 'acesso restrito' : 'PDF'}`}
    onPress={handlePress}
    style={({ pressed }) => [styles.publicCard, pressed && styles.publicPressed]}>
    <PdfMark locked={locked} />
    <View style={styles.publicBody}>
      <AppText style={styles.publicTitle} numberOfLines={2}>{document.title ?? 'Documento indisponível'}</AppText>
      {locked ? <>
        <AppText variant="label" color={Colors.inkSoft}>Acesso restrito</AppText>
        <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>
      </> : <>
        <AppText variant="caption" numberOfLines={2}>
          {[document.author, document.collection?.name ?? document.origin?.name].filter(Boolean).join(' · ') || 'Documento da comunidade'}
        </AppText>
        <View style={styles.publicFooter}>
          {document.topic ? <View style={styles.topicTag}><AppText style={styles.topicTagText}>{topicShort.get(document.topic) ?? 'Assunto'}</AppText></View> : null}
          <AppText variant="caption" style={styles.publicFileMeta}>{[document.pageCount ? `${document.pageCount} págs` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
        </View>
      </>}
    </View>
  </Pressable>;
  if (appearance === 'collection') return <CollectionCard document={document} locked={locked} handlePress={handlePress} hideCollection={hideCollection} />;
  // No feed o anexo é uma referência: sem capa decorativa, com o formato nos metadados e
  // o acesso só quando não é público. A capa preta repetida roubava largura do título.
  if (appearance === 'editorial') return <Pressable accessibilityRole="button" accessibilityLabel={`${document.title ?? 'Documento indisponível'}${locked ? ', acesso restrito' : ', PDF'}`}
    onPress={handlePress} style={({ pressed }) => [styles.editorialCard, pressed && styles.publicPressed]}>
    <View style={styles.editorialHeading}>
      <View style={styles.editorialMark}><Icon name="document" size={20} color={Colors.red} /></View>
      <AppText variant="bodyStrong" style={styles.editorialTitle} numberOfLines={3}>{document.title ?? 'Poxa, não achamos este documento'}</AppText>
      <Icon name="chevronRight" size={18} color={Colors.muted} />
    </View>
    <View style={styles.editorialMeta}>
      {locked ? <>
        <AppText variant="label">Acesso restrito</AppText>
        <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>
      </> : <>
        {document.author ? <AppText variant="caption" numberOfLines={1}>Autoria: {document.author}</AppText> : null}
        {!hideCollection && document.collection ? <AppText variant="caption" numberOfLines={1}>{document.collection.name}</AppText> : null}
        {!hideCollection && (shared || document.origin?.name) ? <AppText variant="caption" numberOfLines={1}>{shared ? `Compartilhado por ${document.responsible?.name ?? 'uma pessoa'}` : document.origin?.name}</AppText> : null}
        <View style={styles.editorialFooter}>
          <AppText variant="caption">{[`PDF`, document.pageCount ? `${document.pageCount} págs` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
          {document.isPublic ? null : <AppText variant="label" color={Colors.red}>{accessLabel(document)}</AppText>}
        </View>
      </>}
    </View>
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
function CollectionCard({ document, locked, handlePress, hideCollection }: { document: LibraryDocument; locked: boolean; handlePress: () => void; hideCollection: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy || locked) return;
    setBusy(true);
    const controller = new AbortController();
    try { await openPdf(document.id, controller.signal); }
    catch { toast.show('Não foi possível baixar este PDF.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.collectionCard}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${document.title ?? 'Documento indisponível'}${locked ? ', acesso restrito' : ', PDF'}`}
      onPress={handlePress} style={({ pressed }) => [styles.collectionCardMain, pressed && styles.publicPressed]}>
      <PdfMark locked={locked} />
      <View style={styles.collectionBody}>
        <AppText style={styles.collectionDocumentTitle} numberOfLines={2}>{document.title ?? 'Documento indisponível'}</AppText>
        {!locked ? <>
          {document.author ? <AppText variant="caption" numberOfLines={1}>{document.author}</AppText> : !hideCollection && document.origin?.name ? <AppText variant="caption" numberOfLines={1}>{document.origin.name}</AppText> : null}
          <AppText variant="caption">{[document.pageCount ? `${document.pageCount} págs` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
        </> : <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>}
      </View>
    </Pressable>
    {!locked ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Baixar ${document.title ?? 'PDF'}`}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={download}
      style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}>
      <Icon name="download" size={20} color={Colors.ink} />
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  publicCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, padding: Spacing.four, borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper },
  publicPressed: { backgroundColor: Colors.strawLight },
  publicBody: { flex: 1, minWidth: 0, gap: 3 },
  publicTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  publicFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, paddingTop: 2 },
  publicFileMeta: { marginTop: 0 },
  topicTag: { minHeight: 20, justifyContent: 'center', borderRadius: Radius.sm, backgroundColor: Colors.strawLight, paddingHorizontal: 6 },
  topicTagText: { fontFamily: Fonts.monoSemibold, fontSize: 10.5, lineHeight: 19, letterSpacing: 0.5, textTransform: 'uppercase' },
  card: { borderWidth: 1.5, borderLeftWidth: 5, borderColor: Colors.red, backgroundColor: Colors.paper, borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.one, marginVertical: Spacing.one },
  locked: { borderColor: Colors.ink },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  editorialCard: { padding: Spacing.four, gap: Spacing.two, borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: Colors.paper },
  editorialHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  editorialMark: { paddingTop: 2 },
  editorialTitle: { flex: 1, minWidth: 0, fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  editorialMeta: { gap: Spacing.one, paddingLeft: 28 },
  editorialFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, marginTop: Spacing.one },
  lockedCover: { backgroundColor: Colors.ink },
  accessTag: { backgroundColor: Colors.red, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  lockedTag: { backgroundColor: Colors.ink },
  collectionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, padding: Spacing.four, borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper },
  collectionCardMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  collectionBody: { flex: 1, minWidth: 0, gap: 3 },
  collectionDocumentTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 24 },
  downloadButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: 5, backgroundColor: Colors.cream },
  pressed: { opacity: 0.72 },
});
