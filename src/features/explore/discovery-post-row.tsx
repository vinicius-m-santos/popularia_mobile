import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PostBody } from '@/features/posts/components/post-body';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatCount, formatRelative } from '@/lib/format';
import { useNav } from '@/lib/routes';
import type { FeedItem } from '@/types/models';

/** Trecho editorial de discussão, com autoria e contexto, sem métricas fictícias. */
export function DiscoveryPostRow({ post, rank }: { post: FeedItem; rank?: number }) {
  const nav = useNav();
  return (
    <Pressable onPress={() => nav.openPost(post.id)} accessibilityRole="link" accessibilityLabel={`Abrir publicação de ${post.author.name}: ${post.text}`} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      {rank ? <AppText style={styles.rank}>{String(rank).padStart(2, '0')}</AppText> : null}
      <View style={styles.text}>
        <AppText variant="label" color={Colors.red} numberOfLines={2}>
          {post.comuna ? `c/ ${post.comuna.name}` : 'No perfil'}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>{post.author.name} · @{post.author.handle}</AppText>
        <PostBody text={post.text} mentions={post.mentions} numberOfLines={3} style={styles.body} />
        <AppText variant="caption">{formatRelative(post.createdAt)} · {formatCount(post.commentCount)} comentários</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  text: { flex: 1, minWidth: 0, gap: Spacing.one },
  body: { fontSize: 15, lineHeight: 21 },
  rank: { minWidth: 45, fontFamily: Fonts.condensed, fontSize: 38, lineHeight: 48, color: Colors.red },
});
