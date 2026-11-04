import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import type { TopicId } from '@/types/models';

import { getTopicGroups } from '../api';
import { interestSections, InterestsPickerScreen } from '../interests-picker-screen';

const mockShow = jest.fn();
const mockSave = jest.fn<(ids: TopicId[]) => Promise<void>>().mockResolvedValue(undefined);
let mockInterests: TopicId[] = ['pol'];

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => undefined) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../api', () => ({ getTopicGroups: jest.fn() }));
jest.mock('@/features/account/account-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  return {
    useAccount: () => {
      const [interests, setInterests] = React.useState(mockInterests);
      return {
        interests,
        toggleInterest: (id: TopicId) => setInterests((current: TopicId[]) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]),
        saveInterests: (ids: TopicId[]) => { void mockSave(ids); return Promise.resolve(); },
      };
    },
  };
});

const groups = [
  { title: 'Política e direitos', topics: [{ id: 'pol' as const, label: 'Política brasileira', shortLabel: 'Política' }] },
  { title: 'Bem comum', topics: [{ id: 'edu' as const, label: 'Educação', shortLabel: 'Educação' }] },
  { title: 'Cultura e ideias', topics: [{ id: 'cult' as const, label: 'Cultura, música e arte', shortLabel: 'Cultura' }] },
  { title: 'Dia a dia', topics: [{ id: 'games' as const, label: 'Games', shortLabel: 'Games' }] },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockInterests = [];
  jest.mocked(getTopicGroups).mockResolvedValue(groups);
  mockSave.mockResolvedValue(undefined);
});

describe('interesses', () => {
  it('mescla títulos legados e mantém cultura, cidade e política nesta ordem', () => {
    expect(interestSections(groups).map((section) => section.title)).toEqual(['Cultura e lazer', 'Cidade e comunidade', 'Política e direitos']);
  });

  it('atualiza contador, dica e progresso, e continua salvando', async () => {
    await render(<InterestsPickerScreen mode="onboarding" />);
    expect(await screen.findByText('0 DE 3')).toBeTruthy();
    expect(screen.getByText('Escolha pelo menos 3 pra um feed mais certeiro.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Educação' }));
    expect(screen.getByText('1 DE 3')).toBeTruthy();
    expect(Haptics.selectionAsync).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Games' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Política brasileira' }));
    expect(screen.getByText('3 ESCOLHIDOS ✓')).toBeTruthy();
    expect(screen.getByText('Boa! Seu feed já começa com a sua cara.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(['pol', 'edu', 'games']));
    expect(router.push).toHaveBeenCalledWith('/boas-vindas/comunas');
  });

  it('pular não salva; voltar sai sem salvar', async () => {
    await render(<InterestsPickerScreen mode="onboarding" />);
    await screen.findByText('0 DE 3');

    await fireEvent.press(screen.getByRole('button', { name: 'Pular' }));
    expect(router.push).toHaveBeenCalledWith('/boas-vindas/comunas');
    expect(mockSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('edição abre com os interesses atuais e o botão Salvar', async () => {
    mockInterests = ['pol'];
    await render(<InterestsPickerScreen mode="edit" />);
    await screen.findByText('Política brasileira');
    expect(screen.queryByRole('button', { name: 'Pular' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Política brasileira' }).props.accessibilityState.checked).toBe(true);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Política brasileira' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar interesses' }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith([]));
    expect(router.back).toHaveBeenCalled();
  });
});
