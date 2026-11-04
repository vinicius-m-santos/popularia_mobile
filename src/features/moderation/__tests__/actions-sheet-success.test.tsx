import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Pressable } from 'react-native';

import { ActionsSheetProvider, useActionsSheet } from '@/features/moderation/actions-sheet';
import { resetBlockedHandlesForTests } from '@/features/moderation/blocks';
import { postTarget } from '@/features/moderation/targets';
import { apiRequest, type RequestOptions } from '@/lib/api/client';
import { queryClient } from '@/lib/query/client';
import type { FeedItem } from '@/types/models';

const mockShow = jest.fn();
const mockSetOn = jest.fn();
const mockSubmitReport = jest.fn(async () => ({ protocol: '', inMyQueue: false }));
const mockAnnounce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);

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
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me', handle: 'eu', name: 'Eu' }) }));
jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({ isOn: () => false, toggle: () => false, setOn: mockSetOn }),
}));
jest.mock('@/features/moderation/moderation-context', () => ({ useModeration: () => ({ submitReport: mockSubmitReport }) }));
jest.mock('@/features/lookup', () => ({ findComuna: () => null }));
jest.mock('@/features/links/share', () => ({ shareDestination: jest.fn() }));
jest.mock('@/features/links/destinations', () => ({ canonicalUrl: () => 'https://popularia.test/p' }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), dismissAll: jest.fn(), replace: jest.fn() } }));

const api = jest.mocked(apiRequest);

const post: FeedItem = {
  id: 'post-1',
  authorId: 'ana',
  comunaId: 'devs',
  createdAt: '2026-11-02T12:00:00Z',
  text: 'Qual livro vamos ler?',
  title: 'Qual livro vamos ler?',
  supportCount: 0,
  commentCount: 0,
  echoCount: 0,
  event: null,
  topCommentAuthor: null,
  author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
  comuna: { id: 'devs', name: 'Devs do Brasil', status: 'active' },
  viewer: { isAuthor: false, canComment: true, canDelete: false },
};

function Opener() {
  const sheet = useActionsSheet();
  return <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={() => sheet.open(postTarget(post))} />;
}

const wrapper = ({ children }: { children: ReactNode }) => <ActionsSheetProvider>{children}</ActionsSheetProvider>;

async function openSuccessSheet() {
  await render(<Opener />, { wrapper });
  await fireEvent.press(screen.getByLabelText('Abrir menu'));
  await fireEvent.press(screen.getByText('Denunciar publicação'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
  await fireEvent.press(screen.getByRole('button', { name: /Enviar denúncia/ }));
  await waitFor(() => expect(screen.getByText('DENÚNCIA ENVIADA.')).toBeTruthy());
}

beforeEach(() => {
  queryClient.setDefaultOptions({ queries: { gcTime: Infinity, retry: false } });
  queryClient.clear();
  api.mockReset();
  mockShow.mockReset();
  mockSetOn.mockReset();
  mockSubmitReport.mockClear();
  mockAnnounce.mockClear();
  resetBlockedHandlesForTests();
});

describe('confirmação da denúncia no fluxo', () => {
  it('bloqueia direto, anuncia o estado e desfaz', async () => {
    api.mockImplementation(async <T,>(path: string, options?: RequestOptions): Promise<T> => {
      if (path.startsWith('/me/blocks/') && options?.method === 'PUT') return undefined as T;
      if (path.startsWith('/me/blocks/') && options?.method === 'DELETE') return undefined as T;
      if (path === '/me/blocks') return [] as T;
      return undefined as T;
    });
    await openSuccessSheet();
    expect(screen.getByText('c/ Devs do Brasil')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear Ana' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/me/blocks/ana', { auth: true, method: 'PUT' }));
    expect(screen.getByText('Ana foi bloqueado')).toBeTruthy();
    expect(screen.getByText('Dá pra desfazer em Conta › Bloqueios')).toBeTruthy();
    expect(mockSetOn).toHaveBeenCalledWith('mutedUsers', ['ana'], true);
    expect(mockAnnounce).toHaveBeenCalledWith('Ana foi bloqueado');
    expect(mockShow).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer bloqueio de Ana' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/me/blocks/ana', { auth: true, method: 'DELETE' }));
    expect(screen.getByText('Bloquear Ana')).toBeTruthy();
    expect(mockSetOn).toHaveBeenCalledWith('mutedUsers', ['ana'], false);
    expect(mockAnnounce).toHaveBeenCalledWith('Ana foi desbloqueado');
  });

  it('volta ao estado inicial e avisa quando o bloqueio falha', async () => {
    api.mockImplementation(async <T,>(path: string, options?: RequestOptions): Promise<T> => {
      if (path.startsWith('/me/blocks/') && options?.method === 'PUT') throw new Error('offline');
      if (path === '/me/blocks') return [] as T;
      return undefined as T;
    });
    await openSuccessSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear Ana' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/me/blocks/ana', { auth: true, method: 'PUT' }));
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith('Não deu pra bloquear agora. Tenta de novo.'));
    expect(screen.getByText('Bloquear Ana')).toBeTruthy();
    expect(screen.queryByText('Ana foi bloqueado')).toBeNull();
  });
});
