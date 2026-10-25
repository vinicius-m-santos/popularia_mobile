import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { eventDateParts, formatCount, formatPostDate } from '@/lib/format';
import type { CommunityEvent, FeedItem, PostMedia } from '@/types/models';

type PostCardProps = {
  item: FeedItem;
  /** Linha divisória no topo (todos menos o primeiro item). */
  showRule?: boolean;
};

/**
 * Versão inicial, só de leitura, do post do feed (design 1a/2d).
 * As interações (apoiar, comentar, ecoar, salvar) chegam na próxima etapa.
 */
export function PostCard({ item, showRule = false }: PostCardProps) {
  const { author, comuna, event, media, images, topComment, topCommentAuthor } = item;

  return (
    <View style={[styles.card, showRule && styles.rule]}>
      {comuna ? (
        <View style={styles.comunaRow}>
          <View style={styles.comunaSquare} />
          <AppText variant="label" color={Colors.red}>
            c/ {comuna.name}
          </AppText>
        </View>
      ) : null}

      <View style={styles.authorRow} accessible accessibilityLabel={`${author.name}, @${author.handle}`}>
        <Avatar initials={author.initials} tone={author.tone} />
        <View style={styles.authorText}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong">{author.name}</AppText>
            {author.badge ? (
              <View style={styles.badge}>
                <AppText variant="label" color={Colors.cream} style={styles.badgeText}>
                  {author.badge}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="caption">
            @{author.handle} · {formatPostDate(item.createdAt)}
          </AppText>
        </View>
      </View>

      <AppText>{item.text}</AppText>

      {images && images.length > 0 ? (
        <View style={styles.images}>
          {images.map((img) => (
            <View
              key={img.alt}
              style={[styles.imagePlaceholder, { aspectRatio: images.length > 1 ? 1 : 16 / 10 }]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Foto: ${img.alt}`}>
              <AppText style={styles.imageLabel}>foto: {img.alt}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {event ? <EventBox event={event} /> : null}
      {media ? <MediaBox media={media} /> : null}

      {topComment && topCommentAuthor ? (
        <View style={styles.topComment}>
          <AppText numberOfLines={2} style={styles.topCommentText}>
            <AppText style={[styles.topCommentText, styles.bold]}>{topCommentAuthor.name}</AppText>{' '}
            {topComment.text}
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Stat icon="support" value={item.supportCount} label="apoios" />
        <Stat icon="comment" value={item.commentCount} label="comentários" />
        <Stat icon="echo" value={item.echoCount} label="ecos" />
      </View>
    </View>
  );
}

function EventBox({ event }: { event: CommunityEvent }) {
  const date = eventDateParts(event.startsAt);
  return (
    <View
      style={styles.event}
      accessible
      accessibilityLabel={`${event.kind}: ${event.title}, ${date.weekday} ${date.day} de ${date.month} às ${date.hour}, ${event.place}`}>
      <View style={styles.eventDate}>
        <AppText variant="label" color={Colors.paper} style={styles.eventMonth}>
          {date.month}
        </AppText>
        <AppText style={styles.eventDay} color={Colors.paper}>
          {date.day}
        </AppText>
      </View>
      <View style={styles.eventBody}>
        <AppText variant="label" color={Colors.red} style={styles.eventMeta}>
          {event.kind} · {date.weekday} · {date.hour}
        </AppText>
        <AppText variant="heading" style={styles.eventTitle}>
          {event.title}
        </AppText>
        <AppText variant="caption">
          {event.place} · {formatCount(event.attendeeCount)} vão
        </AppText>
      </View>
    </View>
  );
}

function MediaBox({ media }: { media: PostMedia }) {
  return (
    <View style={styles.media} accessible accessibilityLabel={`Áudio: ${media.title}. ${media.meta}`}>
      <View style={styles.play}>
        <Icon name="play" size={20} color={Colors.paper} filled />
      </View>
      <View style={styles.mediaText}>
        <AppText variant="label" color="#C9BCAA" style={styles.mediaMeta}>
          {media.meta}
        </AppText>
        <AppText variant="heading" color={Colors.cream}>
          {media.title}
        </AppText>
      </View>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${formatCount(value)} ${label}`}>
      <Icon name={icon} size={21} />
      <AppText variant="button">{formatCount(value)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four - 2,
    paddingBottom: Spacing.one,
    gap: Spacing.two + 2,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth * 3,
    borderTopColor: Colors.rule,
  },
  comunaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comunaSquare: {
    width: 8,
    height: 8,
    backgroundColor: Colors.red,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  authorText: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    backgroundColor: Colors.ink,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9.5,
    lineHeight: 12,
  },
  images: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  imagePlaceholder: {
    flex: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.straw,
    justifyContent: 'flex-end',
    padding: Spacing.two + 2,
  },
  imageLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    color: '#5A5047',
  },
  event: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.paper,
  },
  eventDate: {
    width: 62,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  eventMonth: {
    fontSize: 10,
  },
  eventDay: {
    fontFamily: Fonts.condensed,
    fontSize: 32,
    lineHeight: 34,
  },
  eventBody: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    gap: 2,
  },
  eventMeta: {
    fontSize: 10,
  },
  eventTitle: {
    fontSize: 19,
    lineHeight: 21,
  },
  media: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.ink,
  },
  play: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  mediaMeta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
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
  stat: {
    minHeight: 44,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
