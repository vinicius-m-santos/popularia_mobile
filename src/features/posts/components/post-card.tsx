import { memo } from 'react';
import { preparePost } from '@/features/posts/queries';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useInteractions } from '@/features/interactions/interactions-context';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { postTarget } from '@/features/moderation/targets';
import { formatCount, formatRelative } from '@/lib/format';
import { useNav } from '@/lib/routes';
import type { FeedItem } from '@/types/models';

import { DocumentCard } from '@/features/library/document-card';

import { AuthorLine } from './author-line';
import { EventBox } from './event-box';
import { MediaBox } from './media-box';
import { PostImages } from './post-images';
import { PostAttachment } from './post-attachment';
import { PostBody } from './post-body';
import { PostPollBlock } from './post-poll';

type PostCardProps = {
  item: FeedItem;
  mediaVisible?: boolean;
  /** Linha divisória no topo (todos menos o primeiro). */
  showRule?: boolean;
  /** Na página da própria comuna, o rótulo "c/ …" é redundante. */
  showComuna?: boolean;
  /** No perfil de quem foi silenciado, as publicações continuam visíveis. */
  showMuted?: boolean;
};

/** Publicação no feed e na página da comuna (design 1a/1b). */
export const PostCard = memo(function PostCard({ item, showRule = false, showComuna = true, showMuted = false, mediaVisible = true }: PostCardProps) {
  const { author, comuna, event, media, images, topComment, topCommentAuthor } = item;
  const actions = usePostActions(item);
  const nav = useNav();
  const sheet = useActionsSheet();
  const { isOn } = useInteractions();
  const open = () => { preparePost(item); nav.openPost(item.id); };
  // Na API, só o próprio perfil abre (perfis de outras pessoas ainda são fictícios).
  const openAuthor = !item.viewer
    ? () => nav.openProfile(author.id)
    : item.viewer.isAuthor
      ? () => nav.openProfile('me')
      : undefined;

  if (!showMuted && isOn('mutedUsers', author.id)) return null;

  return (
    <View style={[styles.card, showRule && styles.rule]}>
      {showComuna && comuna ? (
        <Pressable
          onPress={() => nav.openComuna(comuna.id)}
          accessibilityRole="link"
          accessibilityLabel={`Comuna ${comuna.name}`}
          hitSlop={{ top: 12, bottom: 8 }}
          style={styles.comunaLink}>
          <Kicker label={`c/ ${comuna.name}`} color={Colors.red} />
        </Pressable>
      ) : null}

      <AuthorLine
        author={author}
        meta={formatRelative(item.createdAt)}
        onPress={openAuthor}
        trailing={
          <IconButton icon="more" accessibilityLabel="Mais opções" onPress={() => sheet.open(postTarget(item))} size={20} style={styles.more} />
        }
      />

      <Pressable
        onPress={open}
        onPressIn={() => preparePost(item)}
        accessibilityRole="button"
        accessibilityHint="Abre a discussão"
        style={styles.body}>
        <PostBody text={item.text} mentions={item.mentions} />
        {images && images.length > 0 ? <PostImages images={images} /> : null}
      </Pressable>

      {item.attachment ? <PostAttachment key={item.attachment.id} media={item.attachment} visible={mediaVisible} /> : null}

      {/* O anexo mantém o mesmo cartão da seção "Documentos públicos" da biblioteca. */}
      {item.document ? <DocumentCard document={item.document} appearance="editorial" /> : null}
      {item.poll ? <PostPollBlock postId={item.id} poll={item.poll} /> : null}
      {event ? <EventBox event={event} /> : null}
      {media ? (
        <Pressable onPress={open} accessibilityHint="Abre a discussão">
          <MediaBox media={media} />
        </Pressable>
      ) : null}

      {topComment && topCommentAuthor ? (
        <Pressable
          onPress={open}
          style={styles.topComment}
          accessibilityRole="button"
          accessibilityLabel={`Comentário de ${topCommentAuthor.name}: ${topComment.text}`}
          accessibilityHint="Abre a discussão">
          <AppText numberOfLines={2} style={styles.topCommentText}>
            <AppText style={[styles.topCommentText, styles.bold]}>{topCommentAuthor.name}</AppText>{' '}
            {topComment.text}
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <ActionButton
          icon="support"
          count={actions.supportCount}
          active={actions.supported}
          label="Apoiar"
          onPress={actions.toggleSupport}
        />
        <ActionButton icon="comment" count={actions.commentCount} label="Comentar" onPress={open} />
        <ActionButton
          icon="echo"
          count={actions.echoCount}
          active={actions.echoed}
          label="Ecoar"
          onPress={actions.toggleEcho}
        />
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
  );
});

type ActionButtonProps = {
  icon: IconName;
  count: number;
  label: string;
  onPress: () => void;
  /** Ausente em ações que não são alternância (Comentar). */
  active?: boolean;
};

function ActionButton({ icon, count, label, onPress, active }: ActionButtonProps) {
  const color = active ? Colors.red : Colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatCount(count)}`}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Icon name={icon} size={21} color={color} filled={icon === 'support' && active} />
      <AppText style={styles.actionCount} color={color}>
        {formatCount(count)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.five,
    paddingTop: 14,
    paddingBottom: Spacing.one,
    gap: Spacing.two + 2,
  },
  rule: {
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
  },
  comunaLink: {
    alignSelf: 'flex-start',
  },
  more: {
    marginRight: -12,
  },
  body: {
    gap: Spacing.two + 2,
  },
  topComment: {
    backgroundColor: Colors.highlight,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: Spacing.three,
  },
  topCommentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontFamily: Fonts.bold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -9,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
  spacer: {
    flex: 1,
  },
  save: {
    marginRight: -12,
  },
});
