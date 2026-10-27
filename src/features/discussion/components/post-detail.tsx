import { StyleSheet, View } from 'react-native';

import { DocumentCard } from '@/features/library/document-card';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { FollowButton } from '@/features/profiles/components/follow-button';
import { AuthorLine } from '@/features/posts/components/author-line';
import { EventBox } from '@/features/posts/components/event-box';
import { MediaBox } from '@/features/posts/components/media-box';
import { PostImages } from '@/features/posts/components/post-images';
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

  return (
    <View>
      <View style={styles.body}>
        <AuthorLine
          author={post.author}
          avatarSize={44}
          trailing={post.viewer?.isAuthor ? undefined : <FollowButton user={post.author} />}
        />
        <AppText style={styles.text}>{post.text}</AppText>
        {post.images && post.images.length > 0 ? <PostImages images={post.images} /> : null}
        {post.document ? <DocumentCard document={post.document} /> : null}
        {post.event ? <EventBox event={post.event} /> : null}
        {post.media ? <MediaBox media={post.media} /> : null}

        <AppText style={styles.stamp} color={Colors.muted}>
          {formatStamp(post.createdAt)} · {formatCount(actions.echoCount)} ecos
        </AppText>

        <View style={styles.actions}>
          <PillButton
            label={`Apoiar · ${formatCount(actions.supportCount)}`}
            icon="support"
            iconFilled={actions.supported}
            onPress={actions.toggleSupport}
            variant={actions.supported ? 'primary' : 'outline'}
            selected={actions.supported}
            style={styles.flex}
          />
          <PillButton
            label="Ecoar"
            icon="echo"
            onPress={actions.toggleEcho}
            variant={actions.echoed ? 'dark' : 'outline'}
            selected={actions.echoed}
            style={styles.flex}
          />
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
  flex: {
    flex: 1,
  },
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
