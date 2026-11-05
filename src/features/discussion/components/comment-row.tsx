import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { PostBody } from '@/features/posts/components/post-body';
import { formatCount, formatRelative, plural } from '@/lib/format';
import { withPerformanceProfiler } from '@/lib/performance/profiler';

import { MAX_VISUAL_DEPTH, type ThreadRow } from '../thread';

type CommentRowProps = {
  row: ThreadRow;
  /** Selo de autoria quando quem comenta é quem publicou ("Autora", "Autor"). */
  authorLabel: string | null;
  supported: boolean;
  supportCount: number;
  onSupport: (id: string) => void;
  onReply?: (commentId: string) => void;
  onToggleCollapse: (id: string) => void;
  /** Abre o menu "⋯" (silenciar, denunciar). */
  onMore: (commentId: string) => void;
};

/** Comentário com recuo e trilho à esquerda conforme a profundidade (design 1c). */
function CommentRowView({
  row,
  authorLabel,
  supported,
  supportCount,
  onSupport,
  onReply,
  onToggleCollapse,
  onMore,
}: CommentRowProps) {
  const { comment, replyCount, collapsed } = row;
  const depth = Math.min(row.depth, MAX_VISUAL_DEPTH);
  const time = formatRelative(comment.createdAt);
  const color = supported ? Colors.red : Colors.inkSoft;
  const indent = depth > 0 && { marginLeft: 14 + (depth - 1) * 28, ...styles.reply };

  // Apagado, removido ou oculto por bloqueio: só o aviso, sem autoria nem ações (as respostas continuam).
  if (comment.status && comment.status !== 'published') {
    return (
      <View style={[styles.row, indent]}>
        <View style={styles.body}>
          <AppText style={[styles.text, styles.placeholder]} color={Colors.muted}>
            {comment.text}
          </AppText>
          {replyCount > 0 ? (
            <View style={styles.actions}>
              <CollapseButton id={comment.id} replyCount={replyCount} collapsed={collapsed} onPress={onToggleCollapse} />
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, indent]}>
      <Avatar initials={comment.author.initials} tone={comment.author.tone} size={30} shape="square" outline font="anton" userId={comment.author.id} imageUrl={comment.author.avatarUrl} />
      <View style={styles.body}>
        <View
          style={styles.header}
          accessible
          accessibilityLabel={`${row.depth > 0 ? 'Resposta de' : 'Comentário de'} ${comment.author.name}${authorLabel ? `, ${authorLabel}` : ''}, ${time}`}>
          <AppText style={styles.name}>{comment.author.name}</AppText>
          {authorLabel ? <Badge label={authorLabel} tone="red" /> : null}
          {comment.author.badge ? <Badge label={comment.author.badge} /> : null}
          <AppText style={styles.time} color={Colors.muted}>
            {time}
          </AppText>
        </View>
        <PostBody text={comment.text} mentions={comment.mentions} hashtagsEnabled={false} style={styles.text} />
        <View style={styles.actions}>
          <Pressable
            onPress={() => onSupport(comment.id)}
            accessibilityRole="button"
            accessibilityLabel={`Apoiar comentário, ${formatCount(supportCount)}`}
            accessibilityState={{ selected: supported }}
            style={styles.action}>
            <Icon name="support" size={17} color={color} filled={supported} />
            <AppText style={styles.actionLabel} color={color}>
              {formatCount(supportCount)}
            </AppText>
          </Pressable>
          {onReply ? (
            <Pressable
              onPress={() => onReply(comment.id)}
              accessibilityRole="button"
              accessibilityLabel={`Responder a ${comment.author.name}`}
              style={styles.action}>
              <AppText style={styles.actionLabel} color={Colors.inkSoft}>
                Responder
              </AppText>
            </Pressable>
          ) : null}
          {replyCount > 0 ? (
            <CollapseButton id={comment.id} replyCount={replyCount} collapsed={collapsed} onPress={onToggleCollapse} />
          ) : null}
          <View style={styles.spacer} />
          <IconButton
            icon="more"
            size={18}
            color={Colors.muted}
            accessibilityLabel={`Mais opções do comentário de ${comment.author.name}`}
            onPress={() => onMore(comment.id)}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Compara o conteúdo da linha, não a identidade do objeto `ThreadRow`.
 * A árvore é reconstruída quando a ordem por apoio muda; comparar o objeto inteiro
 * acordaria todos os irmãos por causa de uma única linha apoiada.
 */
function sameCommentRowProps(previous: CommentRowProps, next: CommentRowProps): boolean {
  return previous.row.comment === next.row.comment
    && previous.row.depth === next.row.depth
    && previous.row.replyCount === next.row.replyCount
    && previous.row.collapsed === next.row.collapsed
    && previous.authorLabel === next.authorLabel
    && previous.supported === next.supported
    && previous.supportCount === next.supportCount
    && previous.onSupport === next.onSupport
    && previous.onReply === next.onReply
    && previous.onToggleCollapse === next.onToggleCollapse
    && previous.onMore === next.onMore;
}

export const CommentRow = memo(withPerformanceProfiler('CommentRow', CommentRowView), sameCommentRowProps);

type CollapseButtonProps = {
  id: string;
  replyCount: number;
  collapsed: boolean;
  onPress: (id: string) => void;
};

function CollapseButton({ id, replyCount, collapsed, onPress }: CollapseButtonProps) {
  return (
    <Pressable
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      style={styles.action}>
      <AppText style={styles.actionLabel} color={Colors.red}>
        {collapsed ? `Ver ${plural(replyCount, 'resposta', 'respostas')}` : 'Ocultar'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  reply: {
    paddingLeft: Spacing.three,
    borderLeftWidth: 2,
    borderLeftColor: Colors.rule,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 20,
  },
  name: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  time: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginLeft: -8,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  spacer: {
    flex: 1,
  },
  actionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
});
