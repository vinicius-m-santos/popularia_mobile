import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { PostPollBlock } from '@/features/posts/components/post-poll';
import { voteOnPoll } from '@/features/posts/api';
import { applyPollVote, patchCachedPoll, pollDraftError, pollPercents, type PostPoll } from '@/features/posts/poll';
import { NetworkError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/posts/api', () => ({ voteOnPoll: jest.fn() }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

function poll(question: string, labels: string[], votedIndex: number | null = null): PostPoll {
  const counts = labels.map((_, index) => (votedIndex === index ? 1 : 0));
  const percents = pollPercents(counts);
  return {
    id: 'poll-1',
    question,
    totalVotes: votedIndex === null ? 0 : 1,
    votedOptionId: votedIndex === null ? null : `opt-${votedIndex}`,
    options: labels.map((label, index) => ({
      id: `opt-${index}`,
      label,
      voteCount: counts[index] ?? 0,
      percent: percents[index] ?? 0,
      selected: votedIndex === index,
    })),
  };
}

function item(value: PostPoll, id = 'post-1'): FeedItem {
  return {
    id,
    authorId: 'ana',
    comunaId: null,
    createdAt: '2026-10-29T12:00:00+00:00',
    text: 'Contexto',
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    poll: value,
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null,
    event: null,
    topCommentAuthor: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
});

afterEach(() => {
  queryClient.clear();
});

describe('resultados da enquete', () => {
  it('soma 100 quando há votos e fica em zero quando não há', () => {
    expect(pollPercents([0, 0, 0])).toEqual([0, 0, 0]);
    expect(pollPercents([1, 0])).toEqual([100, 0]);
    expect(pollPercents([2, 1])).toEqual([67, 33]);
    expect(pollPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(pollPercents([1, 1, 1]).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('recusa rascunho inválido', () => {
    expect(pollDraftError({ question: '  ', options: [{ key: 'a', label: 'Um' }, { key: 'b', label: 'Dois' }] })).toMatch(/pergunta/);
    expect(pollDraftError({ question: 'Qual?', options: [{ key: 'a', label: 'Um' }] })).toMatch(/duas/);
    expect(pollDraftError({ question: 'Qual?', options: [{ key: 'a', label: 'Igual' }, { key: 'b', label: ' igual ' }] })).toMatch(/diferentes/);
    expect(pollDraftError({ question: 'Qual?', options: [{ key: 'a', label: 'Um' }, { key: 'b', label: 'Dois' }] })).toBeNull();
  });

  it('troca o voto sem somar dois na mesma opção', () => {
    const base = poll('Qual horário?', ['Manhã', 'Noite']);
    const morning = applyPollVote(base, 'opt-0');
    expect(morning).toMatchObject({ totalVotes: 1, votedOptionId: 'opt-0', options: [{ voteCount: 1, percent: 100, selected: true }, { voteCount: 0, percent: 0, selected: false }] });
    expect(applyPollVote(morning, 'opt-0')).toBe(morning);
    const night = applyPollVote(morning, 'opt-1');
    expect(night.totalVotes).toBe(1);
    expect(night.options.map((option) => option.voteCount)).toEqual([0, 1]);
    expect(night.options.map((option) => option.percent).reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});

describe('voto na interface', () => {
  it('mostra as opções antes do voto e o resultado depois, e desfaz se a API falhar', async () => {
    const base = poll('Qual livro vamos ler?', ['O cortiço', 'Capitães da Areia']);
    const post = item(base);
    const other = item(poll('Outra', ['A', 'B']), 'post-2');
    const page = { pages: [{ items: [post, other], nextCursor: null }], pageParams: [null] };
    queryClient.setQueryData(['feed', 'para-voce', ''], page);
    queryClient.setQueryData(['profile-posts', 'ana'], { pages: [{ items: [post], nextCursor: null }], pageParams: [null] });
    queryClient.setQueryData(['post', post.id], post);
    queryClient.setQueryData(['post-preview', post.id], post);
    let reject: (error: unknown) => void = () => {};
    jest.mocked(voteOnPoll).mockReturnValue(new Promise((_, fail) => { reject = fail; }));

    await render(<PostPollBlock postId={post.id} poll={base} />);
    expect(screen.getByText('Qual livro vamos ler?')).toBeTruthy();
    expect(screen.queryByText('100%')).toBeNull();
    expect(screen.queryByText(/voto/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Votar em O cortiço'));
    expect(screen.getByLabelText('O cortiço, 100%, 1 voto, seu voto')).toBeTruthy();
    expect(screen.getByText('1 voto')).toBeTruthy();
    const feed = queryClient.getQueryData<typeof page>(['feed', 'para-voce', '']);
    expect(feed?.pages[0].items[0].poll?.votedOptionId).toBe('opt-0');
    expect(feed?.pages[0].items[1]).toBe(other);
    expect(queryClient.getQueryData<FeedItem>(['post', post.id])?.poll?.totalVotes).toBe(1);
    expect(queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['profile-posts', 'ana'])?.pages[0].items[0].poll?.votedOptionId).toBe('opt-0');
    expect(queryClient.getQueryData<FeedItem>(['post-preview', post.id])?.poll?.votedOptionId).toBe('opt-0');

    await act(async () => { reject(new NetworkError()); });
    expect(screen.queryByText('100%')).toBeNull();
    expect(screen.getByLabelText('Votar em O cortiço')).toBeTruthy();
    expect(queryClient.getQueryData<FeedItem>(['post', post.id])?.poll?.votedOptionId).toBeNull();
    expect(queryClient.getQueryData<typeof page>(['feed', 'para-voce', ''])?.pages[0].items[0].poll?.totalVotes).toBe(0);
  });

  it('atualiza o resultado ao trocar o voto e não reaproveita o estado em outra publicação', async () => {
    const base = poll('Qual horário?', ['Manhã', 'Noite']);
    const post = item(base);
    jest.mocked(voteOnPoll).mockResolvedValueOnce({ ...post, poll: applyPollVote(base, 'opt-0') });
    const view = await render(<PostPollBlock postId={post.id} poll={base} />);
    await fireEvent.press(screen.getByLabelText('Votar em Manhã'));
    expect(await screen.findByLabelText('Manhã, 100%, 1 voto, seu voto')).toBeTruthy();

    const voted = applyPollVote(base, 'opt-0');
    jest.mocked(voteOnPoll).mockResolvedValueOnce({ ...post, poll: applyPollVote(voted, 'opt-1') });
    await fireEvent.press(screen.getByLabelText('Noite, 0%, 0 votos'));
    expect(await screen.findByLabelText('Noite, 100%, 1 voto, seu voto')).toBeTruthy();
    expect(screen.getByLabelText('Manhã, 0%, 0 votos')).toBeTruthy();
    expect(voteOnPoll).toHaveBeenCalledTimes(2);

    await view.rerender(<PostPollBlock postId="post-2" poll={poll('Qual livro?', ['Um', 'Dois'])} />);
    expect(screen.getByText('Qual livro?')).toBeTruthy();
    expect(screen.queryByText('100%')).toBeNull();
    expect(screen.getByLabelText('Votar em Um')).toBeTruthy();
  });

  it('propaga o voto para o feed, o perfil e o detalhe sem recriar os outros itens', () => {
    const base = poll('Pauta', ['Seguir', 'Revisar']);
    const post = item(base);
    const untouched = item(poll('Outra', ['A', 'B']), 'post-2');
    queryClient.setQueryData(['feed', 'tab'], { pages: [{ items: [post, untouched], nextCursor: null }], pageParams: [null] });
    queryClient.setQueryData(['post', post.id], post);
    patchCachedPoll(post.id, applyPollVote(base, 'opt-1'));
    const feed = queryClient.getQueryData<{ pages: { items: FeedItem[] }[] }>(['feed', 'tab']);
    expect(feed?.pages[0].items[0].poll?.votedOptionId).toBe('opt-1');
    expect(feed?.pages[0].items[1]).toBe(untouched);
    expect(queryClient.getQueryData<FeedItem>(['post', post.id])?.poll?.options[1].percent).toBe(100);
  });
});
