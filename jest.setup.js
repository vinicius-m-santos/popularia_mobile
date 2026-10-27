import { jest } from '@jest/globals';

// Testes unitários não inicializam timers nem módulos nativos de um fornecedor externo.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(), setUser: jest.fn(), addBreadcrumb: jest.fn(), captureException: jest.fn(),
  withScope: jest.fn((callback) => callback({ setTag: jest.fn(), setLevel: jest.fn() })),
  wrap: (component) => component,
}));
