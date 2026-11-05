import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  createRequestTrace,
  exportPerformanceSnapshot,
  finishRequest,
  getPerformanceSnapshot,
  performanceInstrumentationEnabled,
  recordListLoad,
  recordProfileCommit,
  recordRequestAttempt,
  recordVideoFirstFrame,
  recordVideoMount,
  recordVideoPlay,
  recordVideoUnmount,
  resetPerformanceSession,
  runWithPerformanceScope,
  setPerformanceInstrumentationOverride,
} from '../index';

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
});

describe('gate da instrumentação', () => {
  it('fica fechado por padrão', () => {
    setPerformanceInstrumentationOverride(null);
    delete process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION;
    expect(performanceInstrumentationEnabled()).toBe(false);
    expect(getPerformanceSnapshot().sessionId).toBeNull();
  });

  it('nunca liga em produção, mesmo com a flag pública e override', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION = '1';
    setPerformanceInstrumentationOverride(true);
    expect(performanceInstrumentationEnabled()).toBe(false);
    expect(getPerformanceSnapshot().enabled).toBe(false);
    delete process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION;
  });
});

describe('requests', () => {
  it('atribui por tela e ação e remove query string do caminho', () => {
    const trace = createRequestTrace('/feed?cursor=segredo&token=abc', 'GET', { screen: 'feed', action: 'refresh' })!;
    recordRequestAttempt(trace, 12.5, 'success', 200);
    finishRequest(trace, 'success');

    const snapshot = getPerformanceSnapshot();
    expect(snapshot.requests).toHaveLength(1);
    expect(snapshot.requests[0]).toMatchObject({ path: '/feed', method: 'GET', attempts: 1, status: 200, outcome: 'success' });
    expect(snapshot.requestsByScreen.feed).toMatchObject({ count: 1, refreshCount: 1, errors: 0 });
    expect(snapshot.counters.httpAttempts).toBe(1);
    expect(exportPerformanceSnapshot()).not.toContain('segredo');
    expect(exportPerformanceSnapshot()).not.toContain('token=abc');
  });

  it('conta tentativas reais e marca abort sem esconder o status', () => {
    const trace = createRequestTrace('/posts/1/support', 'PUT', { screen: 'feed', action: 'user' })!;
    recordRequestAttempt(trace, 5, 'error', 401);
    recordRequestAttempt(trace, 8, 'aborted', null);
    finishRequest(trace, 'error');

    const record = getPerformanceSnapshot().requests[0];
    expect(record.attempts).toBe(2);
    expect(record.attemptDurationsMs).toEqual([5, 8]);
    expect(record.status).toBeNull();
    expect(record.outcome).toBe('aborted');
  });

  it('captura o escopo síncrono do início da request', () => {
    const trace = runWithPerformanceScope({ screen: 'profile', action: 'pagination' }, () => createRequestTrace('/me/posts', 'GET'))!;
    expect(trace.scope).toEqual({ screen: 'profile', action: 'pagination' });
  });

  it('limita a memória e registra descartes', () => {
    for (let index = 0; index < 430; index += 1) {
      const trace = createRequestTrace(`/items/${index}`, 'GET', { screen: 'feed', action: 'other' })!;
      recordRequestAttempt(trace, 1, 'success', 200);
      finishRequest(trace, 'success');
    }
    const snapshot = getPerformanceSnapshot();
    expect(snapshot.requests).toHaveLength(400);
    expect(snapshot.dropped).toBe(30);
  });
});

describe('commits, listas e vídeo', () => {
  it('agrega commits por instância e separa mount de update', () => {
    recordProfileCommit({ component: 'PostCard', instanceId: 'PostCard:1', phase: 'mount', actualDurationMs: 4, baseDurationMs: 5 });
    recordProfileCommit({ component: 'PostCard', instanceId: 'PostCard:1', phase: 'update', actualDurationMs: 2, baseDurationMs: 5 });
    const record = getPerformanceSnapshot().commits[0];
    expect(record).toMatchObject({ commits: 2, mountCommits: 1, updateCommits: 1, maxActualMs: 4 });
  });

  it('registra onLoad com o tamanho da lista', () => {
    recordListLoad('feed:para-voce', 123.456, 30);
    expect(getPerformanceSnapshot().lists[0]).toMatchObject({ list: 'feed:para-voce', elapsedTimeInMs: 123.46, itemCount: 30 });
  });

  it('acompanha players montados, tocando e o primeiro quadro', () => {
    recordVideoMount('v1');
    recordVideoPlay('v1');
    recordVideoMount('v2');
    recordVideoFirstFrame('v1', 480);
    let video = getPerformanceSnapshot().video;
    expect(video.mountedNow).toBe(2);
    expect(video.playingNow).toBe(1);
    expect(video.firstFrameCount).toBe(1);
    expect(video.firstFrameMaxMs).toBe(480);

    recordVideoUnmount('v1');
    video = getPerformanceSnapshot().video;
    expect(video.mountedNow).toBe(1);
    expect(video.playingNow).toBe(0);
    expect(video.events.map((event) => event.event)).toContain('unmount');
  });
});
