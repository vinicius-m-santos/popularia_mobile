import { jest } from '@jest/globals';

// Testes unitários não inicializam timers nem módulos nativos de um fornecedor externo.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(), setUser: jest.fn(), addBreadcrumb: jest.fn(), captureException: jest.fn(),
  withScope: jest.fn((callback) => callback({ setTag: jest.fn(), setLevel: jest.fn() })),
  wrap: (component) => component,
}));

// Haptics é opcional e nativo: nos testes o serviço continua sendo exercitado,
// mas sem motor. Os valores dos enums são os mesmos do expo-haptics 58.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  performAndroidHapticsAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: {
    Segment_Tick: 'segment-tick',
    Virtual_Key: 'virtual-key',
    Confirm: 'confirm',
    Reject: 'reject',
  },
}));

// ReanimatedSwipeable roda na UI thread no aparelho. Nos testes de componentes,
// preservamos filhos/ref; os callbacks acessíveis são exercitados diretamente.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Swipeable = React.forwardRef(({ children }, ref) => {
    React.useImperativeHandle(ref, () => ({ close: jest.fn(), openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() }));
    return React.createElement(View, null, children);
  });
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});

// Mock manual: o mock oficial carrega a implementação nativa de `react-native-worklets`, que
// não existe no Jest. Aqui só o que as telas usam vira no-op determinístico.
jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView } = require('react-native');
  const createAnimatedComponent = (component) => component;
  const Animated = { View, Text, ScrollView, createAnimatedComponent };
  // FadeIn.duration(220).reduceMotion(...) — qualquer cadeia devolve a si mesma.
  const chain = new Proxy(function chainable() {}, { get: () => chain, apply: () => chain });
  const identity = (value) => value;
  return {
    __esModule: true,
    default: Animated,
    View,
    Text,
    ScrollView,
    FadeIn: chain,
    FadeInDown: chain,
    FadeInUp: chain,
    FadeOut: chain,
    FadeOutDown: chain,
    createAnimatedComponent,
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    useDerivedValue: (factory) => ({ value: typeof factory === 'function' ? factory() : undefined }),
    useAnimatedRef: () => ({ current: null }),
    withTiming: identity,
    withSpring: identity,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: identity,
    cancelAnimation: () => {},
    runOnJS: identity,
    runOnUI: identity,
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    interpolate: identity,
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: { linear: identity, ease: identity, out: (fn) => fn, inOut: (fn) => fn, bezier: () => identity },
  };
});

// Mantém a lista real, simulando apenas medidas que exigem layout nativo.
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => ({
  ...jest.requireActual('@shopify/flash-list/dist/recyclerview/utils/measureLayout'),
  // Funções simples sobrevivem ao resetAllMocks dos testes existentes.
  measureParentSize: () => ({ width: 400, height: 900 }),
  measureFirstChildLayout: () => ({ x: 0, y: 0, width: 400, height: 900 }),
  measureItemLayout: () => ({ x: 0, y: 0, width: 100, height: 100 }),
}));

// O Modal nativo preserva os contextos da tela. O mock oficial fornece scrollables;
// close simula somente o callback terminal, nunca a física ou o teclado nativo.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  const official = require('@gorhom/bottom-sheet/mock');
  // Espiões para os testes verificarem a ordem de abertura e o fechamento.
  const snapToIndex = jest.fn();
  const close = jest.fn();
  const Sheet = React.forwardRef(({ children, handleComponent: Handle, onClose, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({ close: () => { close(); onClose?.(); }, snapToIndex }));
    return React.createElement(View, { ...props, testID: 'gorhom-sheet' },
      Handle ? React.createElement(Handle) : null,
      React.createElement(Pressable, { accessibilityLabel: 'Fechar', onPress: () => { if (props.enablePanDownToClose) onClose?.(); } }),
      children);
  });
  return { ...official, __esModule: true, default: Sheet, __snapToIndex: snapToIndex, __close: close };
});
