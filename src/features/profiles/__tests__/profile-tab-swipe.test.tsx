import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { PROFILE_SWIPE_CANCEL_TIMING, PROFILE_SWIPE_RETURN_TIMING, ProfileSwipeGuard, ProfileTabSwipe } from '../profile-tab-swipe';

type GestureLog = {
  panGestures: { type: string; config?: unknown }[];
  nativeConfigs: unknown[];
  detectors: { type?: string }[];
};

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockAnimatedView({ children, style }: { children?: React.ReactNode; style?: object }) {
    return React.createElement(View, { style }, children);
  }
  return {
    __esModule: true,
    default: { View: MockAnimatedView },
    cancelAnimation: () => {},
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (updater: () => object) => updater(),
    withTiming: (value: number) => value,
    runOnJS: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    interpolateColor: (value: number, _input: number[], output: string[]) => output[value >= 1 ? output.length - 1 : 0],
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const store = globalThis as { __tabSwipeGestureLog?: GestureLog };
  const log = store.__tabSwipeGestureLog ?? { panGestures: [], nativeConfigs: [], detectors: [] };
  store.__tabSwipeGestureLog = log;
  return {
    usePanGesture: (config?: unknown) => {
      const pan = { type: 'pan', config };
      log.panGestures.push(pan);
      return pan;
    },
    useNativeGesture: (config?: unknown) => {
      log.nativeConfigs.push(config);
      return { type: 'native', config };
    },
    GestureDetector: ({ gesture, children }: { gesture: { type?: string }; children: React.ReactNode }) => {
      log.detectors.push(gesture);
      return React.createElement(View, null, children);
    },
  };
});

function gestureLog(): GestureLog {
  const store = globalThis as { __tabSwipeGestureLog?: GestureLog };
  const log = store.__tabSwipeGestureLog ?? { panGestures: [], nativeConfigs: [], detectors: [] };
  store.__tabSwipeGestureLog = log;
  return log;
}

beforeEach(() => {
  const log = gestureLog();
  log.panGestures.length = 0;
  log.nativeConfigs.length = 0;
  log.detectors.length = 0;
});

afterEach(() => cleanup());

describe('movimento do swipe de abas', () => {
  it('consulta o Reduce Motion no assentamento automático, não no arrasto preso ao dedo', () => {
    expect(PROFILE_SWIPE_RETURN_TIMING).toEqual({ duration: 200, reduceMotion: 'system' });
    expect(PROFILE_SWIPE_CANCEL_TIMING).toEqual({ duration: 160, reduceMotion: 'system' });
  });
});

describe('trilhos horizontais sob o swipe de abas', () => {
  it('bloqueia o pan da aba com um gesto nativo do trilho', async () => {
    await render(
      <ProfileTabSwipe tabs={['posts', 'media']} active="posts" onChange={() => {}}>
        <ProfileSwipeGuard><Text>Trilho de coleções</Text></ProfileSwipeGuard>
      </ProfileTabSwipe>,
    );

    const pan = gestureLog().panGestures[0];
    expect(pan).toBeTruthy();
    expect(gestureLog().nativeConfigs).toContainEqual({ block: pan });
    expect(gestureLog().detectors.some((gesture) => gesture.type === 'native')).toBe(true);
    expect(screen.getByText('Trilho de coleções')).toBeTruthy();
  });

  it('fora das abas entrega o conteúdo sem detector nem bloqueio', async () => {
    await render(<ProfileSwipeGuard><Text>Catálogo público</Text></ProfileSwipeGuard>);

    expect(screen.getByText('Catálogo público')).toBeTruthy();
    expect(gestureLog().nativeConfigs).toEqual([]);
    expect(gestureLog().detectors).toHaveLength(0);
  });
});
