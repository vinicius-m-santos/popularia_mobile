import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { LibraryDocument } from './types';

export const accessLabel = (document: LibraryDocument) => document.isPublic ? 'Público' : ({ private: 'Só você', followers: 'Seguidores', visitors: 'Aberto na comuna', members: 'Só membros', moderators: 'Só coordenação' }[document.access ?? 'private']);
export const sizeLabel = (bytes: number | null) => bytes === null ? '' : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

export function DocumentCard({ document, onPress, shared = false }: { document: LibraryDocument; onPress?: () => void; shared?: boolean }) {
  const locked = document.state !== 'available';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${document.title ?? 'Documento indisponível'}${locked ? ', acesso restrito' : ', PDF'}`}
    onPress={onPress ?? (() => router.push({ pathname: '/biblioteca/documento/[id]', params: { id: document.id } }))} style={[styles.card, locked && styles.locked]}>
    <View style={styles.top}><AppText variant="label" color={locked ? Colors.ink : Colors.red}>{locked ? 'PDF · acesso restrito' : 'PDF'}</AppText>
      <Badge label={locked ? 'Sem acesso' : accessLabel(document)} tone={locked ? 'ink' : 'red'} /></View>
    <AppText variant="heading">{document.title ?? 'Este documento não está mais disponível para você.'}</AppText>
    {!locked ? <>
      {document.collection ? <AppText variant="caption">{document.collection.name}</AppText> : null}
      <AppText variant="caption">{shared ? `Compartilhado por ${document.responsible?.name ?? 'uma pessoa'}` : document.origin?.name}</AppText>
      <AppText variant="caption">{[document.pageCount ? `${document.pageCount} págs` : '', sizeLabel(document.byteSize)].filter(Boolean).join(' · ')}</AppText>
    </> : <AppText variant="caption">Ver uma publicação com este PDF não dá acesso ao arquivo.</AppText>}
  </Pressable>;
}
const styles = StyleSheet.create({ card: { borderWidth: 1.5, borderLeftWidth: 5, borderColor: Colors.red, backgroundColor: Colors.paper, borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two, marginVertical: Spacing.two }, locked: { borderColor: Colors.ink }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two } });
