import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as FileSystem from 'expo-file-system/legacy';

import {
  createRequestTrace,
  finishRequest,
  recordRequestAttempt,
  resetPerformanceSession,
  setPerformanceInstrumentationOverride,
} from '@/lib/performance';

import {
  PERFORMANCE_COLLECTOR_FILE_NAME,
  collectorActionFromParams,
  collectorNextPath,
  performanceCollectorExportEnabled,
  writePerformanceSnapshotForCollector,
} from '../collector-bridge';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
}));

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  delete process.env.EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT;
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
  jest.clearAllMocks();
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  delete process.env.EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT;
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
});

describe('ponte do coletor ADB', () => {
  it('só liga com a flag explícita e fora de produção', () => {
    expect(performanceCollectorExportEnabled()).toBe(false);

    process.env.EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT = '1';
    expect(performanceCollectorExportEnabled()).toBe(true);

    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    expect(performanceCollectorExportEnabled()).toBe(false);
  });

  it('aceita apenas reset e snapshot no deep link', () => {
    expect(collectorActionFromParams({ collector: 'reset' })).toBe('reset');
    expect(collectorActionFromParams({ collector: ['snapshot', 'reset'] })).toBe('snapshot');
    expect(collectorActionFromParams({ collector: 'delete' })).toBeNull();
    expect(collectorActionFromParams({})).toBeNull();
  });

  it('só aceita a raiz como retorno do reset', () => {
    expect(collectorNextPath({ next: '/' })).toBe('/');
    expect(collectorNextPath({ next: ['/', '/outro'] })).toBe('/');
    expect(collectorNextPath({ next: '/perfil' })).toBeNull();
    expect(collectorNextPath({ next: '//evil' })).toBeNull();
    expect(collectorNextPath({})).toBeNull();
  });

  it('grava o snapshot no cache privado do app', async () => {
    process.env.EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT = '1';
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();
    const trace = createRequestTrace('/feed?token=segredo', 'GET', { screen: 'feed', action: 'initial' })!;
    recordRequestAttempt(trace, 20, 'success', 200);
    finishRequest(trace, 'success');

    await expect(writePerformanceSnapshotForCollector()).resolves.toBe(`file:///cache/${PERFORMANCE_COLLECTOR_FILE_NAME}`);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      `file:///cache/${PERFORMANCE_COLLECTOR_FILE_NAME}`,
      expect.stringContaining('"logicalRequests": 1'),
    );
    const contents = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1];
    expect(contents).not.toContain('token=segredo');
  });

  it('não grava quando a ponte está desligada', async () => {
    await expect(writePerformanceSnapshotForCollector()).resolves.toBeNull();
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });
});
