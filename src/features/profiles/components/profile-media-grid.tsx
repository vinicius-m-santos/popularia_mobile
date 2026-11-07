import { preparePost } from '@/features/posts/queries';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { durationLabel } from '@/features/posts/post-media';
import type { FeedItem } from '@/types/models';

type ProfileMediaGridProps = {
  posts: FeedItem[];
  onOpen: (postId: string) => void;
  /** Totais da aba inteira; o resumo só aparece na primeira linha da grade. */
  counts?: { total: number; photos: number; videos: number };
};

export type MediaGridData = {
  posts: FeedItem[];
  counts?: { total: number; photos: number; videos: number };
};

const mediaGridCache = new WeakMap<FeedItem[], MediaGridData>();

/**
 * Separa mídia e conta fotos/vídeos em uma passada. O perfil reusa a mesma lista
 * de publicações entre renders; o cache por identidade evita refiltrar o acervo
 * inteiro quando só o estado das abas/rolagem mudou.
 */
export function mediaGridData(posts: FeedItem[]): MediaGridData {
  const cached = mediaGridCache.get(posts);
  if (cached) return cached;
  const media: FeedItem[] = [];
  let photos = 0;
  let videos = 0;
  for (const post of posts) {
    const type = post.attachment?.type;
    if (type === 'image') {
      media.push(post);
      photos += 1;
    } else if (type === 'video') {
      media.push(post);
      videos += 1;
    }
  }
  const data: MediaGridData = {
    posts: media,
    counts: media.length > 0 ? { total: media.length, photos, videos } : undefined,
  };
  mediaGridCache.set(posts, data);
  return data;
}

/**
 * Grade de descoberta da aba Mídia: três colunas de quadrados, fio de tinta de 2 e
 * um resumo mono acima, no desenho aprovado do perfil. Cada bloco abre a publicação.
 */
export function ProfileMediaGrid({ posts, onOpen, counts }: ProfileMediaGridProps) {
  const { posts: mediaPosts, counts: derivedCounts } = mediaGridData(posts);

  if (mediaPosts.length === 0) {
    return <AppText style={styles.empty} color={Colors.muted}>Nenhuma imagem ou vídeo publicado ainda.</AppText>;
  }

  const summary = counts ?? derivedCounts;

  return (
    <View>
      {counts && summary ? <View style={styles.summaryRow}>
        <AppText style={styles.summary} color={Colors.inkSoft}>
          {`${summary.total} ${summary.total === 1 ? 'ITEM' : 'ITENS'} · ${summary.photos} ${summary.photos === 1 ? 'FOTO' : 'FOTOS'}${summary.videos > 0 ? ` · ${summary.videos} ${summary.videos === 1 ? 'VÍDEO' : 'VÍDEOS'}` : ''}`}
        </AppText>
      </View> : null}
      <View style={styles.grid} accessibilityLabel={`${mediaPosts.length} mídias publicadas`}>
        {mediaPosts.map((post) => (
          <MediaTile key={post.id} post={post} onPress={() => onOpen(post.id)} />
        ))}
      </View>
    </View>
  );
}

function MediaTile({ post, onPress }: { post: FeedItem; onPress: () => void }) {
  const media = post.attachment!;
  const video = media.type === 'video';
  const label = video ? `Abrir vídeo, ${durationLabel(media.durationMs)}` : 'Abrir imagem';

  return (
    <Pressable
      onPressIn={() => { void preparePost(post); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={[styles.frame, video && styles.frameVideo]}>
        {/* Enquanto a imagem não chega (ou se falhar), o lugar já é da casa: palha e ícone. */}
        <View style={styles.fallback}>
          <Icon name="image" size={28} color={Colors.muted} />
        </View>
        {!video && media.url ? (
          <Image
            source={{ uri: media.url }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={media.id}
            transition={140}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {video ? (
          <View pointerEvents="none" style={styles.videoMark}>
            <Icon name="play" size={10} color={Colors.paper} filled />
            <AppText style={styles.duration} color={Colors.paper}>{durationLabel(media.durationMs)}</AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  summary: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.2,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 1.5,
    paddingBottom: 24,
  },
  tile: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1.5,
  },
  frame: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.straw,
  },
  frameVideo: { backgroundColor: Colors.inkSoft },
  fallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoMark: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: Colors.ink,
  },
  duration: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 14 },
  pressed: { opacity: 0.82 },
  empty: { paddingHorizontal: 24, paddingVertical: 38, fontSize: 15, textAlign: 'center' },
});
