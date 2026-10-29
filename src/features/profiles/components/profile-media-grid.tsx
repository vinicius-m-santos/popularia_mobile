import { preparePost } from '@/features/posts/queries';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, MaxContentWidth } from '@/constants/theme';
import { durationLabel } from '@/features/posts/post-media';
import type { FeedItem } from '@/types/models';

type ProfileMediaGridProps = {
  posts: FeedItem[];
  onOpen: (postId: string) => void;
};

/** A grade é apenas uma descoberta visual: cada bloco continua abrindo a publicação. */
export function ProfileMediaGrid({ posts, onOpen }: ProfileMediaGridProps) {
  const mediaPosts = posts.filter((post) => post.attachment?.type === 'image' || post.attachment?.type === 'video');
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(window.width, MaxContentWidth));

  if (mediaPosts.length === 0) {
    return <AppText style={styles.empty} color={Colors.muted}>Nenhuma imagem ou vídeo publicado ainda.</AppText>;
  }

  return (
    <View
      style={styles.grid}
      accessibilityLabel={`${mediaPosts.length} mídias publicadas`}
      onLayout={(event: LayoutChangeEvent) => setWidth((current) => {
        const next = Math.round(event.nativeEvent.layout.width);
        return next === current ? current : next;
      })}>
      {mediaPosts.map((post) => (
        <MediaTile key={post.id} post={post} size={Math.max(1, Math.floor(width / 3))} onPress={() => onOpen(post.id)} />
      ))}
    </View>
  );
}

function MediaTile({ post, size, onPress }: { post: FeedItem; size: number; onPress: () => void }) {
  const media = post.attachment!;
  const label = media.type === 'video' ? `Abrir vídeo, ${durationLabel(media.durationMs)}` : 'Abrir imagem';

  return (
    <Pressable onPressIn={() => preparePost(post)} onPress={() => { preparePost(post); onPress(); }} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && styles.pressed]}>
      {media.type === 'image' ? <Image source={media.url ? { uri: media.url } : undefined} contentFit="cover" cachePolicy="memory-disk" recyclingKey={media.id} transition={120} style={StyleSheet.absoluteFill} /> : <View style={styles.unavailable} />}
      {media.type === 'video' ? <View pointerEvents="none" style={styles.videoMark}><Icon name="play" size={15} color={Colors.paper} /><AppText style={styles.duration} color={Colors.paper}>{durationLabel(media.durationMs)}</AppText></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { width: '100%', minHeight: 1, flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1.5, borderTopColor: Colors.ink },
  tile: { overflow: 'hidden', backgroundColor: Colors.ink, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: Colors.cream },
  pressed: { opacity: 0.78 },
  unavailable: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: Colors.inkSoft },
  videoMark: { position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.76)' },
  duration: { fontFamily: Fonts.monoSemibold, fontSize: 9, lineHeight: 11, letterSpacing: 0.3 },
  empty: { paddingHorizontal: 24, paddingVertical: 38, fontSize: 14.5, textAlign: 'center' },
});
