import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  createRequestTrace,
  finishRequest,
  getPerformanceSnapshot,
  performanceDiagnosticsAvailable,
  recordListLoad,
  recordProfileCommit,
  recordRequestAttempt,
  recordVideoFirstFrame,
  recordVideoMount,
  recordVideoPlay,
  resetPerformanceSession,
  setPerformanceInstrumentationOverride,
} from '@/lib/performance';

import {
  commitComponentDiagnostics,
  commitTotals,
  formatElapsed,
  formatMs,
  recentListLoads,
  recentRequests,
  requestScreenDiagnostics,
  resetPerformanceMeasurement,
  sharePerformanceReport,
  startPerformanceMeasurement,
  totalRequestRetries,
  videoDiagnostics,
} from '../diagnostics';

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
  const first = createRequestTrace('/feed?token=segredo', 'GET', { screen: 'feed', action: 'initial' })!;
  recordRequestAttempt(first, 20, 'success', 200);
  finishRequest(first, 'success');

  const retry = createRequestTrace('/posts/1/support', 'PUT', { screen: 'feed', action: 'user' })!;
  recordRequestAttempt(retry, 8, 'error', 503);
  recordRequestAttempt(retry, 4, 'success', 200);
  finishRequest(retry, 'success');

  recordProfileCommit({ component: 'PostCard', instanceId: 'PostCard:1', phase: 'mount', actualDurationMs: 6, baseDurationMs: 8 });
  recordProfileCommit({ component: 'PostCard', instanceId: 'PostCard:1', phase: 'update', actualDurationMs: 2, baseDurationMs: 8 });
  recordProfileCommit({ component: 'CommentRow', instanceId: 'CommentRow:1', phase: 'mount', actualDurationMs: 1, baseDurationMs: 2 });
  recordListLoad('feed:para-voce', 84.4, 20);
  recordVideoMount('video-1');
  recordVideoPlay('video-1');
  recordVideoFirstFrame('video-1', 320);
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

describe('disponibilidade da tela', () => {
  it('libera desenvolvimento e staging, nunca produção', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
    expect(performanceDiagnosticsAvailable()).toBe(true);
    process.env.EXPO_PUBLIC_APP_ENV = 'staging';
    expect(performanceDiagnosticsAvailable()).toBe(true);
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    expect(performanceDiagnosticsAvailable()).toBe(false);
  });
});

describe('controle da medição', () => {
  it('inicia uma sessão limpa e permite zerar sem desligar a instrumentação', () => {
    expect(startPerformanceMeasurement()).toBe(true);
    const firstSession = getPerformanceSnapshot().sessionId;
    expect(firstSession).not.toBeNull();

    seedMeasurements();
    expect(getPerformanceSnapshot().requests).toHaveLength(2);

    expect(resetPerformanceMeasurement()).toBe(true);
    const secondSession = getPerformanceSnapshot().sessionId;
    expect(secondSession).not.toBeNull();
    expect(secondSession).not.toBe(firstSession);
    expect(getPerformanceSnapshot().requests).toHaveLength(0);
    expect(getPerformanceSnapshot().enabled).toBe(true);
  });

  it('recusa iniciar em produção', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    expect(startPerformanceMeasurement()).toBe(false);
    expect(getPerformanceSnapshot().sessionId).toBeNull();
    expect(resetPerformanceMeasurement()).toBe(false);
  });
});

describe('agregações exibidas na tela', () => {
  it('atribui requests, refreshes e retries por tela sem expor query string', () => {
    startPerformanceMeasurement();
    seedMeasurements();
    const snapshot = getPerformanceSnapshot();
    const [feed] = requestScreenDiagnostics(snapshot);

    expect(feed).toMatchObject({ screen: 'feed', count: 2, retries: 1, errors: 0, refreshCount: 0 });
    expect(feed.averageMs).toBeGreaterThanOrEqual(0);
    expect(totalRequestRetries(snapshot)).toBe(1);
    expect(recentRequests(snapshot)).toHaveLength(2);
    expect(recentRequests(snapshot)[0].path).toBe('/posts/1/support');
    expect(JSON.stringify(snapshot)).not.toContain('token=segredo');
  });

  it('agrega commits por componente e calcula a média do actualDuration', () => {
    startPerformanceMeasurement();
    seedMeasurements();
    const snapshot = getPerformanceSnapshot();
    const postCard = commitComponentDiagnostics(snapshot).find((component) => component.component === 'PostCard');

    expect(postCard).toMatchObject({ instances: 1, commits: 2, mountCommits: 1, updateCommits: 1, maxActualMs: 6 });
    expect(postCard!.averageActualMs).toBe(4);
    expect(commitTotals(snapshot.commits)).toMatchObject({ instances: 2, commits: 3, totalActualMs: 9, maxActualMs: 6 });
  });

  it('resume onLoad e TTFF a partir dos registros existentes', () => {
    startPerformanceMeasurement();
    seedMeasurements();
    const snapshot = getPerformanceSnapshot();
    const video = videoDiagnostics(snapshot);

    expect(recentListLoads(snapshot)[0]).toMatchObject({ list: 'feed:para-voce', itemCount: 20 });
    expect(video).toMatchObject({ mountedNow: 1, playingNow: 1, firstFrameCount: 1, firstFrameMaxMs: 320, errorCount: 0 });
    expect(video.averageFirstFrameMs).toBe(320);
  });

  it('formata durações sem inventar precisão', () => {
    expect(formatMs(0.456)).toBe('0,46 ms');
    expect(formatMs(84.4)).toBe('84 ms');
    expect(formatMs(1234)).toBe('1,23 s');
    expect(formatMs(undefined)).toBe('—');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_665_000)).toBe('1:01:05');
  });
});

describe('exportação do JSON', () => {
  it('grava no cache e abre o compartilhamento nativo', async () => {
    startPerformanceMeasurement();
    seedMeasurements();

    await expect(sharePerformanceReport()).resolves.toBe('shared');
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/popularia-performance-diagnostico.json',
      expect.stringContaining('"enabled": true'),
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/popularia-performance-diagnostico.json',
      expect.objectContaining({ mimeType: 'application/json', UTI: 'public.json' }),
    );
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('copia para a área de transferência quando não há compartilhamento', async () => {
    startPerformanceMeasurement();
    seedMeasurements();
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);

    await expect(sharePerformanceReport()).resolves.toBe('copied');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining('"sessionId"'));
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
