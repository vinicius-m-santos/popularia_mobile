import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Pressable } from 'react-native';
import { ToastProvider, useToast } from '../toast';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

function Action() {
  const toast = useToast();
  return <Pressable accessibilityLabel="Participar" onPress={() => {
    toast.show('Entrou na comuna');
    toast.show('Missão concluída');
  }} />;
}
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('mostra ação e missão em sequência sem substituir a confirmação', async () => {
  jest.useFakeTimers();
  const view = await render(<ToastProvider><Action /></ToastProvider>);
  await fireEvent.press(screen.getByLabelText('Participar'));
  expect(screen.getByText('Entrou na comuna', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText('Missão concluída', { includeHiddenElements: true })).toBeNull();
  await act(() => jest.advanceTimersByTime(3000));
  expect(screen.getByText('Missão concluída', { includeHiddenElements: true })).toBeTruthy();
  await act(() => jest.advanceTimersByTime(3000));
  expect(screen.queryByText('Missão concluída', { includeHiddenElements: true })).toBeNull();
  await view.unmount();
});

it('zera a animação do aviso quando o sistema pede movimento reduzido', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(<ToastProvider><Action /></ToastProvider>);
  // O hook lê a preferência em uma promise; o aviso só é disparado depois disso.
  await act(async () => { await Promise.resolve(); });
  await fireEvent.press(screen.getByLabelText('Participar'));
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 0 }));
  await view.unmount();
});
