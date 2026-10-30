import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Kicker } from '@/components/kicker';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { acknowledgeGamification } from '@/features/gamification/feedback';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { voteOnPoll } from '@/features/posts/api';
import { applyPollVote, patchCachedPoll, pollsMatch, restorePostCaches, snapshotPostCaches, type PostPoll } from '@/features/posts/poll';
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

  const vote = (optionId: string) => {
    if (inflight.current || shown.votedOptionId === optionId || !shown.options.some((option) => option.id === optionId)) return;
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

  const voted = shown.votedOptionId !== null;

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Kicker label="Enquete" />
        {voted || shown.totalVotes > 0 ? <AppText variant="caption" color={Colors.inkSoft}>{plural(shown.totalVotes, 'voto', 'votos')}</AppText> : null}
      </View>
      <AppText style={styles.question}>{shown.question}</AppText>
      <View style={styles.options}>
        {shown.options.map((option) => {
          const selected = option.selected;
          return (
            <Pressable
              key={option.id}
              onPress={() => vote(option.id)}
              accessibilityRole="button"
              accessibilityLabel={voted ? `${option.label}, ${option.percent}%, ${plural(option.voteCount, 'voto', 'votos')}${selected ? ', seu voto' : ''}` : `Votar em ${option.label}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
              {voted ? <View pointerEvents="none" style={[styles.fill, { width: `${option.percent}%` }]} /> : null}
              <View style={styles.optionRow}>
                {voted ? (selected ? <View style={styles.marker} /> : <View style={styles.markerSpacer} />) : null}
                <AppText style={styles.optionLabel} color={Colors.ink}>{option.label}</AppText>
                {voted ? <AppText style={styles.percent} color={selected ? Colors.ink : Colors.inkSoft}>{`${option.percent}%`}</AppText> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.two,
    padding: Spacing.three,
    // Palha identifica a área de votação, como os grupos de filtro; a borda define a peça
    // contra o creme da tela, onde a diferença de preenchimento sozinha é sutil.
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.strawLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  question: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.ink,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  optionSelected: {
    borderWidth: 1.5,
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  marker: {
    width: 8,
    height: 8,
    backgroundColor: Colors.red,
  },
  markerSpacer: {
    width: 8,
    height: 8,
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
});
