import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import type { ImageRef } from 'expo-image';
import { AccessibilityInfo } from 'react-native';

import { resetReducedMotionCache } from '@/hooks/use-reduced-motion';
import { haptic } from '@/lib/haptics';
import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';

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
    interpolateColor: (value: number, _input: number[], output: string[]) => output[value >= 1 ? output.length - 1 : 0],
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});

jest.mock('@/lib/haptics', () => ({ haptic: jest.fn() }));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
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
    resetReducedMotionCache();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    setPerformanceInstrumentationOverride(false);
    mockGestures.pinch = undefined;
    mockGestures.pan = undefined;
    mockGestures.tap = undefined;
    mockStyles.length = 0;
    mockTimings.length = 0;
    mockSprings.length = 0;
  });

  afterEach(() => {
    setPerformanceInstrumentationOverride(null);
    resetReducedMotionCache();
    jest.restoreAllMocks();
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

  it('desliga o fade do modal e a transição da imagem com movimento reduzido', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    await waitFor(() => expect(screen.getByTestId('photo-viewer-modal').props.animationType).toBe('none'));
    expect(screen.getByTestId('photo-viewer-image').props.transition).toBeNull();
  });

  it('expõe foco modal, imagem rotulada e saída por gesto assistivo', async () => {
    const onClose = jest.fn();
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={onClose} width={400} height={800} />);
    await layout(400, 800);

    expect(screen.getByTestId('photo-viewer-root').props.accessibilityViewIsModal).toBe(true);
    const image = screen.getByLabelText('Foto da publicação em tela cheia');
    expect(image.props.accessibilityRole).toBe('image');
    await fireEvent(screen.getByTestId('photo-viewer-root'), 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('abre com a listra da casa antes do primeiro layout, sem quadro preto', async () => {
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);

    // O Modal abre antes de a viewport medir: já existe uma superfície editorial,
    // não o vazio de tinta.
    expect(screen.getByTestId('photo-viewer-stripes', { includeHiddenElements: true })).toBeTruthy();

    await layout(400, 800);
    // A listra continua sob a original enquanto a decodificação acontece.
    expect(screen.getByTestId('photo-viewer-stripes', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-image')).toBeTruthy();
  });

  it('usa o bitmap já decodificado do feed como camada imediata', async () => {
    const preview = { width: 400, height: 800 } as unknown as ImageRef;
    await render(<PhotoViewer uri="https://example.test/foto.jpg" preview={preview} visible onClose={() => {}} width={400} height={800} />);

    expect(screen.getByTestId('photo-viewer-preview', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('photo-viewer-stripes', { includeHiddenElements: true })).toBeNull();
  });

  it('decodifica a original inteira para o zoom e reduz só acima do teto de pixels', async () => {
    const view = await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    expect(screen.getByTestId('photo-viewer-image').props.allowDownscaling).toBe(false);
    expect(screen.getByTestId('photo-viewer-image').props.transition).toEqual({ duration: 160, skipOnCacheHit: 'all' });

    await view.rerender(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={3000} height={3000} />);
    await layout(400, 800);
    expect(screen.getByTestId('photo-viewer-image').props.allowDownscaling).toBe(true);
  });

  it('mede abertura, carregamento, exibição e o tamanho do bitmap', async () => {
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();
    await render(<PhotoViewer mediaId="photo-1" uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    await fireEvent(screen.getByTestId('photo-viewer-image'), 'load', {
      source: { width: 400, height: 800 },
      cacheType: 'memory',
    });
    await fireEvent(screen.getByTestId('photo-viewer-image'), 'display');
    // Eventos repetidos da mesma abertura não inflam a média.
    await fireEvent(screen.getByTestId('photo-viewer-image'), 'display');

    const photos = getPerformanceSnapshot().photos;
    expect(photos).toMatchObject({
      openCount: 1,
      loadCount: 1,
      displayCount: 1,
      errorCount: 0,
      memoryCacheHits: 1,
      diskCacheHits: 0,
      networkLoads: 0,
      largestDecodedBytes: 400 * 800 * 4,
    });
    expect(photos.events.map((event) => event.event)).toEqual(['open', 'load', 'display']);
    expect(photos.events[1]).toMatchObject({ mediaId: 'photo-1', width: 400, height: 800, cacheType: 'memory' });
    // A URL não entra no relatório: só o identificador estável.
    expect(JSON.stringify(photos)).not.toContain('example.test');
  });

  it('mostra fallback de erro sem apagar a listra', async () => {
    await render(<PhotoViewer uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    await fireEvent(screen.getByTestId('photo-viewer-image'), 'error', { error: 'falhou' });

    expect(screen.getByText('Não foi possível carregar a imagem.')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-stripes', { includeHiddenElements: true })).toBeTruthy();
  });

  it('leva a camada da origem medida até o quadro final antes de mostrar a foto', async () => {
    const origin = { x: 20, y: 120, width: 180, height: 240 };
    await render(<PhotoViewer origin={origin} uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);

    // A camada já nasce no primeiro quadro e o conteúdo normal espera a chegada.
    expect(screen.getByTestId('photo-viewer-transition', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-modal').props.animationType).toBe('none');

    await layout(400, 800);

    // Destino: foto 400 × 800 centralizada na viewport de 400 × 800. A última
    // medida é a largura, cujo callback fecha a sessão.
    expect(mockTimings.map((timing) => timing.value)).toEqual([0, 0, 800, 1, 400]);
    for (const timing of mockTimings) {
      expect(timing.config?.reduceMotion).toBe('system');
    }
    expect(screen.getByTestId('photo-viewer-fit')).toHaveStyle({ opacity: 0 });

    const completion = mockTimings.find((timing) => timing.value === 400 && timing.callback);
    await act(async () => { completion?.callback?.(true); });

    await waitFor(() => expect(screen.queryByTestId('photo-viewer-transition', { includeHiddenElements: true })).toBeNull());
    expect(screen.getByTestId('photo-viewer-fit')).not.toHaveStyle({ opacity: 0 });
  });

  it('mantém o fade nativo quando não há origem válida', async () => {
    await render(<PhotoViewer origin={{ x: 0, y: 0, width: 0, height: 0 }} uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await layout(400, 800);

    expect(screen.getByTestId('photo-viewer-modal').props.animationType).toBe('fade');
    expect(screen.queryByTestId('photo-viewer-transition', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('photo-viewer-fit')).not.toHaveStyle({ opacity: 0 });
    expect(currentOpacity()).toBe(1);
    expect(mockTimings).toHaveLength(0);
  });

  it('volta ao fade nativo assim que a origem é liberada no fechamento', async () => {
    const origin = { x: 20, y: 120, width: 180, height: 240 };
    const view = await render(<PhotoViewer origin={origin} uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    expect(screen.getByTestId('photo-viewer-modal').props.animationType).toBe('none');

    await view.rerender(<PhotoViewer origin={null} uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    expect(screen.getByTestId('photo-viewer-modal').props.animationType).toBe('fade');
  });

  it('não anima a transição com movimento reduzido, mesmo com origem medida', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const origin = { x: 20, y: 120, width: 180, height: 240 };
    await render(<PhotoViewer origin={origin} uri="https://example.test/foto.jpg" visible onClose={() => {}} width={400} height={800} />);
    await waitFor(() => expect(screen.getByTestId('photo-viewer-modal').props.animationType).toBe('none'));

    mockTimings.length = 0;
    await layout(400, 800);

    expect(screen.queryByTestId('photo-viewer-transition', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('photo-viewer-image').props.transition).toBeNull();
    expect(currentOpacity()).toBe(1);
    expect(mockTimings).toHaveLength(0);
  });
});
