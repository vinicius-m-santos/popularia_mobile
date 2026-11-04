import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { chamadoCardFor } from '@/features/events/chamado-data';
import { Fonts } from '@/constants/theme';
import { formatCount, formatRelative } from '@/lib/format';
import type { FeedItem } from '@/types/models';

import { ExploreSectionHeading } from './explore-section-heading';

const WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_TRENDING = 3;

const P = {
  sheet: '#F2EADB',
  paper: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  redText: '#A3261C',
  secondary: '#5E554A',
  rule: '#D9CFBF',
} as const;

function interactionScore(post: FeedItem): number {
  return post.supportCount + post.commentCount + post.echoCount;
}

/** As três publicações com mais interação nas últimas 48h. */
export function selectTrendingPosts(posts: FeedItem[], now = Date.now()): FeedItem[] {
  const seen = new Set<string>();
  return posts
    .filter((post) => {
      if (seen.has(post.id)) return false;
      // A fonte são comunas abertas e as comunas da pessoa, nunca o perfil isolado.
      if (post.comunaId === null || post.comuna?.status === 'archived') return false;
      seen.add(post.id);
      const createdAt = Date.parse(post.createdAt);
      if (!Number.isFinite(createdAt)) return false;
      const age = now - createdAt;
      return age >= 0 && age <= WINDOW_MS;
    })
    .sort((left, right) => interactionScore(right) - interactionScore(left) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_TRENDING);
}

function postTitle(post: FeedItem): string {
  return post.title?.trim() || post.text.trim() || 'Publicação sem texto';
}

function postContext(post: FeedItem): string {
  return post.comuna ? `c/ ${post.comuna.name}` : 'No perfil';
}

function postMeta(post: FeedItem): string {
  const comments = `${formatCount(post.commentCount)} ${post.commentCount === 1 ? 'comentário' : 'comentários'}`;
  const kind = post.poll ? ' · enquete' : chamadoCardFor(post) ? ' · chamado' : '';
  return `${comments} · ${formatRelative(post.createdAt)}${kind}`;
}

type TrendingNowProps = {
  posts: FeedItem[];
  onOpenPost: (post: FeedItem) => void;
  onSeeAll: () => void;
};

/** Card único com as três publicações mais quentes do momento. */
export function TrendingNowSection({ posts, onOpenPost, onSeeAll }: TrendingNowProps) {
  const shown = posts.slice(0, MAX_TRENDING);
  if (!shown.length) return null;

  return (
    <View style={styles.section}>
      <ExploreSectionHeading label="Em alta agora" actionLabel="Ver todas" onAction={onSeeAll} />
      <View style={styles.shadowWrap}>
        <View pointerEvents="none" style={styles.hardShadow} />
        <View style={styles.card}>
          {shown.map((post, index) => (
            <Pressable
              key={post.id}
              onPress={() => onOpenPost(post)}
              accessibilityRole="link"
              accessibilityLabel={`Abrir publicação de ${post.author.name}: ${postTitle(post)}`}
              accessibilityHint="Abre a publicação em alta"
              style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.rowPressed]}>
              <AppText style={styles.number} color={P.red} maxFontSizeMultiplier={1.2}>
                {String(index + 1).padStart(2, '0')}
              </AppText>
              <View style={styles.copy}>
                <AppText style={styles.context} color={P.redText} numberOfLines={1}>{postContext(post)}</AppText>
                <AppText style={styles.title} numberOfLines={3} ellipsizeMode="tail">{postTitle(post)}</AppText>
                <View style={styles.meta}>
                  <Icon name="comment" size={14} color={P.secondary} strokeWidth={2.4} />
                  <AppText style={styles.metaText} numberOfLines={1}>{postMeta(post)}</AppText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Esqueleto de três linhas dentro do mesmo card, sem animação durante a rolagem. */
export function TrendingNowSkeleton() {
  return (
    <View style={styles.section} testID="trending-skeleton" accessible accessibilityLabel="Carregando publicações em alta" accessibilityState={{ busy: true }}>
      <ExploreSectionHeading label="Em alta agora" />
      <View style={styles.shadowWrap}>
        <View pointerEvents="none" style={styles.hardShadow} />
        <View style={styles.card}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.row, index > 0 && styles.rowDivider]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.numberSkeleton} />
              <View style={styles.copy}>
                <View style={[styles.line, styles.contextSkeleton]} />
                <View style={[styles.line, styles.titleSkeleton]} />
                <View style={[styles.line, styles.titleSkeletonShort]} />
                <View style={[styles.line, styles.metaSkeleton]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  shadowWrap: {
    marginTop: 10,
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: P.ink,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.paper,
  },
  row: {
    minHeight: 92,
    flexDirection: 'row',
    gap: 6,
    padding: 12,
  },
  rowDivider: {
    borderTopWidth: 1.5,
    borderTopColor: P.rule,
  },
  rowPressed: {
    backgroundColor: P.sheet,
  },
  number: {
    width: 44,
    fontFamily: Fonts.anton,
    fontSize: 30,
    lineHeight: 38,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  context: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
  },
  meta: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: P.secondary,
  },
  numberSkeleton: {
    width: 32,
    height: 30,
    marginTop: 2,
    borderRadius: 2,
    backgroundColor: '#E8DDC8',
  },
  line: {
    height: 10,
    borderRadius: 2,
    backgroundColor: '#E8DDC8',
  },
  contextSkeleton: {
    width: '46%',
  },
  titleSkeleton: {
    width: '92%',
    height: 12,
    marginTop: 2,
  },
  titleSkeletonShort: {
    width: '68%',
  },
  metaSkeleton: {
    width: '54%',
    marginTop: 2,
  },
});
