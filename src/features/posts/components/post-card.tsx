import { preparePost } from '@/features/posts/queries';
import { prepareComuna } from '@/features/comunas/queries';
import { prepareProfileFromUser } from '@/features/profiles/queries';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Kicker } from '@/components/kicker';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useInteractions } from '@/features/interactions/interactions-context';
import { usePostActions } from '@/features/interactions/use-post-actions';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { postTarget } from '@/features/moderation/targets';
import { useMediaVisible } from '@/hooks/use-list-visibility';
import { useReactionFeedback } from '@/hooks/use-reaction-feedback';
import { formatCount, formatRelative } from '@/lib/format';
import { withPerformanceProfiler } from '@/lib/performance/profiler';
import { useNav } from '@/lib/routes';
import type { FeedItem } from '@/types/models';

import { ChamadoAuthorLine, ChamadoCard } from '@/features/events/chamado-card';
import { chamadoCardFor } from '@/features/events/chamado-data';
import { DocumentCard } from '@/features/library/document-card';

import { AuthorLine } from './author-line';
import { MediaBox } from './media-box';
import { PostAttachment } from './post-attachment';
import { PostBody } from './post-body';
import { PostImages } from './post-images';
import { PostPollBlock } from './post-poll';

type PostCardProps = {
  item: FeedItem;
  /**
   * Só monta o player quando a lista confirma que o item está na viewport.
   * O default é seguro: um cartão montado fora de uma lista (ou sem viewability)
   * não inicia reprodução. Quando omitido, o cartão assina a viewport pelo
   * `postId` no provider da lista; um valor explícito vence a assinatura.
   */
  mediaVisible?: boolean;
  /** Linha divisória no topo (todos menos o primeiro). */
  showRule?: boolean;
  /** Na página da própria comuna, o rótulo "c/ …" é redundante. */
  showComuna?: boolean;
  /** No perfil de quem foi silenciado, as publicações continuam visíveis. */
  showMuted?: boolean;
  /** Gesto externo que deve ceder aos controles nativos do vídeo. */
  mediaGesture?: PanGesture | null;
};

/**
 * Publicação no feed, no perfil e na página da comuna.
 *
 * O cartão é o mesmo nos três lugares: primeiro onde foi publicado (a comuna ou o perfil),
 * depois quem publicou, com foto e nome. O selo do tipo (Chamado, Enquete) fica na mesma
 * linha do destino, como no desenho do feed.
 */
function PostCardView({ item, showRule = false, showComuna = true, showMuted = false, mediaVisible: mediaVisibleOverride, mediaGesture }: PostCardProps) {
  const mediaVisible = useMediaVisible(item.id, mediaVisibleOverride);
  const { author, comuna, media, topComment, topCommentAuthor } = item;
  const actions = usePostActions(item);
  // O salvar é só ícone: o pulso fica no próprio botão de 44, sem tocar no cartão.
  const saveFeedback = useReactionFeedback(actions.saved);
  const nav = useNav();
  const sheet = useActionsSheet();
  const { isOn } = useInteractions();
  const chamado = useMemo(() => chamadoCardFor(item), [item]);
  // O prefetch acontece no toque inicial; o toque final só navega. Assim um
  // toque cancelado ou um long press não repete a leitura, e a tela de destino
  // usa o cache aquecido (ou busca por conta própria, se o prefetch falhar).
  const prefetchPost = () => { void preparePost(item); };
  const open = () => nav.openPost(item.id);
  // Na API, só o próprio perfil abre (perfis de outras pessoas ainda são fictícios).
  const openAuthor = !item.viewer
    ? () => nav.openProfile(author.id)
    : item.viewer.isAuthor
      ? () => nav.openProfile('me')
      : undefined;
  const prefetchAuthor = openAuthor
    ? () => { void prepareProfileFromUser(author, !!item.viewer?.isAuthor); }
    : undefined;
  const prefetchComuna = comuna ? () => { void prepareComuna(comuna.id); } : undefined;

  if (!showMuted && isOn('mutedUsers', author.handle)) return null;
  const topCommentMuted = topCommentAuthor ? isOn('mutedUsers', topCommentAuthor.handle) : false;

  const hasTitle = !!item.title?.trim();
  const bodyBlock = item.text.trim().length > 0 || (item.images && item.images.length > 0) ? (
    <Pressable
      onPress={open}
      onPressIn={prefetchPost}
      accessibilityRole="button"
      accessibilityHint="Abre a discussão"
      style={styles.body}>
      {item.text.trim().length > 0 ? <PostBody text={item.text} mentions={item.mentions} style={styles.bodyText} /> : null}
      {item.images && item.images.length > 0 ? <PostImages images={item.images} /> : null}
    </Pressable>
  ) : null;

  // Onde foi publicado. Sem comuna, a publicação é do perfil de quem escreveu.
  const origin = comuna
    ? `c/ ${comuna.name}`
    : item.viewer?.isAuthor
      ? 'No seu perfil'
      : `No perfil de @${author.handle}`;
  const showOrigin = showComuna || !comuna;
  const tag = item.poll ? 'Enquete' : null;
  const replies = actions.commentCount === 1
    ? 'Ver a resposta'
    : actions.commentCount > 1
      ? `Ver as ${formatCount(actions.commentCount)} respostas`
      : 'Ver a discussão';

  const actionsRow = (
    <View style={styles.actions}>
      <ActionChip
        icon="support"
        count={actions.supportCount}
        active={actions.supported}
        label="Apoiar"
        onPress={actions.toggleSupport}
      />
      <ActionChip icon="comment" count={actions.commentCount} label="Comentar" onPress={open} onPressIn={prefetchPost} />
      <ActionChip
        icon="echo"
        count={actions.echoCount}
        active={actions.echoed}
        label="Ecoar"
        onPress={actions.toggleEcho}
      />
      <View style={styles.spacer} />
      <Animated.View style={saveFeedback}>
        <IconButton
          icon="bookmark"
          accessibilityLabel={actions.saved ? 'Remover dos salvos' : 'Salvar'}
          selected={actions.saved}
          filled={actions.saved}
          color={actions.saved ? Colors.red : Colors.ink}
          size={20}
          onPress={actions.toggleSave}
          style={styles.saveChip}
        />
      </Animated.View>
    </View>
  );

  const more = (
    <IconButton icon="more" accessibilityLabel="Mais opções" onPress={() => sheet.open(postTarget(item))} size={20} style={styles.more} />
  );

  // Chamado: o cartão substitui o texto e o título da publicação; o título aparece só nele.
  if (chamado) {
    return (
      <View style={[styles.card, showRule && styles.rule]}>
        <ChamadoAuthorLine author={author} origin={showComuna || !comuna ? origin : ''} meta={formatRelative(item.createdAt)} onPress={openAuthor} onPressIn={prefetchAuthor} trailing={more} />
        <ChamadoCard data={chamado} />
        {item.attachment && item.attachment.type !== 'image' ? <PostAttachment
          key={item.attachment.id}
          media={item.attachment}
          visible={mediaVisible}
          framed
          chrome={{
            author: item.author,
            comuna: item.comuna,
            text: item.text,
            supportCount: actions.supportCount,
            supported: actions.supported,
            onSupport: actions.toggleSupport,
            commentCount: actions.commentCount,
            onComment: open,
            echoCount: actions.echoCount,
            echoed: actions.echoed,
            onEcho: actions.toggleEcho,
            saved: actions.saved,
            onSave: actions.toggleSave,
          }}
        /> : null}
        {actionsRow}
      </View>
    );
  }

  return (
    <View style={[styles.card, showRule && styles.rule]}>
      {showOrigin || tag ? (
        <View style={[styles.originRow, !showOrigin && styles.originRowEnd]}>
          {showOrigin ? (
            comuna ? (
              <Pressable
                onPress={() => nav.openComuna(comuna.id)}
                onPressIn={prefetchComuna}
                accessibilityRole="link"
                accessibilityLabel={`Comuna ${comuna.name}`}
                hitSlop={{ top: 12, bottom: 8 }}
                style={styles.originLink}>
                <Kicker label={origin} color={Colors.red} textStyle={styles.originLabel} />
              </Pressable>
            ) : <Kicker label={origin} color={Colors.red} textStyle={styles.originLabel} />
          ) : null}
          {tag ? (
            <View style={styles.tag}>
              <AppText style={styles.tagText} maxFontSizeMultiplier={1.2}>{tag}</AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      <AuthorLine
        author={author}
        meta={formatRelative(item.createdAt)}
        onPress={openAuthor}
        onPressIn={prefetchAuthor}
        appearance="card"
        trailing={more}
      />

      {hasTitle ? <AppText style={styles.title}>{item.title}</AppText> : null}
      {hasTitle ? bodyBlock : null}

      {item.attachment ? <PostAttachment
        key={item.attachment.id}
        media={item.attachment}
        visible={mediaVisible}
        framed
        chrome={{
          author: item.author,
          comuna: item.comuna,
          text: item.text,
          supportCount: actions.supportCount,
          supported: actions.supported,
          onSupport: actions.toggleSupport,
          commentCount: actions.commentCount,
          onComment: open,
          echoCount: actions.echoCount,
          echoed: actions.echoed,
          onEcho: actions.toggleEcho,
          saved: actions.saved,
          onSave: actions.toggleSave,
        }}
      /> : null}

      {hasTitle ? null : bodyBlock}

      {/* O anexo mantém o mesmo cartão da seção "Documentos públicos" da biblioteca. */}
      {item.document ? <DocumentCard document={item.document} appearance="editorial" /> : null}
      {item.poll ? <PostPollBlock postId={item.id} poll={item.poll} /> : null}
      {media ? (
        <Pressable onPress={open} onPressIn={prefetchPost} accessibilityRole="button" accessibilityHint="Abre a discussão">
          <MediaBox media={media} />
        </Pressable>
      ) : null}

      {topComment && topCommentAuthor && !topCommentMuted ? (
        <Pressable
          onPress={open}
          onPressIn={prefetchPost}
          style={({ pressed }) => [styles.topComment, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Comentário de ${topCommentAuthor.name}: ${topComment.text}. ${replies}`}
          accessibilityHint="Abre a discussão">
          <AppText numberOfLines={3} style={styles.topCommentText}>
            <AppText style={[styles.topCommentText, styles.bold]}>{topCommentAuthor.name}:</AppText>{' '}
            {topComment.text}
          </AppText>
          <AppText style={styles.topCommentLink}>{replies}</AppText>
        </Pressable>
      ) : null}

      {actionsRow}
    </View>
  );
}

export const PostCard = memo(withPerformanceProfiler('PostCard', PostCardView));

type ActionChipProps = {
  icon: IconName;
  count: number;
  label: string;
  onPress: () => void;
  /** Ações que abrem a publicação podem aquecer o detalhe no toque inicial. */
  onPressIn?: () => void;
  /** Ausente em ações que não são alternância (Comentar). */
  active?: boolean;
};

function ActionChip({ icon, count, label, onPress, onPressIn, active }: ActionChipProps) {
  const color = active ? Colors.red : Colors.ink;
  // Comentar é navegação, não alternância: o contador dele não deve pulsar.
  const material = useReactionFeedback(active === undefined ? 'comment' : active);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatCount(count)}`}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <Animated.View style={[styles.chipContent, material]}>
        <Icon name={icon} size={18} color={color} filled={icon === 'support' && active} />
        <AppText style={styles.chipCount} color={color}>
          {formatCount(count)}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 12,
  },
  rule: {
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
  },
  originRow: {
    minHeight: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  originRowEnd: {
    justifyContent: 'flex-end',
  },
  originLink: {
    flexShrink: 1,
  },
  originLabel: {
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.2,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 3,
    backgroundColor: Colors.paper,
  },
  tagText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 18,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  more: {
    marginRight: -12,
  },
  body: {
    gap: Spacing.two + 2,
  },
  bodyText: {
    fontSize: 17,
    lineHeight: 25.5,
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontSize: 22,
    lineHeight: 30,
  },
  topComment: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: Spacing.one,
  },
  topCommentText: {
    fontSize: 14,
    lineHeight: 19.6,
  },
  topCommentLink: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
    textDecorationLine: 'underline',
  },
  bold: {
    fontFamily: Fonts.bold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipCount: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.6,
  },
  spacer: {
    flex: 1,
  },
  saveChip: {
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
});
