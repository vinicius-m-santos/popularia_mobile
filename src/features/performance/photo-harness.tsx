import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { PostCard } from '@/features/posts/components/post-card';
import { performanceInstrumentationEnabled, recordListLoad } from '@/lib/performance';
import type { FeedItem } from '@/types/models';

import { buildQaPhotoFeedItems, QA_PHOTO_FEED_COUNT, type QaPhotoVariant } from './photo-harness-fixture';

/**
 * Feed virtualizado de 120 fotos para o QA de decodificação (POP-65).
 *
 * Uma `FlashList` recicla as células como o feed real; não é um `ScrollView`
 * com 120 imagens montadas ao mesmo tempo. O objetivo é medir o caminho que a
 * pessoa percorre: fotos entram na viewport, carregam e saem.
 */
export function PhotoQaHarness({ variant = 'original' }: { variant?: QaPhotoVariant }) {
  const items = useMemo(() => buildQaPhotoFeedItems(QA_PHOTO_FEED_COUNT, variant), [variant]);

  const renderItem = useCallback(({ item }: { item: FeedItem }) => (
    <PostCard item={item} showRule={false} mediaVisible />
  ), []);

  if (!performanceInstrumentationEnabled()) return null;

  return (
    <View style={styles.root}>
      <FlashList
        key={variant}
        testID="photo-feed-harness"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemType={() => 'photo'}
        contentContainerStyle={styles.list}
        onLoad={(info) => recordListLoad(`photo-feed:${variant}`, info.elapsedTimeInMs, items.length)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  list: { paddingBottom: Spacing.seven },
});
