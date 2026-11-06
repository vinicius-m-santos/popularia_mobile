import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { setPostEcho, setPostSaved, setPostSupport } from '@/features/posts/api';
import { PostCard } from '@/features/posts/components/post-card';
import { resetSavedSession } from '@/features/posts/save';
import { resetReactionSession } from '@/features/posts/reactions';
import { haptic } from '@/lib/haptics';
import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

jest.mock('@/constants/config', () => ({ ...jest.requireActual<typeof import('@/constants/config')>('@/constants/config'), DEMO_MODE: false }));
jest.mock('@/features/posts/api', () => {
  const actual = jest.requireActual<typeof import('@/features/posts/api')>('@/features/posts/api');
  return { ...actual, setPostSupport: jest.fn(), setPostEcho: jest.fn(), setPostSaved: jest.fn() };
});
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ account: { id: 'me' } }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/haptics', () => ({ haptic: jest.fn() }));
jest.mock('@/features/moderation/actions-sheet', () => ({ useActionsSheet: () => ({ open: jest.fn() }) }));
jest.mock('@/lib/routes', () => ({
  useNav: () => ({
    openPost: jest.fn(),
    openProfile: jest.fn(),
    openComuna: jest.fn(),
    openHashtag: jest.fn(),
    openRelations: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() } }));

const CARD_COUNT = 20;

function feed(id: string, supportCount = 0): FeedItem {
  return {
    id,
    authorId: 'ana',
    comunaId: null,
    createdAt: '2026-10-29T12:00:00Z',
    text: `Texto ${id}`,
    supportCount,
    commentCount: 0,
    echoCount: 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved: false },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null,
    event: null,
    topCommentAuthor: null,
  };
}

const cards = Array.from({ length: CARD_COUNT }, (_, index) => feed(`card-${index + 1}`, index));

const wrapper = ({ children }: { children: ReactNode }) => <InteractionsProvider>{children}</InteractionsProvider>;

async function renderCards() {
  return render(
    <ScrollView>
      {cards.map((item) => <PostCard key={item.id} item={item} mediaVisible={false} />)}
    </ScrollView>,
    { wrapper },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSavedSession();
  resetReactionSession();
  queryClient.clear();
  setPerformanceInstrumentationOverride(true);
  jest.mocked(setPostSaved).mockResolvedValue(undefined);
  jest.mocked(setPostSupport).mockImplementation(async (id, active) => ({
    ...feed(id),
    supportCount: active ? 1 : 0,
    viewer: { ...feed(id).viewer!, supported: active },
  }));
  jest.mocked(setPostEcho).mockImplementation(async (id, active) => ({
    ...feed(id),
    echoCount: active ? 1 : 0,
    viewer: { ...feed(id).viewer!, echoed: active },
  }));
});

describe('fanout das ações de publicação', () => {
  it('apoia um cartão sem atualizar os outros 19', async () => {
    await renderCards();
    expect(screen.getAllByLabelText(/^Apoiar/)).toHaveLength(CARD_COUNT);
    const mounted = getPerformanceSnapshot().commits.filter((commit) => commit.component === 'PostCard');
    expect(mounted).toHaveLength(CARD_COUNT);
    expect(mounted.every((commit) => commit.mountCommits === 1)).toBe(true);

    // O mount dos 20 cartões não entra na comparação: só o commit da ação.
    resetPerformanceSession();

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText(/^Apoiar/)[0]);
    });

    const commits = getPerformanceSnapshot().commits.filter((commit) => commit.component === 'PostCard');
    const updated = commits.filter((commit) => commit.updateCommits > 0);
    // Um único cartão acorda, uma única vez: a confirmação do servidor repete o
    // valor otimista e não troca o snapshot.
    expect(updated).toHaveLength(1);
    expect(updated[0].updateCommits).toBe(1);
    expect(screen.queryByLabelText('Apoiar, 0')).toBeNull();
    expect(screen.getAllByLabelText('Apoiar, 1')).toHaveLength(2);
  });

  it('dá impacto leve em apoiar, ecoar e salvar, nunca na renderização do cartão', async () => {
    await render(<PostCard item={feed('acoes')} mediaVisible={false} />, { wrapper });
    expect(haptic).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText(/^Apoiar/));
    await fireEvent.press(screen.getByLabelText(/^Ecoar/));
    await fireEvent.press(screen.getByLabelText('Salvar'));

    expect(haptic).toHaveBeenCalledTimes(3);
    expect(haptic).toHaveBeenNthCalledWith(1, 'light');
    expect(haptic).toHaveBeenNthCalledWith(2, 'light');
    expect(haptic).toHaveBeenNthCalledWith(3, 'light');
  });
});
