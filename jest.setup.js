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
