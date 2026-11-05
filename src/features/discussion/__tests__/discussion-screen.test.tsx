import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import DiscussionScreen from '@/features/discussion/discussion-screen';
import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';
import type { CommentWithAuthor, FeedItem } from '@/types/models';

import { getComments, setCommentSupport } from '../api';

const mockPost: FeedItem = {
  id: 'post-1',
  authorId: 'ana',
  comunaId: null,
  createdAt: '2026-10-28T09:00:00Z',
  text: 'Discussão extensa',
  supportCount: 0,
  commentCount: 8,
  echoCount: 0,
  event: null,
  topCommentAuthor: null,
  author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
  comuna: null,
  viewer: { isAuthor: false, canComment: true, canDelete: false },
};

const mockMe = { id: 'me', name: 'Eu', handle: 'eu', initials: 'EU', tone: 'red' as const };
const mockOpen = jest.fn();
const mockShow = jest.fn();

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'post-1' }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/components/screen', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/keyboard-view', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { KeyboardView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/lib/routes', () => ({
  goBack: jest.fn(),
  useNav: () => ({ openComuna: jest.fn(), openPost: jest.fn(), openHashtag: jest.fn(), openProfile: jest.fn() }),
}));
jest.mock('@/features/account/account-context', () => ({
  useMe: () => mockMe,
  useAccount: () => ({ account: { id: 'me', emailVerified: true }, reloadAccount: jest.fn() }),
}));
jest.mock('@/features/interactions/interactions-context', () => {
  const noComments: never[] = [];
  const value = {
    isOn: () => false,
    toggle: jest.fn(),
    localCommentsFor: () => noComments,
    addComment: jest.fn(),
    membershipOf: () => true,
    setOn: jest.fn(),
    noteCommentCount: jest.fn(),
  };
  return { useInteractions: () => value };
});
jest.mock('@/features/moderation/actions-sheet', () => ({ useActionsSheet: () => ({ open: mockOpen }) }));
jest.mock('@/features/posts/use-local-posts', () => ({ useLocalFeedItems: () => [] }));
jest.mock('@/features/posts/queries', () => ({
  useCachedPost: () => ({ data: mockPost, status: 'success', error: null, reload: jest.fn() }),
}));
jest.mock('@/features/discussion/components/post-detail', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PostDetail: () => <View testID="post-detail" /> };
});
jest.mock('@/features/discussion/components/comment-composer', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { CommentComposer: () => <View testID="comment-composer" /> };
});
jest.mock('@/features/discussion/api', () => ({
  getComments: jest.fn(),
  createComment: jest.fn(),
  setCommentSupport: jest.fn(),
}));

const apiComments = jest.mocked(getComments);
const apiSupport = jest.mocked(setCommentSupport);

function comment(index: number, parentId: string | null = null): CommentWithAuthor {
  const name = `Pessoa ${index}`;
  return {
    id: `comment-${index}`,
    postId: 'post-1',
    parentId,
    authorId: `person-${index}`,
    author: { id: `person-${index}`, name, handle: `pessoa${index}`, initials: `P${index}`, tone: 'red' },
    createdAt: `2026-10-28T10:${String(index).padStart(2, '0')}:00Z`,
    text: `Comentário ${index}`,
    supportCount: 0,
    viewerSupported: false,
  };
}

function topLevelComments(count: number): CommentWithAuthor[] {
  return Array.from({ length: count }, (_, index) => comment(index + 1));
}

async function renderComments(comments: CommentWithAuthor[]) {
  apiComments.mockResolvedValue({ items: comments, nextCursor: null });
  await render(<DiscussionScreen />);
  await waitFor(() => expect(screen.getAllByLabelText(/^Apoiar comentário, /)).toHaveLength(comments.length));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOpen.mockReset();
  mockShow.mockReset();
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
  apiSupport.mockImplementation(async (commentId: string, supported: boolean) => {
    const base = comment(1);
    return { ...base, id: commentId, supportCount: supported ? 1 : 0, viewerSupported: supported };
  });
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
});

describe('estabilidade das linhas da discussão', () => {
  it('apoia um comentário sem acordar os irmãos', async () => {
    const comments = topLevelComments(8);
    await renderComments(comments);
    expect(getPerformanceSnapshot().commits.filter((commit) => commit.component === 'CommentRow')).toHaveLength(comments.length);

    // O mount não entra na comparação: só o commit disparado pelo apoio.
    resetPerformanceSession();
    const supportButtons = screen.getAllByLabelText('Apoiar comentário, 0');
    await act(async () => {
      fireEvent.press(supportButtons[supportButtons.length - 1]);
    });

    await waitFor(() => expect(screen.getAllByLabelText('Apoiar comentário, 1')).toHaveLength(1));

    const updated = getPerformanceSnapshot().commits.filter(
      (commit) => commit.component === 'CommentRow' && commit.updateCommits > 0,
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].updateCommits).toBe(1);
    expect(screen.getAllByLabelText('Apoiar comentário, 0')).toHaveLength(comments.length - 1);
  });

  it('abre o menu do comentário tocado pelo id, sem depender da linha', async () => {
    const comments = topLevelComments(3);
    await renderComments(comments);

    await fireEvent.press(screen.getByLabelText('Mais opções do comentário de Pessoa 3'));

    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0]).toMatchObject({ kind: 'comment', id: 'comment-3' });
    expect(mockOpen.mock.calls[0][1]).toBe('menu');
  });

  it('continua ocultando e reexibindo respostas', async () => {
    const comments = [comment(1), comment(2, 'comment-1'), comment(3, 'comment-1')];
    await renderComments(comments);
    expect(screen.getByText('Comentário 2')).toBeTruthy();

    await fireEvent.press(screen.getByText('Ocultar'));

    expect(screen.queryByText('Comentário 2')).toBeNull();
    expect(screen.getByText('Ver 2 respostas')).toBeTruthy();

    await fireEvent.press(screen.getByText('Ver 2 respostas'));

    expect(screen.getByText('Comentário 2')).toBeTruthy();
    expect(screen.getByText('Comentário 3')).toBeTruthy();
  });
});
