import { Pressable, StyleSheet, View } from 'react-native';

import { DocumentCard } from '@/features/library/document-card';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Icon } from '@/components/icon';
import { PillButton } from '@/components/pill-button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { postTarget } from '@/features/moderation/targets';
import { FollowButton } from '@/features/profiles/components/follow-button';
import { AuthorLine } from '@/features/posts/components/author-line';
import { EventBox } from '@/features/posts/components/event-box';
import { MediaBox } from '@/features/posts/components/media-box';
import { PostImages } from '@/features/posts/components/post-images';
import { PostAttachment } from '@/features/posts/components/post-attachment';
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
  const sheet = useActionsSheet();

  return (
    <View>
      <View style={styles.body}>
        <AuthorLine
          author={post.author}
          avatarSize={44}
          trailing={<View style={styles.authorActions}>
            {post.viewer?.isAuthor ? null : <FollowButton user={post.author} />}
            <IconButton icon="more" size={20} accessibilityLabel="Mais opções da publicação" onPress={() => sheet.open(postTarget(post))} />
          </View>}
        />
        <PostBody text={post.text} style={styles.text} />
        {post.attachment ? <PostAttachment media={post.attachment} /> : null}
        {post.images && post.images.length > 0 ? <PostImages images={post.images} /> : null}
        {post.document ? <DocumentCard document={post.document} appearance="editorial" /> : null}
        {post.event ? <EventBox event={post.event} /> : null}
        {post.media ? <MediaBox media={post.media} /> : null}

        <AppText style={styles.stamp} color={Colors.muted}>
          {formatStamp(post.createdAt)} · {formatCount(actions.echoCount)} ecos
        </AppText>

        <View style={styles.actions}>
          <CompactAction icon="support" count={actions.supportCount} active={actions.supported} label="Apoiar publicação" onPress={actions.toggleSupport} />
          <CompactAction icon="echo" count={actions.echoCount} active={actions.echoed} label="Ecoar publicação" onPress={actions.toggleEcho} />
          <IconButton
            icon="bookmark"
            accessibilityLabel={actions.saved ? 'Remover dos salvos' : 'Salvar'}
            selected={actions.saved}
            filled={actions.saved}
            size={18}
            bordered
            onPress={actions.toggleSave}
          />
        </View>
      </View>

      <View style={styles.commentsHeader}>
        <AppText variant="heading" style={styles.commentsTitle} accessibilityRole="header">
          {formatCount(actions.commentCount)} comentários
        </AppText>
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
  return (
    <PillButton
      label={label}
      onPress={onPress}
      variant={active ? 'dark' : 'outline'}
      size="sm"
      selected={active}
      style={[styles.chip, !active && styles.chipIdle]}
    />
  );
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
  compactCount: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 17 },
  commentsHeader: {
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
    paddingHorizontal: Spacing.five,
    paddingTop: 14,
    paddingBottom: Spacing.one,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  commentsTitle: {
    fontSize: 25,
    lineHeight: 27,
  },
  sort: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chip: {
    minHeight: 30,
    paddingHorizontal: 10,
  },
  chipIdle: {
    borderColor: 'transparent',
  },
});
