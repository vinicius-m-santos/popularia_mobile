import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';

import { PhotoHarnessScreen } from '../photo-harness-screen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
  useSegments: () => ['(tabs)'],
}));
jest.mock('../photo-harness', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PhotoQaHarness: ({ variant }: { variant?: string }) => <Text>{`feed:${variant ?? 'original'}`}</Text> };
});

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
const originalFlag = process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION;

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  delete process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION;
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

describe('tela do feed de fotos 2048px', () => {
  it('pede para iniciar a medição e então monta o feed original', async () => {
    await render(<PhotoHarnessScreen />);
    expect(screen.getByText('Medição parada')).toBeTruthy();
    expect(screen.queryByText('feed:original')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Iniciar medição'));

    expect(getPerformanceSnapshot().sessionId).not.toBeNull();
    expect(screen.getByText('feed:original')).toBeTruthy();
    expect(screen.getByText('Cenário de decodificação')).toBeTruthy();
  });

  it('troca para a variante simulada e zera a sessão para não misturar agregados', async () => {
    await render(<PhotoHarnessScreen />);
    await fireEvent.press(screen.getByLabelText('Iniciar medição'));
    const originalSession = getPerformanceSnapshot().sessionId;

    await fireEvent.press(screen.getByLabelText('Usar variante simulada de até 512 pixels'));

    expect(screen.getByText('feed:small')).toBeTruthy();
    expect(getPerformanceSnapshot().sessionId).not.toBe(originalSession);
    expect(screen.getByText('Variante 512')).toBeTruthy();
  });

  it('não monta o feed com a flag ligada sem uma sessão criada', async () => {
    process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION = '1';
    await render(<PhotoHarnessScreen />);

    expect(screen.getByText('Medição parada')).toBeTruthy();
    expect(screen.queryByText('feed:original')).toBeNull();
  });

  it('fica indisponível em produção', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    await render(<PhotoHarnessScreen />);

    expect(screen.getByText('Harness indisponível')).toBeTruthy();
    expect(screen.queryByLabelText('Iniciar medição')).toBeNull();
  });
});
