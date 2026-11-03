import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { ActionsSheetProvider, useActionsSheet } from '@/features/moderation/actions-sheet';
import { commentTarget, postTarget } from '@/features/moderation/targets';
import { apiRequest } from '@/lib/api/client';
import { queryClient } from '@/lib/query/client';
import type { CommentWithAuthor, FeedItem } from '@/types/models';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, API_BASE_URL: 'http://api.test/api/v1' }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));
jest.mock('@/components/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextInput, View } = require('react-native') as typeof import('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement(View, null, children) : null,
    PopulariaBottomSheetTextInput: (props: Record<string, unknown>) => React.createElement(TextInput, props),
  };
});
const mockShow = jest.fn();
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me', handle: 'eu', name: 'Eu' }) }));
jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({ isOn: () => false, toggle: () => false, setOn: () => undefined }),
}));
jest.mock('@/features/moderation/moderation-context', () => ({ useModeration: () => ({ submitReport: jest.fn() }) }));
jest.mock('@/features/lookup', () => ({ findComuna: () => null }));
jest.mock('@/lib/routes', () => ({ useNav: () => ({ openComuna: jest.fn(), openPost: jest.fn() }), openModeration: jest.fn() }));
jest.mock('@/features/links/share', () => ({ shareDestination: jest.fn() }));
jest.mock('@/features/links/destinations', () => ({ canonicalUrl: () => 'https://popularia.test/p' }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const api = jest.mocked(apiRequest);

const post: FeedItem = {
  id: 'post-1', authorId: 'ana', comunaId: null, createdAt: '2026-11-02T12:00:00Z', text: 'Discussão',
  supportCount: 0, commentCount: 1, echoCount: 0, event: null, topCommentAuthor: null,
  author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' }, comuna: null,
  viewer: { isAuthor: false, canComment: true, canDelete: false },
};

function comment(isOwn: boolean): CommentWithAuthor {
  return {
    id: 'comment-1', postId: post.id, parentId: null, authorId: isOwn ? 'me' : 'bia',
    createdAt: '2026-11-02T12:10:00Z', text: 'Comentário', supportCount: 0, isOwn,
    author: isOwn
      ? { id: 'me', name: 'Eu', handle: 'eu', initials: 'EU', tone: 'red' }
      : { id: 'bia', name: 'Bia', handle: 'bia', initials: 'BI', tone: 'black' },
  };
}

function Opener({ isOwn, onDeleted }: { isOwn: boolean; onDeleted: () => void }) {
  const sheet = useActionsSheet();
  return <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={() => sheet.open(commentTarget(comment(isOwn), post), 'menu', { onDeleted })} />;
}

async function renderMenu(isOwn: boolean, onDeleted = jest.fn()) {
  const tree = ({ children }: { children: ReactNode }) => <ActionsSheetProvider>{children}</ActionsSheetProvider>;
  await render(<Opener isOwn={isOwn} onDeleted={onDeleted} />, { wrapper: tree });
  await fireEvent.press(screen.getByLabelText('Abrir menu'));
  return onDeleted;
}

beforeEach(() => {
  queryClient.setDefaultOptions({ queries: { gcTime: Infinity, retry: false } });
  queryClient.clear();
  api.mockReset();
  mockShow.mockReset();
});
afterEach(() => queryClient.clear());

describe('menu do comentário', () => {
  it('oferece compartilhar e excluir no próprio comentário, sem denúncia', async () => {
    await renderMenu(true);
    expect(screen.getByText('Compartilhar comentário')).toBeTruthy();
    expect(screen.getByText('Excluir comentário')).toBeTruthy();
    expect(screen.queryByText('Denunciar comentário')).toBeNull();
  });

  it('exclui com soft delete e atualiza a lista', async () => {
    api.mockResolvedValueOnce(undefined);
    const onDeleted = await renderMenu(true);
    await fireEvent.press(screen.getByText('Excluir comentário'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/comments/comment-1', { method: 'DELETE', auth: true }));
    expect(onDeleted).toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith('Comentário apagado.');
  });

  it('oferece denúncia para comentário de outra pessoa, sem excluir', async () => {
    await renderMenu(false);
    expect(screen.getByText('Denunciar comentário')).toBeTruthy();
    expect(screen.queryByText('Excluir comentário')).toBeNull();
  });

describe('menu da publicação', () => {
  it('oferece editar e excluir na própria publicação', async () => {
    const own = { ...post, authorId: 'me', author: { id: 'me', name: 'Eu', handle: 'eu', initials: 'EU', tone: 'red' as const }, viewer: { isAuthor: true, canComment: true, canDelete: true } };
    function PostOpener() {
      const sheet = useActionsSheet();
      return <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu do post" onPress={() => sheet.open(postTarget(own))} />;
    }
    const tree = ({ children }: { children: ReactNode }) => <ActionsSheetProvider>{children}</ActionsSheetProvider>;
    await render(<PostOpener />, { wrapper: tree });
    await fireEvent.press(screen.getByLabelText('Abrir menu do post'));
    expect(screen.getByText('Editar publicação')).toBeTruthy();
    expect(screen.getByText('Excluir publicação')).toBeTruthy();
    expect(screen.queryByText('Denunciar publicação')).toBeNull();
  });
});
});
