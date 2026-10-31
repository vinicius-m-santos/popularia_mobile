import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { acknowledgeGamification } from '@/features/gamification/feedback';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { voteOnPoll } from '@/features/posts/api';
import { applyPollVote, patchCachedPoll, pollDeadlineLabel, pollIsClosed, pollsMatch, restorePostCaches, snapshotPostCaches, type PostPoll } from '@/features/posts/poll';
import { queryClient } from '@/lib/query/client';
import { ApiError, describeError } from '@/lib/errors';
import { plural } from '@/lib/format';

type PostPollProps = {
  postId: string;
  poll: PostPoll;
};

function voteError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.type === '/errors/email-not-verified') return 'Confirme seu e-mail para votar.';
    if (error.type === '/errors/not-a-member') return 'Entre na comuna para votar.';
    if (error.type === '/errors/comuna-archived') return 'Esta comuna está arquivada.';
    if (error.type === '/errors/poll-closed') return 'Esta enquete já encerrou.';
    if (error.status === 404) return 'Esta publicação não está mais disponível.';
    if (error.violations.optionId) return error.violations.optionId;
  }
  return `Não foi possível votar. ${describeError(error)}`;
}

/**
 * Enquete dentro do cartão. A chave é o id da publicação: uma célula reaproveitada
 * pelo FlashList não conserva o voto da publicação anterior. O cache só troca este item.
 */
export function PostPollBlock({ postId, poll }: PostPollProps) {
  return <PollCard key={postId} postId={postId} poll={poll} />;
}

function PollCard({ postId, poll }: PostPollProps) {
  const toast = useToast();
  const { account } = useAccount();
  const [override, setOverride] = useState<PostPoll | null>(null);
  if (override && pollsMatch(override, poll)) setOverride(null);
  const shown = override && !pollsMatch(override, poll) ? override : poll;
  const inflight = useRef(false);
  const closed = pollIsClosed(shown.endsAt);
  const deadline = pollDeadlineLabel(shown.endsAt);

  const vote = (optionId: string) => {
    if (closed || inflight.current || shown.votedOptionId === optionId || !shown.options.some((option) => option.id === optionId)) return;
    const next = applyPollVote(shown, optionId);
    if (DEMO_MODE || postId === 'preview' || postId.startsWith('local-')) {
      setOverride(next);
      return;
    }
    const snapshots = snapshotPostCaches(postId);
    inflight.current = true;
    setOverride(next);
    patchCachedPoll(postId, next);
    void queryClient.cancelQueries({ queryKey: ['post', postId], exact: true });
    voteOnPoll(postId, optionId).then((item) => {
      if (!item.poll) return;
      setOverride(item.poll);
      patchCachedPoll(postId, item.poll);
      acknowledgeGamification(account?.id, toast.show);
    }, (error: unknown) => {
      restorePostCaches(snapshots);
      setOverride(null);
      toast.show(voteError(error));
    }).finally(() => {
      inflight.current = false;
    });
  };

  // Encerrada, a enquete mostra o resultado mesmo para quem não votou: não há mais escolha.
  const voted = shown.votedOptionId !== null || closed;

  return (
    <View style={styles.shadow}>
      <View style={styles.box}>
        <View style={styles.header}>
          <AppText style={styles.headerLabel} color={Colors.cream}>ENQUETE</AppText>
          <AppText style={styles.headerLabel} color={Colors.cream} numberOfLines={1}>
            {deadline ?? (shown.totalVotes > 0 ? plural(shown.totalVotes, 'voto', 'votos') : '')}
          </AppText>
        </View>
        <View style={styles.content}>
          <AppText style={styles.question}>{shown.question}</AppText>
          <View style={styles.options}>
            {shown.options.map((option, index) => {
              const selected = option.selected;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => vote(option.id)}
                  disabled={closed}
                  accessibilityRole="button"
                  accessibilityLabel={voted ? `${option.label}, ${option.percent}%, ${plural(option.voteCount, 'voto', 'votos')}${selected ? ', seu voto' : ''}` : `Votar em ${option.label}`}
                  accessibilityState={{ selected, disabled: closed }}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && !closed && styles.optionPressed]}>
                  {voted ? <View pointerEvents="none" style={[styles.fill, { width: `${option.percent}%` }]} /> : null}
                  <View style={styles.optionRow}>
                    <View style={styles.letter}>
                      <AppText style={styles.letterText} color={Colors.cream} maxFontSizeMultiplier={1.2}>
                        {String.fromCharCode(65 + index)}
                      </AppText>
                    </View>
                    <AppText style={styles.optionLabel} color={Colors.ink}>{option.label}</AppText>
                    {voted ? <AppText style={styles.percent} color={selected ? Colors.ink : Colors.inkSoft}>{`${option.percent}%`}</AppText> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <AppText variant="caption" style={styles.note}>
            {closed
              ? 'Enquete encerrada.'
              : voted
                ? 'Você votou. Toque em outra opção para trocar.'
                : 'Toque pra votar. O resultado aparece depois do seu voto.'}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  box: {
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  header: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    backgroundColor: Colors.ink,
  },
  headerLabel: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: Spacing.three + 2,
  },
  question: {
    fontFamily: Fonts.anton,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
    color: Colors.ink,
    marginBottom: Spacing.one,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.cream,
    overflow: 'hidden',
  },
  optionSelected: {
    backgroundColor: Colors.strawLight,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.straw,
  },
  optionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  letter: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.red,
  },
  letterText: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: 24,
  },
  optionLabel: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  percent: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  optionPressed: {
    backgroundColor: Colors.strawLight,
  },
  note: {
    marginTop: Spacing.one,
  },
});
