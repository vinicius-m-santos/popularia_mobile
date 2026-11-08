import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { resetMockRouteFocused, setMockRouteFocused } from '@/hooks/testing/route-focus';
import type { MediaVisibility } from '@/hooks/use-list-visibility';

import { useRouteMediaFocus } from '../use-route-media-focus';

jest.mock('expo-router', () => {
  const { useMockFocusEffect } = jest.requireActual<typeof import('@/hooks/testing/route-focus')>('@/hooks/testing/route-focus');
  return { useFocusEffect: useMockFocusEffect };
});

function fakeVisibility(): MediaVisibility {
  let focused = true;
  return {
    isVisible: () => focused,
    visibleSince: () => (focused ? 1 : null),
    setFocused: jest.fn((next: boolean) => { focused = next; }),
    subscribe: () => () => {},
    onViewableItemsChanged: jest.fn(),
    clear: jest.fn(),
  };
}

describe('useRouteMediaFocus', () => {
  beforeEach(() => resetMockRouteFocused());

  it('desliga a mídia no blur e reabilita no foco', async () => {
    const visibility = fakeVisibility();
    await renderHook(() => useRouteMediaFocus(visibility));

    expect(visibility.setFocused).toHaveBeenCalledWith(true);
    jest.mocked(visibility.setFocused).mockClear();

    await act(async () => {
      setMockRouteFocused(false);
    });
    expect(visibility.setFocused).toHaveBeenCalledWith(false);

    jest.mocked(visibility.setFocused).mockClear();
    await act(async () => {
      setMockRouteFocused(true);
    });
    expect(visibility.setFocused).toHaveBeenCalledWith(true);
  });
});
