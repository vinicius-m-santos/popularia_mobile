import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Shadows, Spacing } from '@/constants/theme';
import { CollectionAvatar, collectionMonogram } from './collection-avatar';
import type { LibraryCollection } from './types';

export { collectionMonogram };

/** Card horizontal de coleção: marca, nome e contagem, como na faixa da Biblioteca. */
export function CollectionCard({ item, onPress, width }: { item: LibraryCollection; onPress: () => void; width?: number }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Abrir coleção ${item.name}`}
    onPress={onPress}
    style={({ pressed }) => [styles.card, width === undefined ? styles.flex : { width }, pressed && styles.pressed]}>
    <CollectionAvatar id={item.id} name={item.name} size={48} />
    <View style={styles.body}>
      <AppText style={styles.title} numberOfLines={2}>{item.name}</AppText>
      <AppText style={styles.meta} numberOfLines={1}>{item.documentCount} {item.documentCount === 1 ? 'PDF' : 'PDFs'} · {item.origin.name}</AppText>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 5,
    backgroundColor: Colors.paper,
    ...Shadows.offset,
    boxShadow: '3px 3px 0 #16120F',
  },
  pressed: { opacity: 0.68 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 21 },
  meta: { fontFamily: Fonts.regular, fontSize: 11.5, lineHeight: 16, color: Colors.muted },
});
