import { preparePost } from '@/features/posts/queries';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts } from '@/constants/theme';
import { durationLabel } from '@/features/posts/post-media';
import type { FeedItem } from '@/types/models';

type ProfileMediaGridProps = {
  posts: FeedItem[];
  onOpen: (postId: string) => void;
};

/** A grade é apenas uma descoberta visual: cada bloco continua abrindo a publicação. */
export function ProfileMediaGrid({ posts, onOpen }: ProfileMediaGridProps) {
  const mediaPosts = posts.filter((post) => post.attachment?.type === 'image' || post.attachment?.type === 'video');

  if (mediaPosts.length === 0) {
    return <AppText style={styles.empty} color={Colors.muted}>Nenhuma imagem ou vídeo publicado ainda.</AppText>;
  }

  return (
    <View style={styles.grid} accessibilityLabel={`${mediaPosts.length} mídias publicadas`}>
      {mediaPosts.map((post) => (
        <MediaTile key={post.id} post={post} onPress={() => onOpen(post.id)} />
      ))}
    </View>
  );
}

function MediaTile({ post, onPress }: { post: FeedItem; onPress: () => void }) {
  const media = post.attachment!;
  const label = media.type === 'video' ? `Abrir vídeo, ${durationLabel(media.durationMs)}` : 'Abrir imagem';

  return (
    <Pressable
      onPressIn={() => preparePost(post)}
      onPress={() => { preparePost(post); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.frame}>
        {media.type === 'image' && media.url ? (
          <Image source={{ uri: media.url }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={media.id} transition={120} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.unavailable} />
        )}
        {media.type === 'video' ? (
          <View pointerEvents="none" style={styles.videoMark}>
            <Icon name="play" size={15} color={Colors.paper} />
            <AppText style={styles.duration} color={Colors.paper}>{durationLabel(media.durationMs)}</AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.cream,
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
  },
  tile: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
  },
  frame: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.rule,
    backgroundColor: Colors.straw,
  },
  pressed: { opacity: 0.78 },
  unavailable: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: Colors.inkSoft },
  videoMark: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.76)',
  },
  duration: { fontFamily: Fonts.monoSemibold, fontSize: 10.5, lineHeight: 13, letterSpacing: 0.3 },
  empty: { paddingHorizontal: 24, paddingVertical: 38, fontSize: 15, textAlign: 'center' },
});
