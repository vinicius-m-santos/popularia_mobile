import { StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type PopulariaSkeletonVariant = 'post' | 'row' | 'notification' | 'comment' | 'media';

type ListSkeletonProps = {
  rows?: number;
  variant?: PopulariaSkeletonVariant;
  /** Texto lido pela tecnologia assistiva; o padrão acompanha o formato. */
  label?: string;
};

const DEFAULT_LABELS: Record<PopulariaSkeletonVariant, string> = {
  post: 'Carregando conteúdo',
  row: 'Carregando conteúdo',
  notification: 'Carregando avisos',
  comment: 'Carregando comentários',
  media: 'Carregando mídia',
};

/**
 * Placeholder do formato real de uma lista (publicação, aviso, comentário ou
 * mídia). Os blocos são estáticos: sem shimmer, timers ou animação durante o
 * scroll. O primeiro quadro já reserva a altura do conteúdo que vai chegar.
 */
export function PopulariaListSkeleton({ rows = 3, variant = 'post', label }: ListSkeletonProps) {
  const accessibilityLabel = label ?? DEFAULT_LABELS[variant];
  return (
    <View
      testID={`popularia-skeleton-${variant}`}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={styles.group}>
      {variant === 'media'
        ? <MediaSkeleton />
        : Array.from({ length: rows }, (_, index) => (
          <View
            key={index}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.row,
              variant === 'post' && styles.postRow,
              variant === 'notification' && styles.notificationRow,
              variant === 'comment' && styles.commentRow,
            ]}>
            {variant === 'post' ? <PostSkeleton /> : null}
            {variant === 'row' ? <CompactRowSkeleton /> : null}
            {variant === 'notification' ? <NotificationSkeleton /> : null}
            {variant === 'comment' ? <CommentSkeleton /> : null}
          </View>
        ))}
    </View>
  );
}

function PostSkeleton() {
  return (
    <>
      <View style={styles.identity}>
        <View style={[styles.block, styles.postAvatar]} />
        <View style={styles.identityText}>
          <View style={[styles.block, styles.line, styles.name]} />
          <View style={[styles.block, styles.lineSmall, styles.handle]} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.block, styles.line, styles.full]} />
        <View style={[styles.block, styles.line, styles.wide]} />
        <View style={[styles.block, styles.line, styles.short]} />
      </View>
      <View style={styles.actions}>
        <View style={[styles.block, styles.action]} />
        <View style={[styles.block, styles.action]} />
        <View style={[styles.block, styles.action]} />
      </View>
    </>
  );
}

function CompactRowSkeleton() {
  return (
    <>
      <View style={styles.identity}>
        <View style={[styles.block, styles.rowAvatar]} />
        <View style={styles.identityText}>
          <View style={[styles.block, styles.line, styles.name]} />
          <View style={[styles.block, styles.lineSmall, styles.short]} />
        </View>
      </View>
      <View style={[styles.block, styles.line, styles.wide]} />
    </>
  );
}

function NotificationSkeleton() {
  return (
    <>
      <View style={styles.notificationAvatar}>
        <View style={[styles.block, styles.squareAvatar]} />
        <View style={styles.badge} />
      </View>
      <View style={styles.identityText}>
        <View style={[styles.block, styles.line, styles.full]} />
        <View style={[styles.block, styles.line, styles.wide]} />
        <View style={[styles.block, styles.lineSmall, styles.time]} />
      </View>
    </>
  );
}

function CommentSkeleton() {
  return (
    <>
      <View style={[styles.block, styles.commentAvatar]} />
      <View style={styles.identityText}>
        <View style={[styles.block, styles.line, styles.name]} />
        <View style={[styles.block, styles.line, styles.full]} />
        <View style={[styles.block, styles.line, styles.wide]} />
      </View>
    </>
  );
}

function MediaSkeleton() {
  return (
    <View style={styles.mediaGrid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.mediaCell}>
          <View style={[styles.block, styles.mediaTile]} />
        </View>
      ))}
    </View>
  );
}

/** Tela de uma comuna enquanto o detalhe ainda não chegou (deep link/rede lenta). */
export function ComunaScreenSkeleton({ label = 'Carregando comuna' }: { label?: string }) {
  return (
    <View
      testID="comuna-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={styles.screen}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.block, styles.cover]} />
        <View style={styles.comunaContent}>
          <View style={[styles.block, styles.comunaMark]} />
          <View style={[styles.block, styles.comunaTitle]} />
          <View style={[styles.block, styles.lineSmall, styles.comunaMeta]} />
          <View style={styles.description}>
            <View style={[styles.block, styles.line, styles.full]} />
            <View style={[styles.block, styles.line, styles.wide]} />
            <View style={[styles.block, styles.line, styles.short]} />
          </View>
          <View style={styles.stats}>
            {Array.from({ length: 3 }, (_, index) => (
              <View key={index} style={[styles.statCell, index > 0 && styles.statDivider]}>
                <View style={[styles.block, styles.statValue]} />
                <View style={[styles.block, styles.lineSmall, styles.statLabel]} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.tabs}>
          {Array.from({ length: 4 }, (_, index) => (
            <View key={index} style={[styles.block, styles.tab]} />
          ))}
        </View>
        <PopulariaListSkeleton rows={2} />
      </View>
    </View>
  );
}

/** Perfil sem resumo em cache: mantém a silhueta de identidade, abas e publicações. */
export function ProfileScreenSkeleton({ label = 'Carregando perfil' }: { label?: string }) {
  return (
    <View
      testID="profile-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={styles.screen}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.profileIdentity}>
          <View style={[styles.block, styles.profilePhoto]} />
          <View style={styles.identityText}>
            <View style={[styles.block, styles.profileName]} />
            <View style={[styles.block, styles.lineSmall, styles.profileHandle]} />
          </View>
        </View>
        <View style={styles.profileBody}>
          <View style={[styles.block, styles.line, styles.full]} />
          <View style={[styles.block, styles.line, styles.wide]} />
          <View style={[styles.block, styles.line, styles.short]} />
        </View>
        <View style={styles.profileStats}>
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} style={styles.profileStat}>
              <View style={[styles.block, styles.profileStatValue]} />
              <View style={[styles.block, styles.lineSmall, styles.profileStatLabel]} />
            </View>
          ))}
        </View>
        <View style={styles.tabs}>
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} style={[styles.block, styles.tab]} />
          ))}
        </View>
        <PopulariaListSkeleton rows={2} />
      </View>
    </View>
  );
}

/** Discussão sem publicação em cache: publicação aberta e primeiros comentários. */
export function DiscussionScreenSkeleton({ label = 'Carregando discussão' }: { label?: string }) {
  return (
    <View
      testID="discussion-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={styles.screen}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.discussionPost}>
          <View style={styles.identity}>
            <View style={[styles.block, styles.discussionAvatar]} />
            <View style={styles.identityText}>
              <View style={[styles.block, styles.line, styles.name]} />
              <View style={[styles.block, styles.lineSmall, styles.handle]} />
            </View>
          </View>
          <View style={styles.body}>
            <View style={[styles.block, styles.line, styles.full]} />
            <View style={[styles.block, styles.line, styles.full]} />
            <View style={[styles.block, styles.line, styles.wide]} />
            <View style={[styles.block, styles.line, styles.short]} />
          </View>
          <View style={styles.actions}>
            <View style={[styles.block, styles.action]} />
            <View style={[styles.block, styles.action]} />
            <View style={[styles.block, styles.action]} />
          </View>
        </View>
        <View style={styles.commentsHeading}>
          <View style={[styles.block, styles.lineSmall, styles.commentsLabel]} />
          <View style={[styles.block, styles.lineSmall, styles.commentsSort]} />
        </View>
        <PopulariaListSkeleton rows={3} variant="comment" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: '100%',
  },
  row: {
    padding: Spacing.five,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: Colors.rule,
  },
  postRow: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    minHeight: 230,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  notificationRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: 14,
    paddingHorizontal: Spacing.five,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.rule,
  },
  commentRow: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  block: {
    backgroundColor: Colors.straw,
  },
  line: {
    height: 16,
    borderRadius: 2,
  },
  lineSmall: {
    height: 12,
    borderRadius: 2,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  squareAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
  },
  discussionAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
  },
  name: {
    width: '45%',
  },
  handle: {
    width: '30%',
  },
  body: {
    gap: 9,
  },
  full: {
    width: '100%',
  },
  wide: {
    width: '82%',
  },
  short: {
    width: '58%',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: 8,
  },
  action: {
    width: 68,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.strawLight,
    borderWidth: 1,
    borderColor: Colors.straw,
  },
  notificationAvatar: {
    width: 44,
    height: 44,
  },
  badge: {
    position: 'absolute',
    right: -5,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.straw,
    borderWidth: 2,
    borderColor: Colors.cream,
  },
  time: {
    width: '24%',
  },
  mediaGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 1.5,
    paddingVertical: 1.5,
  },
  mediaCell: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1.5,
  },
  mediaTile: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  cover: {
    height: 160,
  },
  comunaContent: {
    paddingHorizontal: Spacing.five,
    paddingTop: 12,
    paddingBottom: Spacing.four,
    gap: 10,
  },
  comunaMark: {
    width: 88,
    height: 88,
    marginTop: -44,
    marginBottom: 4,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.ink,
  },
  comunaTitle: {
    width: '72%',
    height: 44,
    borderRadius: 2,
  },
  comunaMeta: {
    width: '52%',
  },
  description: {
    gap: 8,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
    marginTop: Spacing.one,
  },
  statCell: {
    flex: 1,
    paddingVertical: 8,
    gap: 7,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.rule,
    paddingLeft: Spacing.three,
  },
  statValue: {
    width: '52%',
    height: 28,
  },
  statLabel: {
    width: '66%',
  },
  tabs: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.six,
    paddingHorizontal: Spacing.five,
    borderTopWidth: 1,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  tab: {
    width: 64,
    height: 14,
  },
  profileIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  profilePhoto: {
    width: 96,
    height: 96,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  profileName: {
    width: '76%',
    height: 38,
    borderRadius: 2,
  },
  profileHandle: {
    width: '42%',
    marginTop: 6,
  },
  profileBody: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 9,
  },
  profileStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  profileStat: {
    flex: 1,
    gap: 6,
  },
  profileStatValue: {
    width: 48,
    height: 26,
  },
  profileStatLabel: {
    width: 64,
  },
  discussionPost: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 14,
    borderBottomWidth: 1,
    borderColor: Colors.rule,
  },
  commentsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.rule,
  },
  commentsLabel: {
    width: 90,
  },
  commentsSort: {
    width: 130,
  },
});
