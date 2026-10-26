import { StyleSheet, View } from 'react-native';

import { StripedPlaceholder } from '@/components/striped-placeholder';
import type { PostImage } from '@/types/models';

/** Uma foto em 16:10 ou duas lado a lado em 1:1, como no design. */
export function PostImages({ images }: { images: PostImage[] }) {
  const multiple = images.length > 1;
  return (
    <View style={styles.grid}>
      {images.map((img) => (
        <StripedPlaceholder
          key={img.alt}
          label={img.alt}
          style={[styles.item, { aspectRatio: multiple ? 1 : 16 / 10 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 4,
  },
  item: {
    flex: 1,
  },
});
