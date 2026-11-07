import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Motion } from '@/constants/motion';

import { TAB_INDICATOR_TIMING, UnderlineTabs } from '../underline-tabs';

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    GestureHandlerRootView: View,
  };
});

const OPTIONS = [
  { key: 'para-voce', label: 'Para você' },
  { key: 'seguindo', label: 'Seguindo' },
  { key: 'minhas', label: 'Minhas comunas' },
] as const;

describe('indicador das abas', () => {
  it('mantém a aba ativa selecionada e entrega o toque sem trocar o layout', async () => {
    const onChange = jest.fn();
    const view = await render(<UnderlineTabs options={[...OPTIONS]} value="para-voce" onChange={onChange} />);

    expect(screen.getByRole('tab', { name: 'Para você', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Seguindo', selected: false })).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Seguindo' }));
    expect(onChange).toHaveBeenCalledWith('seguindo');

    await view.rerender(<UnderlineTabs options={[...OPTIONS]} value="seguindo" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Seguindo', selected: true })).toBeTruthy();
  });

  it('usa os tokens da casa e respeita o movimento reduzido do sistema', () => {
    expect(TAB_INDICATOR_TIMING).toEqual({
      duration: Motion.duration.normal,
      easing: Motion.easing.standard,
      reduceMotion: 'system',
    });
  });
});
