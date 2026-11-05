import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';

import { PerformanceHarnessScreen } from '../performance-harness-screen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
  useSegments: () => ['(tabs)'],
}));
jest.mock('../qa-harness', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PerformanceQaHarness: () => <Text>20 cartões montados</Text> };
});

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
const originalFlag = process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION;

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
  if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION;
  else process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION = originalFlag;
});

describe('tela do harness de 20 posts', () => {
  it('pede para iniciar a medição e então monta o harness existente', async () => {
    await render(<PerformanceHarnessScreen />);
    expect(screen.getByText('Medição parada')).toBeTruthy();
    expect(screen.queryByText('20 cartões montados')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Iniciar medição'));

    expect(getPerformanceSnapshot().sessionId).not.toBeNull();
    expect(screen.getByText('20 cartões montados')).toBeTruthy();
    expect(screen.getByText('Cenário de renderização')).toBeTruthy();
  });

  it('não monta o harness com a flag ligada sem uma sessão criada', async () => {
    process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION = '1';
    await render(<PerformanceHarnessScreen />);

    expect(screen.getByText('Medição parada')).toBeTruthy();
    expect(screen.queryByText('20 cartões montados')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Iniciar medição'));
    expect(getPerformanceSnapshot().sessionId).not.toBeNull();
    expect(screen.getByText('20 cartões montados')).toBeTruthy();
  });

  it('fica indisponível em produção', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    await render(<PerformanceHarnessScreen />);

    expect(screen.getByText('Harness indisponível')).toBeTruthy();
    expect(screen.queryByLabelText('Iniciar medição')).toBeNull();
  });
});
