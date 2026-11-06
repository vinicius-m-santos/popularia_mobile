import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { resetMockRouteFocused, setMockRouteFocused } from '@/hooks/testing/route-focus';

import * as api from '../api';
import { LibraryPane } from '../library-screen';
import { collection, document } from '../testing/fixtures';

jest.mock('expo-router', () => {
  const { useMockFocusEffect } = jest.requireActual<typeof import('@/hooks/testing/route-focus')>('@/hooks/testing/route-focus');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => ({}),
    useFocusEffect: useMockFocusEffect,
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me', name: 'Camila' }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/onboarding/api', () => ({
  getTopicGroups: () => Promise.resolve([{ title: 'Política', topics: [{ id: 'trab', label: 'Trabalho', shortLabel: 'Trabalho' }] }]),
}));
jest.mock('../api', () => ({ listDocuments: jest.fn(), listCollections: jest.fn() }));

const mocked = jest.mocked(api);
let appListener: ((state: AppStateStatus) => void) | undefined;
let now = 1_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  resetMockRouteFocused();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  appListener = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appListener = callback;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  mocked.listDocuments.mockResolvedValue({ items: [document], nextCursor: null });
  mocked.listCollections.mockResolvedValue({ items: [collection], nextCursor: null });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('revalidação da Biblioteca', () => {
  it('não repete a primeira página quando foco e background estão dentro da janela', async () => {
    await render(<LibraryPane scope="public" canAdd />);
    await screen.findByText(document.title!);
    expect(api.listDocuments).toHaveBeenCalledTimes(1);

    // Voltar de um documento e retornar do background em sequência não duplica.
    await act(async () => {
      setMockRouteFocused(false);
      setMockRouteFocused(true);
      appListener?.('active');
    });
    expect(api.listDocuments).toHaveBeenCalledTimes(1);

    now += 30_001;
    await act(async () => {
      setMockRouteFocused(false);
      setMockRouteFocused(true);
    });
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledTimes(2));
  });
});
