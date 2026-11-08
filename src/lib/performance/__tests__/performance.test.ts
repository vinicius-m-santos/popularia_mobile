import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  createRequestTrace,
  exportPerformanceSnapshot,
  finishRequest,
  getPerformanceSnapshot,
  performanceInstrumentationEnabled,
  recordFeedPhotoError,
  recordFeedPhotoLoaded,
  recordListLoad,
  recordPhotoDisplayed,
  recordPhotoError,
  recordPhotoLoaded,
  recordPhotoOpen,
  recordProfileCommit,
  recordRequestAttempt,
  recordVideoFirstFrame,
  recordVideoFullscreen,
  recordVideoMount,
  recordVideoPlay,
  recordVideoSurfaceFirstFrame,
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
    recordVideoFirstFrame('v2', 200, { totalMs: 940.5, toMountMs: 120.25 });
    let video = getPerformanceSnapshot().video;
    expect(video.mountedNow).toBe(2);
    expect(video.playingNow).toBe(1);
    expect(video.firstFrameCount).toBe(2);
    expect(video.firstFrameMaxMs).toBe(480);
    expect(video).toMatchObject({
      viewportFirstFrameCount: 1,
      viewportFirstFrameTotalMs: 940.5,
      viewportFirstFrameMaxMs: 940.5,
      viewportToMountCount: 1,
      viewportToMountTotalMs: 120.25,
      viewportToMountMaxMs: 120.25,
    });

    const viewportFrame = video.events.find((event) => event.event === 'first-frame' && event.mediaId === 'v2');
    expect(viewportFrame).toMatchObject({ valueMs: 200, viewportMs: 940.5, viewportToMountMs: 120.25 });
    const plainFrame = video.events.find((event) => event.event === 'first-frame' && event.mediaId === 'v1');
    expect(plainFrame).not.toHaveProperty('viewportMs');

    recordVideoUnmount('v1');
    video = getPerformanceSnapshot().video;
    expect(video.mountedNow).toBe(1);
    expect(video.playingNow).toBe(0);
    expect(video.events.map((event) => event.event)).toContain('unmount');
  });

  it('registra a troca feed → tela cheia → feed e a espera de cada surface', () => {
    recordVideoFullscreen('v1', 'enter');
    recordVideoSurfaceFirstFrame('v1', 'fullscreen', 42.4);
    recordVideoFullscreen('v1', 'exit');
    recordVideoSurfaceFirstFrame('v1', 'feed', 18.2);

    const events = getPerformanceSnapshot().video.events;
    expect(events.map((event) => event.event)).toEqual([
      'fullscreen-enter',
      'surface-first-frame',
      'fullscreen-exit',
      'surface-first-frame',
    ]);
    expect(events[1]).toMatchObject({ mediaId: 'v1', surface: 'fullscreen', valueMs: 42.4 });
    expect(events[3]).toMatchObject({ mediaId: 'v1', surface: 'feed', valueMs: 18.2 });
  });

  it('mede a foto em tela cheia por abertura, cache, tamanho e exibição', () => {
    recordPhotoOpen('p1');
    recordPhotoLoaded('p1', { elapsedMs: 42.4, width: 400, height: 800, cacheType: 'memory' });
    recordPhotoDisplayed('p1', 55.5);
    recordPhotoOpen('p2');
    recordPhotoLoaded('p2', { elapsedMs: 120, width: 1024, height: 1024, cacheType: 'disk' });
    recordPhotoLoaded('p3', { elapsedMs: 300, width: 0, height: 0, cacheType: 'none' });
    recordPhotoError('p3');

    const photos = getPerformanceSnapshot().photos;
    expect(photos).toMatchObject({
      openCount: 2,
      loadCount: 3,
      displayCount: 1,
      errorCount: 1,
      loadMaxMs: 300,
      displayMaxMs: 55.5,
      memoryCacheHits: 1,
      diskCacheHits: 1,
      networkLoads: 1,
      largestDecodedBytes: 1024 * 1024 * 4,
    });
    expect(photos.loadTotalMs).toBeCloseTo(462.4, 2);
    expect(photos.events.map((event) => event.event)).toEqual(['open', 'load', 'display', 'open', 'load', 'load', 'error']);
    expect(photos.events[1]).toMatchObject({ mediaId: 'p1', width: 400, height: 800, cacheType: 'memory', estimatedBytes: 1_280_000 });
    expect(JSON.stringify(photos)).not.toContain('https://');
  });

  it('mede fonte, render necessário e cache das fotos do feed', () => {
    recordFeedPhotoLoaded('f1', {
      elapsedMs: 42.4,
      cacheType: 'memory',
      sourceWidth: 2048,
      sourceHeight: 1365,
      uploadWidth: 2048,
      uploadHeight: 1365,
      renderedWidthPx: 1080,
      renderedHeightPx: 1350,
      neededWidthPx: 2025,
      neededHeightPx: 1350,
      sourceCoverRatio: 1.01,
      uploadCoverRatio: 1.01,
    });
    recordFeedPhotoLoaded('f2', {
      elapsedMs: 120,
      cacheType: 'disk',
      sourceWidth: 1080,
      sourceHeight: 1080,
      uploadWidth: 2048,
      uploadHeight: 2048,
      renderedWidthPx: 720,
      renderedHeightPx: 900,
      neededWidthPx: 900,
      neededHeightPx: 900,
      sourceCoverRatio: 1.2,
      uploadCoverRatio: 2.28,
    });
    recordFeedPhotoLoaded('f3', {
      elapsedMs: 300,
      cacheType: 'none',
      sourceWidth: 900,
      sourceHeight: 1200,
      // Sem layout medido: entra no cache/tempo, mas não na razão fonte/render.
    });
    recordFeedPhotoLoaded('invalid', {
      elapsedMs: 10,
      cacheType: 'none',
      sourceWidth: 0,
      sourceHeight: 0,
    });
    recordFeedPhotoError('f4');

    const feed = getPerformanceSnapshot().feedPhotos;
    expect(feed.events.some((event) => event.mediaId === 'invalid')).toBe(false);
    expect(feed).toMatchObject({
      loadCount: 3,
      errorCount: 1,
      decodeEstimate: 2,
      memoryCacheHits: 1,
      diskCacheHits: 1,
      networkLoads: 1,
      renderMeasuredCount: 2,
      over2xCount: 0,
      over2xUploadCount: 1,
      largestDecodedBytes: 2048 * 1365 * 4,
      largestUploadBytes: 2048 * 2048 * 4,
      largestNeededBytes: 2025 * 1350 * 4,
      maxSourceCoverRatio: 1.2,
      maxUploadCoverRatio: 2.28,
    });
    expect(feed.loadTotalMs).toBeCloseTo(462.4, 2);
    expect(feed.events.map((event) => event.event)).toEqual(['load', 'load', 'load', 'error']);
    expect(feed.events[0]).toMatchObject({
      mediaId: 'f1',
      renderedWidthPx: 1080,
      neededWidthPx: 2025,
      decodedBytes: 2048 * 1365 * 4,
      uploadBytes: 2048 * 1365 * 4,
      sourceCoverRatio: 1.01,
      uploadCoverRatio: 1.01,
    });
    expect(feed.events[2].sourceCoverRatio).toBeUndefined();
    expect(JSON.stringify(feed)).not.toContain('https://');
  });
});
