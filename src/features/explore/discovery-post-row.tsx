import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { PostBody } from '@/features/posts/components/post-body';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatCount, formatRelative } from '@/lib/format';
import { useNav } from '@/lib/routes';
import type { FeedItem } from '@/types/models';

/** Trecho editorial de discussão, com autoria e contexto, sem métricas fictícias. */
export function DiscoveryPostRow({ post }: { post: FeedItem }) {
  const nav = useNav();
  return (
    <Pressable onPress={() => nav.openPost(post.id)} accessibilityRole="link" accessibilityLabel={`Abrir publicação de ${post.author.name}: ${post.text}`} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <View style={styles.author}>
        <Avatar initials={post.author.initials} tone={post.author.tone} size={36} userId={post.author.id} imageUrl={post.author.avatarUrl} />
        <View style={styles.identity}>
          <AppText variant="bodyStrong" numberOfLines={1}>{post.author.name}</AppText>
          <AppText variant="caption" numberOfLines={1}>@{post.author.handle}</AppText>
        </View>
      </View>
      {post.comuna ? <AppText variant="label" color={Colors.red} style={styles.context} numberOfLines={2}>c/ {post.comuna.name}</AppText> : null}
      <PostBody text={post.text} mentions={post.mentions} numberOfLines={3} style={styles.body} />
      <AppText variant="caption">{formatRelative(post.createdAt)} · {formatCount(post.commentCount)} {post.commentCount === 1 ? 'comentário' : 'comentários'}{post.media || post.attachment || post.images?.length || post.document ? ' · Com mídia' : ''}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two, padding: Spacing.three, marginBottom: Spacing.two, borderWidth: 1, borderColor: Colors.inkSoft, backgroundColor: Colors.paper },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  identity: { flex: 1, minWidth: 0 },
  context: { lineHeight: 16 },
  body: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
});
