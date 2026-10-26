import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { createComment, getComments, getDiscussionPost } from '@/features/discussion/api';
import { CommentComposer, type ComposerNotice } from '@/features/discussion/components/comment-composer';
import { CommentRow } from '@/features/discussion/components/comment-row';
import { PostDetail } from '@/features/discussion/components/post-detail';
import { buildThread, type CommentSort, type ThreadRow } from '@/features/discussion/thread';
import { useInteractions, withLocal } from '@/features/interactions/interactions-context';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { commentTarget, postTarget } from '@/features/moderation/targets';
import { useLocalFeedItems } from '@/features/posts/use-local-posts';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { ApiError, describeError, NotFoundError } from '@/lib/errors';
import { mergeById, singlePage } from '@/lib/pagination';
import { goBack, useNav } from '@/lib/routes';
import type { CommentWithAuthor, FeedItem } from '@/types/models';

/** Texto para as recusas conhecidas de POST /posts/{id}/comments. */
function commentErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.type === '/errors/email-not-verified') return 'Confirme seu e-mail para comentar.';
    if (error.type === '/errors/not-a-member') return 'Entre na comuna para comentar.';
    if (error.violations.parentId) return error.violations.parentId;
    if (error.status === 404) return 'Esta publicação não está mais disponível.';
  }
  return `Não foi possível enviar. ${describeError(error)}`;
}

/** Discussão de uma publicação, com comentários e respostas (design 1c). */
export default function DiscussionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Modo demonstração: publicações criadas neste aparelho não existem nos mocks e abrem sem comentários.
  const localPost = useLocalFeedItems((p) => p.id === id)[0] ?? null;
  const loadPost = useCallback(
    (): Promise<FeedItem> => (localPost ? Promise.resolve(localPost) : getDiscussionPost(id)),
    [id, localPost],
  );
  const loadComments = useCallback(
    (cursor: string | null) => (localPost ? Promise.resolve(singlePage([])) : getComments(id, cursor)),
    [id, localPost],
  );
  const discussion = useAsyncData(loadPost);
  const comments = usePaginatedData(loadComments);
  const { isOn, toggle, localCommentsFor, addComment, membershipOf, setOn, commentCountOf, noteCommentCount } =
    useInteractions();
  const { account, reloadAccount } = useAccount();
  const toast = useToast();
  const sheet = useActionsSheet();
  const nav = useNav();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [sort, setSort] = useState<CommentSort>('top');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  // Comentários enviados à API nesta tela: aparecem primeiro, como os locais.
  const [sentIds, setSentIds] = useState<string[]>([]);

  const me = useMe();
  const local = localCommentsFor(id);
  const post = discussion.data;

  // A contagem do servidor vale também para o cartão do feed ao voltar.
  useEffect(() => {
    if (!DEMO_MODE && post) noteCommentCount(post.id, post.commentCount);
  }, [post, noteCommentCount]);

  // As permissões da publicação (canComment) dependem do e-mail confirmado: recarrega quando ele muda.
  const emailVerified = account?.emailVerified ?? true;
  const seenVerified = useRef(emailVerified);
  const { reload: reloadPost } = discussion;
  const focusedOnce = useRef(false);
  const refreshComments = comments.refresh;
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current && !DEMO_MODE) {
      reloadPost();
      refreshComments();
    }
    focusedOnce.current = true;
  }, [reloadPost, refreshComments]));
  useEffect(() => {
    if (seenVerified.current === emailVerified) return;
    seenVerified.current = emailVerified;
    reloadPost();
  }, [emailVerified, reloadPost]);

  const rows = useMemo(() => {
    if (!post) return [];
    const mine: CommentWithAuthor[] = local.map((c) => ({ ...c, author: me }));
    return buildThread(mergeById(comments.items, mine), {
      sort,
      collapsed,
      localIds: new Set([...local.map((c) => c.id), ...sentIds]),
      supportOf: (c) => withLocal(c.supportCount, isOn('supportedComments', c.id)),
    });
  }, [post, comments.items, local, me, sort, collapsed, sentIds, isOn]);

  const onSupport = useCallback((commentId: string) => toggle('supportedComments', commentId), [toggle]);
  const onToggleCollapse = useCallback(
    (commentId: string) => setCollapsed((prev) => ({ ...prev, [commentId]: !prev[commentId] })),
    [],
  );
  const onMore = useCallback(
    (row: ThreadRow) => {
      if (post) sheet.open(commentTarget(row.comment, post));
    },
    [post, sheet],
  );
  const onReply = useCallback((row: ThreadRow) => {
    setReplyTo({ id: row.comment.id, name: row.comment.author.name });
    inputRef.current?.focus();
  }, []);

  const afterSend = () => {
    if (replyTo) setCollapsed((prev) => ({ ...prev, [replyTo.id]: false }));
    setReplyTo(null);
  };

  const onSend = async (text: string): Promise<boolean> => {
    if (DEMO_MODE || !post) {
      addComment({ postId: id, parentId: replyTo?.id ?? null, text });
      afterSend();
      toast.show('Comentário adicionado só neste aparelho. Nada foi publicado.');
      return true;
    }
    try {
      const created = await createComment({ postId: id, parentId: replyTo?.id ?? null, text });
      comments.append(created);
      setSentIds((prev) => [...prev, created.id]);
      noteCommentCount(id, commentCountOf(id, post.commentCount) + 1);
      afterSend();
      toast.show(replyTo ? 'Resposta publicada.' : 'Comentário publicado.');
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        // O servidor recusou: atualiza o que a tela sabe, para o aviso certo aparecer no lugar do campo.
        if (error.type === '/errors/email-not-verified') reloadAccount().catch(() => {});
        if (error.type === '/errors/not-a-member' && post.comuna) setOn('joinedComunas', [post.comuna.id], false);
        if (error.violations.parentId) setReplyTo(null);
      }
      toast.show(commentErrorMessage(error));
      return false;
    }
  };

  if (!post) {
    if (discussion.status === 'loading') {
      return (
        <Screen>
          <DiscussionHeader />
          <StateView kind="loading" message="Carregando discussão" />
        </Screen>
      );
    }
    const notFound = discussion.error instanceof NotFoundError;
    return (
      <Screen>
        <DiscussionHeader />
        {notFound ? (
          <StateView kind="empty" title="Publicação não encontrada" message="Ela pode ter sido removida." />
        ) : (
          <StateView
            kind="error"
            message={`Não conseguimos carregar a discussão. ${describeError(discussion.error)}`}
            onRetry={discussion.reload}
          />
        )}
      </Screen>
    );
  }

  // Nos mocks o selo vem pronto ("Autora", "Autor"); na API, sem gênero informado, fica "Autoria".
  const authorLabel = post.authorLabel ?? (post.viewer ? 'Autoria' : 'Autora');

  function composerNotice(item: FeedItem): ComposerNotice | null {
    if (DEMO_MODE) return null;
    if (item.comuna?.status === 'archived') {
      return { message: 'Esta comuna está arquivada. A discussão é somente para leitura.' };
    }
    // E-mail não confirmado não encerra a sessão: a pessoa continua lendo e pode confirmar agora.
    if (account && !account.emailVerified) {
      return {
        message: 'Confirme seu e-mail para comentar. Você continua com a sessão aberta.',
        actionLabel: 'Confirmar',
        onAction: () => router.push('/verificar-email'),
      };
    }
    // Com o e-mail confirmado, canComment = false numa comuna significa que a pessoa não participa dela.
    const comuna = item.comuna;
    if (comuna && (!(membershipOf(comuna.id) ?? true) || item.viewer?.canComment === false)) {
      return {
        message: `Participe de c/ ${comuna.name} para comentar.`,
        actionLabel: 'Ver comuna',
        onAction: () => nav.openComuna(comuna.id),
      };
    }
    return null;
  }
  const notice = composerNotice(post);

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardView style={styles.flex}>
        <DiscussionHeader comuna={post.comuna} onMore={() => sheet.open(postTarget(post))} />
        <FlatList
          data={rows}
          keyExtractor={(row) => row.comment.id}
          renderItem={({ item }) => (
            <CommentRow
              row={item}
              authorLabel={item.comment.authorId === post.authorId ? authorLabel : null}
              supported={isOn('supportedComments', item.comment.id)}
              supportCount={withLocal(item.comment.supportCount, isOn('supportedComments', item.comment.id))}
              onSupport={onSupport}
              onReply={notice ? undefined : onReply}
              onToggleCollapse={onToggleCollapse}
              onMore={onMore}
            />
          )}
          ListHeaderComponent={<PostDetail post={post} sort={sort} onSortChange={setSort} />}
          ListEmptyComponent={
            comments.status === 'loading' ? (
              <StateView kind="loading" message="Carregando comentários" />
            ) : comments.status === 'error' ? (
              <StateView
                kind="error"
                message={`Não conseguimos carregar os comentários. ${describeError(comments.error)}`}
                onRetry={comments.refresh}
              />
            ) : (
              <AppText style={styles.empty} color={Colors.muted}>
                Ninguém comentou ainda. Abra a conversa.
              </AppText>
            )
          }
          ListFooterComponent={
            comments.loadMoreError ? (
              <StateView kind="error" message="Não conseguimos carregar mais comentários." onRetry={comments.loadMore} />
            ) : comments.hasMore ? (
              <PillButton
                label={comments.loadingMore ? 'Carregando…' : 'Carregar mais comentários'}
                onPress={comments.loadMore}
                disabled={comments.loadingMore}
                variant="outline"
                style={styles.more}
              />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.list}
        />
        <CommentComposer
          key={id}
          me={me}
          replyingTo={replyTo?.name ?? null}
          onCancelReply={() => setReplyTo(null)}
          onSend={onSend}
          notice={notice}
          inputRef={inputRef}
        />
      </KeyboardView>
    </Screen>
  );
}

type HeaderProps = {
  comuna?: { id: string; name: string } | null;
  /** Ausente enquanto a publicação carrega. */
  onMore?: () => void;
};

function DiscussionHeader({ comuna, onMore }: HeaderProps) {
  const nav = useNav();
  return (
    <View style={styles.header}>
      <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
      <View style={styles.headerTitle}>
        <AppText variant="heading" accessibilityRole="header">
          Discussão
        </AppText>
        {comuna ? (
          <Pressable
            onPress={() => nav.openComuna(comuna.id)}
            accessibilityRole="link"
            accessibilityLabel={`Comuna ${comuna.name}`}
            hitSlop={{ top: 6, bottom: 10, left: 8, right: 8 }}>
            <AppText style={styles.comunaLink} color={Colors.red} numberOfLines={1}>
              c/ {comuna.name}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {onMore ? (
        <IconButton icon="more" size={20} accessibilityLabel="Mais opções da publicação" onPress={onMore} />
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  more: {
    alignSelf: 'center',
    marginVertical: Spacing.five,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  comunaLink: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.seven,
  },
  empty: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
    fontSize: 14.5,
  },
});
