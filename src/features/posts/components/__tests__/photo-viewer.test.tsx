import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { haptic } from '@/lib/haptics';

import { PhotoViewer } from '../photo-viewer';
import { DISMISS_FADE_DISTANCE } from '../photo-viewer-geometry';

type PanConfig = {
  onBegin?: () => void;
  onUpdate?: (event: { translationX: number; translationY: number }) => void;
  onDeactivate?: (event: { velocityY: number }) => void;
  onFinalize?: (event: { canceled?: boolean }) => void;
};

type PinchConfig = {
  onBegin?: () => void;
  onActivate?: (event: { focalX: number; focalY: number }) => void;
  onUpdate?: (event: { scaleChange: number }) => void;
  onDeactivate?: () => void;
  onFinalize?: () => void;
};

type TapConfig = {
  onDeactivate?: (event: { x: number; y: number }) => void;
};

type Transform = { transform: Record<string, number>[] };
type Style = Transform | { opacity: number };
type Timing = {
  value: unknown;
  config?: { duration?: number; reduceMotion?: string };
  callback?: (finished: boolean) => void;
};
type Spring = {
  value: unknown;
  config?: { reduceMotion?: string; velocity?: number };
};

const mockGestures: { pinch?: PinchConfig; pan?: PanConfig; tap?: TapConfig } = {};
const mockStyles: (() => Style)[] = [];
const mockTimings: Timing[] = [];
const mockSprings: Spring[] = [];

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
    usePanGesture: (config: PanConfig) => {
      mockGestures.pan = config;
      return { type: 'pan' };
    },
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
    useAnimatedStyle: (factory: () => Style) => {
      mockStyles.push(factory);
      return {};
    },
    withTiming: (value: unknown, config?: Timing['config'], callback?: Timing['callback']) => {
      mockTimings.push({ value, config, callback });
      return value;
    },
    withSpring: (value: unknown, config?: Spring['config']) => {
      mockSprings.push({ value, config });
      return value;
    },
    cancelAnimation: () => {},
    runOnJS: (run: unknown) => run,
    clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});

jest.mock('@/lib/haptics', () => ({ haptic: jest.fn() }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

async function layout(width: number, height: number) {
  await fireEvent(screen.getByTestId('photo-viewer-viewport'), 'layout', {
    nativeEvent: { layout: { width, height } },
  });
}

function currentTransform(): Transform {
  for (let index = mockStyles.length - 1; index >= 0; index -= 1) {
    const style = mockStyles[index]();
    if ('transform' in style) return style;
  }
  throw new Error('Nenhum estilo de transform foi registrado.');
}

function currentOpacity(): number {
  for (let index = mockStyles.length - 1; index >= 0; index -= 1) {
    const style = mockStyles[index]();
    if ('opacity' in style) return style.opacity;
  }
  throw new Error('Nenhum estilo de opacidade foi registrado.');
}

describe('PhotoViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGestures.pinch = undefined;
    mockGestures.pan = undefined;
    mockGestures.tap = undefined;
    mockStyles.length = 0;
    mockTimings.length = 0;
    mockSprings.length = 0;
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
    expect(haptic).toHaveBeenCalledWith('selection');
    now.mockRestore();
  });

  it('acompanha o dedo e apaga o backdrop durante o arrasto', async () => {
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pan?.onBegin?.();
    mockGestures.pan?.onUpdate?.({ translationX: 20, translationY: 60 });

    expect(currentTransform().transform).toEqual([
      { translateX: 10 },
      { translateY: 60 },
      { scale: 1 },
    ]);
    expect(currentOpacity()).toBeCloseTo(1 - 60 / DISMISS_FADE_DISTANCE, 5);
  });

  it('devolve ao centro com mola quando o arrasto é curto', async () => {
    const onClose = jest.fn();
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pan?.onBegin?.();
    mockGestures.pan?.onUpdate?.({ translationX: 20, translationY: 60 });
    mockGestures.pan?.onDeactivate?.({ velocityY: 0 });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockTimings).toHaveLength(0);
    expect(mockSprings.map((spring) => spring.value)).toEqual([0, 0]);
    for (const spring of mockSprings) {
      expect(spring.config?.reduceMotion).toBe('system');
    }
    expect(currentTransform().transform).toEqual([
      { translateX: 0 },
      { translateY: 0 },
      { scale: 1 },
    ]);
  });

  it('descarta pela distância e só devolve o callback depois da animação', async () => {
    const onClose = jest.fn();
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pan?.onBegin?.();
    mockGestures.pan?.onUpdate?.({ translationX: 0, translationY: 140 });
    mockGestures.pan?.onDeactivate?.({ velocityY: 0 });

    expect(onClose).not.toHaveBeenCalled();
    const dismissal = mockTimings[mockTimings.length - 1];
    expect(dismissal.value).toBe(864);
    expect(dismissal.config?.reduceMotion).toBe('system');

    dismissal.callback?.(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('descarta por velocidade mesmo com arrasto curto', async () => {
    const onClose = jest.fn();
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pan?.onBegin?.();
    mockGestures.pan?.onUpdate?.({ translationX: 0, translationY: 60 });
    mockGestures.pan?.onDeactivate?.({ velocityY: 1200 });

    const dismissal = mockTimings[mockTimings.length - 1];
    dismissal.callback?.(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('não descarta quando uma pinça aconteceu no mesmo contato', async () => {
    const onClose = jest.fn();
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pan?.onBegin?.();
    mockGestures.pinch?.onBegin?.();
    mockGestures.pinch?.onActivate?.({ focalX: 200, focalY: 400 });
    mockGestures.pinch?.onUpdate?.({ scaleChange: 2 });
    mockGestures.pan?.onUpdate?.({ translationX: 0, translationY: 400 });
    mockGestures.pan?.onDeactivate?.({ velocityY: 2000 });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockTimings).toHaveLength(0);
    expect(currentTransform().transform).toEqual([
      { translateX: 0 },
      { translateY: 0 },
      { scale: 2 },
    ]);
    // Com zoom, o fundo continua opaco: a pinça não parece um descarte.
    expect(currentOpacity()).toBe(1);
  });

  it('devolve ao centro quando o gesto é cancelado antes de soltar', async () => {
    const onClose = jest.fn();
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pan?.onBegin?.();
    mockGestures.pan?.onUpdate?.({ translationX: 0, translationY: 80 });
    mockGestures.pan?.onFinalize?.({ canceled: true });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockSprings.map((spring) => spring.value)).toEqual([0, 0]);
    expect(currentTransform().transform).toEqual([
      { translateX: 0 },
      { translateY: 0 },
      { scale: 1 },
    ]);
  });

  it('fecha pelo botão acessível e pelo voltar do Android', async () => {
    const onClose = jest.fn();
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);

    fireEvent.press(screen.getByLabelText('Fechar foto'));
    screen.getByTestId('photo-viewer-modal').props.onRequestClose?.();

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Fechar foto' })).toBeTruthy();
  });

  it('reabre com posição e backdrop limpos depois de um descarte', async () => {
    const onClose = jest.fn();
    const view = await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    await layout(400, 800);

    mockGestures.pan?.onBegin?.();
    mockGestures.pan?.onUpdate?.({ translationX: 0, translationY: 140 });
    mockGestures.pan?.onDeactivate?.({ velocityY: 0 });
    mockTimings[mockTimings.length - 1].callback?.(true);

    await view.rerender(<PhotoViewer uri="https://example.test/foto.jpg" visible={false} onClose={onClose} width={400} height={800} />);
    await view.rerender(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    // O Modal nativo avisa quando abriu; é o ponto em que o estado do descarte
    // anterior é limpo antes de a foto reaparecer.
    screen.getByTestId('photo-viewer-modal').props.onShow?.();

    expect(currentTransform().transform).toEqual([
      { translateX: 0 },
      { translateY: 0 },
      { scale: 1 },
    ]);
    expect(currentOpacity()).toBe(1);
  });
});
