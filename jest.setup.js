import { jest } from '@jest/globals';

// Testes unitários não inicializam timers nem módulos nativos de um fornecedor externo.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(), setUser: jest.fn(), addBreadcrumb: jest.fn(), captureException: jest.fn(),
  withScope: jest.fn((callback) => callback({ setTag: jest.fn(), setLevel: jest.fn() })),
  wrap: (component) => component,
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

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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
  const Sheet = React.forwardRef(({ children, handleComponent: Handle, onClose, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({ close: () => onClose?.(), snapToIndex: () => {} }));
    return React.createElement(View, { ...props, testID: 'gorhom-sheet' },
      Handle ? React.createElement(Handle) : null,
      React.createElement(Pressable, { accessibilityLabel: 'Fechar', onPress: () => { if (props.enablePanDownToClose) onClose?.(); } }),
      children);
  });
  return { ...official, __esModule: true, default: Sheet };
});
