import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import { ToastProvider } from '@/components/toast';
import {
  createRequestTrace,
  finishRequest,
  getPerformanceSnapshot,
  recordListLoad,
  recordProfileCommit,
  recordRequestAttempt,
  recordVideoFirstFrame,
  recordVideoMount,
  recordVideoPlay,
  resetPerformanceSession,
  setPerformanceInstrumentationOverride,
} from '@/lib/performance';

import { PerformanceDiagnosticsScreen } from '../performance-diagnostics-screen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
    useSegments: () => ['(tabs)'],
  };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

function seedMeasurements() {
  const trace = createRequestTrace('/feed?token=segredo', 'GET', { screen: 'feed', action: 'initial' })!;
  recordRequestAttempt(trace, 20, 'success', 200);
  finishRequest(trace, 'success');
  recordProfileCommit({ component: 'PostCard', instanceId: 'PostCard:1', phase: 'mount', actualDurationMs: 6, baseDurationMs: 8 });
  recordListLoad('feed:para-voce', 84.4, 20);
  recordVideoMount('video-1');
  recordVideoPlay('video-1');
  recordVideoFirstFrame('video-1', 320);
}

function renderScreen() {
  return render(<ToastProvider><PerformanceDiagnosticsScreen /></ToastProvider>);
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
  jest.clearAllMocks();
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
});

describe('tela de diagnóstico de performance', () => {
  it('começa parada, inicia a medição e passa a mostrar o resumo', async () => {
    await renderScreen();
    expect(screen.getByText('Coleta parada')).toBeTruthy();
    expect(screen.getByText('Nenhuma coleta iniciada')).toBeTruthy();
    expect(screen.queryByText('Resumo')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Iniciar medição'));

    expect(getPerformanceSnapshot().sessionId).not.toBeNull();
    expect(screen.getByText('Coleta ativa')).toBeTruthy();
    expect(screen.getByLabelText('Resetar medição')).toBeTruthy();
    expect(screen.getByText('Resumo')).toBeTruthy();
    expect(screen.getByText('Requests lógicas')).toBeTruthy();
  });

  it('mostra requests, retries, commits, onLoad e TTFF da sessão existente', async () => {
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();
    seedMeasurements();

    await renderScreen();

    expect(screen.getByText('GET /feed')).toBeTruthy();
    expect(screen.getByText('feed')).toBeTruthy();
    expect(screen.getByText('PostCard')).toBeTruthy();
    expect(screen.getByText('Tentativas HTTP')).toBeTruthy();
    expect(screen.getByText('feed:para-voce')).toBeTruthy();
    expect(screen.getByText('TTFF máximo')).toBeTruthy();
    expect(screen.getAllByText('320 ms').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Pôsteres de vídeo')).toBeTruthy();
    expect(screen.getByTestId('metric-poster-cache')).toBeTruthy();
    expect(screen.queryByText('/feed?token=segredo')).toBeNull();
  });

  it('zera a medição sem desligar a instrumentação', async () => {
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();
    seedMeasurements();
    const before = getPerformanceSnapshot().sessionId;

    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Resetar medição'));

    expect(getPerformanceSnapshot().sessionId).not.toBe(before);
    expect(getPerformanceSnapshot().enabled).toBe(true);
    expect(screen.getAllByText('Nenhuma request concluída nesta sessão.').length).toBeGreaterThanOrEqual(1);
  });

  it('exporta o JSON pela folha de compartilhamento', async () => {
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();
    seedMeasurements();

    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Exportar JSON'));

    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('JSON pronto para compartilhar.', { includeHiddenElements: true })).toBeTruthy());
  });

  it('inicia uma sessão ao abrir o harness e navega para a rota de diagnóstico', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Abrir harness de 20 posts'));

    expect(getPerformanceSnapshot().sessionId).not.toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/diagnostico-performance-harness');
  });

  it('não expõe a tela em produção', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    await renderScreen();

    expect(screen.getByText('Diagnóstico indisponível')).toBeTruthy();
    expect(screen.queryByLabelText('Iniciar medição')).toBeNull();
    expect(screen.queryByText('Resumo')).toBeNull();
  });
});
