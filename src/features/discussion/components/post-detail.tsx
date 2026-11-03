import { Pressable, StyleSheet, View } from 'react-native';

import { DocumentCard } from '@/features/library/document-card';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Icon } from '@/components/icon';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { chamadoCardFor } from '@/features/events/chamado-data';
import { ChamadoCard } from '@/features/events/chamado-card';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { postTarget } from '@/features/moderation/targets';
import { FollowButton } from '@/features/profiles/components/follow-button';
import { shareDestination } from '@/features/links/share';
import { useToast } from '@/components/toast';
import { AuthorLine } from '@/features/posts/components/author-line';
import { MediaBox } from '@/features/posts/components/media-box';
import { PostImages } from '@/features/posts/components/post-images';
import { PostAttachment } from '@/features/posts/components/post-attachment';
import { PostPollBlock } from '@/features/posts/components/post-poll';
import { PostBody } from '@/features/posts/components/post-body';
import { formatCount, formatStamp } from '@/lib/format';
import type { FeedItem } from '@/types/models';

import type { CommentSort } from '../thread';

type PostDetailProps = {
  post: FeedItem;
  sort: CommentSort;
  onSortChange: (sort: CommentSort) => void;
};

/** Publicação aberta em destaque, ações e o cabeçalho dos comentários (design 1c). */
export function PostDetail({ post, sort, onSortChange }: PostDetailProps) {
  const actions = usePostActions(post);
  const toast = useToast();
  const sheet = useActionsSheet();
  const chamado = chamadoCardFor(post);
  const share = () => { shareDestination({ kind: 'post', id: post.id }).catch(() => toast.show('Este conteúdo ainda não possui um link público.')); };

  return (
    <View>
      <View style={styles.body}>
        <AuthorLine
          author={post.author}
          avatarSize={44}
          trailing={<View style={styles.authorActions}>
            {post.viewer?.isAuthor ? null : <FollowButton user={post.author} />}
            <IconButton icon="share" size={20} accessibilityLabel="Compartilhar publicação" onPress={share} />
            <IconButton icon="more" size={20} accessibilityLabel="Mais opções da publicação" onPress={() => sheet.open(postTarget(post))} />
          </View>}
        />
        {chamado ? (
          <>
            <ChamadoCard data={chamado} />
            {post.attachment && post.attachment.type !== 'image' ? <PostAttachment media={post.attachment} /> : null}
          </>
        ) : (
          <>
            {post.title ? <AppText style={styles.title}>{post.title}</AppText> : null}
            {post.title && post.text ? <PostBody text={post.text} mentions={post.mentions} style={styles.text} /> : null}
            {post.attachment ? <PostAttachment media={post.attachment} /> : null}
            {post.images && post.images.length > 0 ? <PostImages images={post.images} /> : null}
            {!post.title && post.text ? <PostBody text={post.text} mentions={post.mentions} style={styles.text} /> : null}
            {post.document ? <DocumentCard document={post.document} appearance="editorial" /> : null}
            {post.poll ? <PostPollBlock postId={post.id} poll={post.poll} /> : null}
            {post.media ? <MediaBox media={post.media} /> : null}
          </>
        )}

        <AppText style={styles.stamp} color={Colors.muted}>{formatStamp(post.createdAt)}</AppText>

        <View style={styles.actions}>
          <CompactAction icon="support" count={actions.supportCount} active={actions.supported} label="Apoiar publicação" onPress={actions.toggleSupport} />
          <CompactAction icon="echo" count={actions.echoCount} active={actions.echoed} label="Ecoar publicação" onPress={actions.toggleEcho} />
          <View style={styles.spacer} />
          <IconButton
            icon="bookmark"
            accessibilityLabel={actions.saved ? 'Remover dos salvos' : 'Salvar'}
            selected={actions.saved}
            filled={actions.saved}
            size={20}
            onPress={actions.toggleSave}
            style={styles.save}
          />
        </View>
      </View>

      <View style={styles.commentsHeader}>
        <Kicker label={`${formatCount(actions.commentCount)} comentários`} textStyle={styles.commentsLabel} />
        <View style={styles.sort} role="radiogroup" accessibilityLabel="Ordenar comentários">
          <SortChip label="Mais apoiados" active={sort === 'top'} onPress={() => onSortChange('top')} />
          <SortChip label="Recentes" active={sort === 'recent'} onPress={() => onSortChange('recent')} />
        </View>
      </View>
    </View>
  );
}

function CompactAction({ icon, count, active, label, onPress }: { icon: 'support' | 'echo'; count: number; active: boolean; label: string; onPress: () => void }) {
  const color = active ? Colors.red : Colors.inkSoft;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${formatCount(count)}`} accessibilityState={{ selected: active }} style={styles.compactAction}>
    <Icon name={icon} size={19} color={color} filled={active && icon === 'support'} />
    <AppText style={styles.compactCount} color={color}>{formatCount(count)}</AppText>
  </Pressable>;
}

function SortChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{ checked: active }}
    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
    <AppText variant="button" color={active ? Colors.paper : Colors.ink}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: 14,
    gap: Spacing.three,
  },
  text: {
    fontSize: 17.5,
    lineHeight: 25,
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontSize: 26,
    lineHeight: 32,
  },
  stamp: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  authorActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactAction: { minWidth: 54, minHeight: 44, paddingHorizontal: Spacing.two, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  spacer: { flex: 1 },
  save: { marginRight: -12 },
  compactCount: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 17 },
  commentsHeader: {
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
    paddingHorizontal: Spacing.five,
    paddingTop: 14,
    paddingBottom: Spacing.one,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  commentsLabel: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  sort: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.strawLight,
    paddingHorizontal: Spacing.three,
  },
  chipActive: {
    backgroundColor: Colors.ink,
  },
  pressed: {
    opacity: 0.7,
  },
});
