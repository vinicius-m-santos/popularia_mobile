import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { PROFILE_TABS_OVERLAY_TIMING, ProfileTabsOverlay, type ProfileTabsOverlayHandle } from '../profile-tabs-overlay';

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    usePanGesture: () => ({}),
    useNativeGesture: () => ({}),
    GestureDetector: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    GestureHandlerRootView: View,
  };
});

const options = [
  { key: 'posts' as const, label: 'Publicações' },
  { key: 'media' as const, label: 'Mídia' },
];

beforeEach(() => { jest.clearAllMocks(); });

describe('overlay de abas do perfil', () => {
  it('consulta o Reduce Motion em todas as transições automáticas da barra', () => {
    for (const timing of Object.values(PROFILE_TABS_OVERLAY_TIMING)) {
      expect(timing.reduceMotion).toBe('system');
    }
  });

  it('monta sob demanda, alterna sem duplicar e mantém as abas acessíveis', async () => {
    const ref = createRef<ProfileTabsOverlayHandle>();
    const onChange = jest.fn();
    await render(<ProfileTabsOverlay ref={ref} options={options} value="posts" onChange={onChange} />);

    expect(screen.queryByTestId('profile-tabs-overlay')).toBeNull();

    await act(async () => { ref.current?.setVisible(true); });
    const overlay = screen.getByTestId('profile-tabs-overlay');
    expect(overlay.props.pointerEvents).toBe('auto');
    expect(screen.getByRole('tab', { name: 'Mídia' })).toBeTruthy();

    await act(async () => { ref.current?.setVisible(true); });
    expect(screen.getByTestId('profile-tabs-overlay').props.pointerEvents).toBe('auto');
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('tab', { name: 'Mídia' }));
    expect(onChange).toHaveBeenCalledWith('media');

    await act(async () => { ref.current?.hide(); });
    const hidden = screen.getByTestId('profile-tabs-overlay', { includeHiddenElements: true });
    expect(hidden.props.pointerEvents).toBe('none');
    expect(hidden.props.accessibilityElementsHidden).toBe(true);
  });
});
