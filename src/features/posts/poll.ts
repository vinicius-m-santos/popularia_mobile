import type { QueryKey } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

export const POLL_QUESTION_MAX = 140;
export const POLL_OPTION_MAX = 80;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

export type PollOption = {
  id: string;
  label: string;
  voteCount: number;
  percent: number;
  selected: boolean;
};

/** Enquete já pronta para o cartão. `votedOptionId` nulo significa que a pessoa ainda não votou. */
export type PostPoll = {
  id: string;
  question: string;
  totalVotes: number;
  votedOptionId: string | null;
  options: PollOption[];
};

export type PollDraft = {
  question: string;
  options: { key: string; label: string }[];
};

/**
 * Percentuais inteiros. Com votos, a soma é 100; sem votos, cada opção fica em 0.
 * O resto vai para a maior fração e, no empate, para a primeira opção.
 * A mesma conta está em `App\Poll\PollPercents`.
 */
export function pollPercents(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return counts.map(() => 0);
  const floors = counts.map((count) => Math.floor((count * 100) / total));
  const remainders = counts.map((count) => (count * 100) % total);
  const left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = counts.map((_, index) => index).sort((a, b) => {
    if (remainders[a] !== remainders[b]) return remainders[b] - remainders[a];
    if (counts[a] !== counts[b]) return counts[b] - counts[a];
    return a - b;
  });
  const percents = [...floors];
  for (let index = 0; index < left; index += 1) percents[order[index]] += 1;
  return percents;
}

export function applyPollVote(poll: PostPoll, optionId: string): PostPoll {
  if (!poll.options.some((option) => option.id === optionId) || poll.votedOptionId === optionId) return poll;
  const options = poll.options.map((option) => {
    let voteCount = option.voteCount;
    if (option.id === poll.votedOptionId) voteCount = Math.max(0, voteCount - 1);
    if (option.id === optionId) voteCount += 1;
    return { ...option, voteCount, selected: option.id === optionId };
  });
  const percents = pollPercents(options.map((option) => option.voteCount));
  return {
    ...poll,
    totalVotes: options.reduce((sum, option) => sum + option.voteCount, 0),
    votedOptionId: optionId,
    options: options.map((option, index) => ({ ...option, percent: percents[index] ?? 0 })),
  };
}

export function pollDraftError(draft: PollDraft | null): string | null {
  if (!draft) return null;
  const question = draft.question.trim();
  if (!question) return 'Escreva a pergunta da enquete.';
  if (question.length > POLL_QUESTION_MAX) return `A pergunta pode ter até ${POLL_QUESTION_MAX} caracteres.`;
  if (draft.options.length < POLL_MIN_OPTIONS) return 'A enquete precisa de pelo menos duas opções.';
  if (draft.options.length > POLL_MAX_OPTIONS) return 'A enquete pode ter até seis opções.';
  const labels = draft.options.map((option) => option.label.trim());
  if (labels.some((label) => label.length === 0)) return 'Preencha todas as opções.';
  if (labels.some((label) => label.length > POLL_OPTION_MAX)) return `Cada opção pode ter até ${POLL_OPTION_MAX} caracteres.`;
  const unique = new Set(labels.map((label) => label.toLocaleLowerCase()));
  if (unique.size !== labels.length) return 'As opções precisam ser diferentes.';
  return null;
}

export function draftToPoll(draft: PollDraft): PostPoll {
  return {
    id: 'draft-poll',
    question: draft.question.trim() || 'Sua pergunta aparece aqui.',
    totalVotes: 0,
    votedOptionId: null,
    options: draft.options.map((option, index) => ({
      id: option.key,
      label: option.label.trim() || `Opção ${index + 1}`,
      voteCount: 0,
      percent: 0,
      selected: false,
    })),
  };
}

export type PostCacheSnapshot = { queryKey: QueryKey; data: unknown };

const POST_ROOTS = new Set(['feed', 'profile-posts', 'post', 'post-preview']);

function isFeedItem(value: unknown): value is FeedItem {
  return !!value && typeof value === 'object' && 'id' in value && 'text' in value && 'author' in value;
}

function isPage(value: unknown): value is { items: FeedItem[]; nextCursor: string | null } {
  return !!value && typeof value === 'object' && 'items' in value && Array.isArray((value as { items: unknown }).items);
}

function isInfinite(value: unknown): value is { pages: unknown[]; pageParams: unknown[] } {
  return !!value && typeof value === 'object' && 'pages' in value && Array.isArray((value as { pages: unknown }).pages);
}

function containsPost(data: unknown, postId: string): boolean {
  if (isFeedItem(data)) return data.id === postId;
  if (!isInfinite(data)) return false;
  return data.pages.some((page) => isPage(page) && page.items.some((item) => item?.id === postId));
}

/** Atualiza só o item da enquete nas listas e no detalhe, preservando a referência dos outros cartões. */
export function patchCachedPoll(postId: string, poll: PostPoll): void {
  queryClient.setQueriesData({ predicate: (query) => POST_ROOTS.has(String(query.queryKey[0])) }, (current) => replacePoll(current, postId, poll));
}

export function snapshotPostCaches(postId: string): PostCacheSnapshot[] {
  return queryClient.getQueryCache().findAll({ predicate: (query) => POST_ROOTS.has(String(query.queryKey[0])) && containsPost(query.state.data, postId) })
    .map((query) => ({ queryKey: query.queryKey, data: query.state.data }));
}

export function restorePostCaches(snapshots: PostCacheSnapshot[]): void {
  for (const snapshot of snapshots) queryClient.setQueryData(snapshot.queryKey, snapshot.data);
}

function replacePoll(data: unknown, postId: string, poll: PostPoll): unknown {
  if (isFeedItem(data)) return data.id === postId ? { ...data, poll } : data;
  if (!isInfinite(data)) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!isPage(page)) return page;
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (!item || item.id !== postId) return item;
      pageChanged = true;
      return { ...item, poll };
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}

export function pollsMatch(left: PostPoll, right: PostPoll): boolean {
  return left.votedOptionId === right.votedOptionId
    && left.totalVotes === right.totalVotes
    && left.options.length === right.options.length
    && left.options.every((option, index) => {
      const other = right.options[index];
      return !!other && option.id === other.id && option.voteCount === other.voteCount && option.percent === other.percent && option.selected === other.selected;
    });
}
