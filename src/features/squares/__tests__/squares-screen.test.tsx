import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import SquaresScreen from '../squares-screen';
import * as api from '../api';
import { deferred, square } from '../testing/fixtures';

const mockFocusCallbacks: (() => void | (() => void))[] = [];

jest.mock('expo-router', () => {
  const { useEffect: useEffectHook } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), navigate: jest.fn() },
    useFocusEffect: (callback: () => void | (() => void)) => useEffectHook(() => {
      mockFocusCallbacks.push(callback);
      return callback();
    }, [callback]),
  };
});
jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('../api');
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const mocked = jest.mocked(api);
afterEach(() => cleanup());
beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallbacks.length = 0;
  mocked.listSquares.mockResolvedValue({ items: [square()], nextCursor: null });
});

describe('retorno à aba Praças', () => {
  it('atualiza ao voltar sem perder a posição do item visível durante a carga', async () => {
    let mineCalls = 0;
    const refreshedMine = deferred<Awaited<ReturnType<typeof api.listSquares>>>();
    mocked.listSquares.mockImplementation(async (section) => {
      if (section === 'discover') return { items: [], nextCursor: null };
      mineCalls += 1;
      return mineCalls === 1 ? { items: [square()], nextCursor: null } : refreshedMine.promise;
    });

    await render(<SquaresScreen />);
    await screen.findByLabelText('Entrar na Praça Trabalhadores de TI');
    expect(mineCalls).toBe(1);
    expect(screen.getByTestId('squares-list').props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 1 });

    await act(async () => mockFocusCallbacks[0]());
    expect(mineCalls).toBe(2);
    expect(screen.getByLabelText('Entrar na Praça Trabalhadores de TI')).toBeTruthy();
    expect(screen.getByTestId('squares-list').props.refreshing).toBe(false);
    await act(async () => {
      refreshedMine.resolve({ items: [square({ id: 'square2', title: 'Praça atualizada' })], nextCursor: null });
      await refreshedMine.promise;
    });
  });
});
