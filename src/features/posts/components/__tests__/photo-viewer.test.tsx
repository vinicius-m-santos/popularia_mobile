import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PhotoViewer } from '../photo-viewer';

type PinchConfig = {
  onBegin?: () => void;
  onActivate?: (event: { focalX: number; focalY: number }) => void;
  onUpdate?: (event: { scaleChange: number }) => void;
  onDeactivate?: () => void;
};

type TapConfig = {
  onDeactivate?: (event: { x: number; y: number }) => void;
};

type Transform = { transform: Record<string, number>[] };
type Timing = { value: unknown; config?: { duration?: number; reduceMotion?: string } };

const mockGestures: { pinch?: PinchConfig; tap?: TapConfig } = {};
const mockStyles: (() => Transform)[] = [];
const mockTimings: Timing[] = [];

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: View,
    usePinchGesture: (config: PinchConfig) => {
      mockGestures.pinch = config;
      return { type: 'pinch' };
    },
    usePanGesture: () => ({ type: 'pan' }),
    useTapGesture: (config: TapConfig) => {
      mockGestures.tap = config;
      return { type: 'tap' };
    },
    useSimultaneousGestures: (...gestures: unknown[]) => gestures,
  };
});

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View, Text, ScrollView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, Text, ScrollView, createAnimatedComponent: (component: unknown) => component },
    View,
    Text,
    ScrollView,
    useSharedValue: (value: unknown) => {
      const ref = React.useRef({ value });
      return ref.current;
    },
    useAnimatedStyle: (factory: () => Transform) => {
      mockStyles.push(factory);
      return {};
    },
    withTiming: (value: unknown, config?: Timing['config']) => {
      mockTimings.push({ value, config });
      return value;
    },
    cancelAnimation: () => {},
    runOnJS: (run: unknown) => run,
    clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

async function layout(width: number, height: number) {
  await fireEvent(screen.getByTestId('photo-viewer-viewport'), 'layout', {
    nativeEvent: { layout: { width, height } },
  });
}

function currentTransform(): Transform {
  return mockStyles[mockStyles.length - 1]();
}

describe('PhotoViewer', () => {
  beforeEach(() => {
    mockGestures.pinch = undefined;
    mockGestures.tap = undefined;
    mockStyles.length = 0;
    mockTimings.length = 0;
  });

  it('amplia em volta do ponto entre os dedos e mantém a imagem dentro das bordas', async () => {
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pinch?.onBegin?.();
    mockGestures.pinch?.onActivate?.({ focalX: 100, focalY: 200 });
    mockGestures.pinch?.onUpdate?.({ scaleChange: 2 });

    expect(currentTransform().transform).toEqual([
      { translateX: 100 },
      { translateY: 200 },
      { scale: 2 },
    ]);
  });

  it('assenta no zoom máximo sem deslocar além do limite', async () => {
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pinch?.onBegin?.();
    mockGestures.pinch?.onActivate?.({ focalX: 1, focalY: 1 });
    mockGestures.pinch?.onUpdate?.({ scaleChange: 2 });
    mockGestures.pinch?.onUpdate?.({ scaleChange: 4 });

    expect(currentTransform().transform).toEqual([
      { translateX: 597 },
      { translateY: 1197 },
      { scale: 4 },
    ]);
  });

  it('recoloca a imagem ao girar a área útil', async () => {
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pinch?.onBegin?.();
    mockGestures.pinch?.onActivate?.({ focalX: 100, focalY: 200 });
    mockGestures.pinch?.onUpdate?.({ scaleChange: 2 });
    await layout(800, 400);

    const transform = currentTransform().transform;
    expect(transform).toEqual([
      { translateX: 0 },
      { translateY: 200 },
      { scale: 2 },
    ]);
  });

  it('não transforma um gesto de movimento em duplo toque', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pinch?.onBegin?.();
    mockGestures.pinch?.onActivate?.({ focalX: 100, focalY: 200 });
    mockGestures.pinch?.onUpdate?.({ scaleChange: 2 });
    now.mockReturnValue(300);
    mockGestures.tap?.onDeactivate?.({ x: 100, y: 200 });

    expect(currentTransform().transform).toEqual([
      { translateX: 100 },
      { translateY: 200 },
      { scale: 2 },
    ]);
    now.mockRestore();
  });

  it('usa movimento reduzido do sistema nas transições automáticas', async () => {
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pinch?.onBegin?.();
    mockGestures.pinch?.onActivate?.({ focalX: 100, focalY: 200 });
    mockGestures.pinch?.onUpdate?.({ scaleChange: 2 });
    mockTimings.length = 0;
    mockGestures.pinch?.onDeactivate?.();

    expect(mockTimings.length).toBeGreaterThan(0);
    for (const timing of mockTimings) {
      expect(timing.config?.reduceMotion).toBe('system');
    }
  });

  it('preserva o duplo toque no ponto tocado', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.tap?.onDeactivate?.({ x: 100, y: 200 });

    expect(currentTransform().transform).toEqual([
      { translateX: 150 },
      { translateY: 300 },
      { scale: 2.5 },
    ]);
    now.mockRestore();
  });
});
