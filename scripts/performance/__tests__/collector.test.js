import { describe, expect, it } from '@jest/globals';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  extractAppMetrics,
  readSnapshot,
  runScenario,
  summarizeCpu,
  summarizeMemory,
  summarizeNetwork,
} from '../lib/collector.mjs';
import { SCENARIOS } from '../lib/scenarios.mjs';

function snapshot({ pagination = true, video = false } = {}) {
  const requests = [
    { id: 'req-1', path: '/feed', method: 'GET', scope: { screen: 'feed', action: 'initial' }, attempts: 1, durationMs: 120, outcome: 'success' },
    ...(pagination ? [
      { id: 'req-2', path: '/feed', method: 'GET', scope: { screen: 'feed', action: 'pagination' }, attempts: 2, durationMs: 300, outcome: 'success' },
      { id: 'req-3', path: '/feed', method: 'GET', scope: { screen: 'feed', action: 'pagination' }, attempts: 1, durationMs: 500, outcome: 'error' },
    ] : []),
  ];
  return {
    enabled: true,
    sessionId: 'perf-1',
    startedAt: '2026-11-08T12:00:00.000Z',
    durationMs: 4_000,
    platform: 'android',
    requests,
    requestsByScreen: { feed: { count: requests.length, errors: pagination ? 1 : 0, aborted: 0, refreshCount: 0, durationMs: 920 } },
    lists: pagination ? [
      { list: 'feed:para-voce', elapsedTimeInMs: 80, itemCount: 80, atMs: 100 },
      { list: 'feed:para-voce', elapsedTimeInMs: 120, itemCount: 160, atMs: 3_000 },
    ] : [{ list: 'feed:para-voce', elapsedTimeInMs: 80, itemCount: 20, atMs: 100 }],
    video: {
      events: video ? [{ event: 'first-frame', mediaId: 'video-1', valueMs: 700, atMs: 2_000 }] : [],
      mountedNow: video ? 1 : 0,
      playingNow: video ? 1 : 0,
      firstFrameCount: video ? 1 : 0,
      firstFrameTotalMs: video ? 700 : 0,
      firstFrameMaxMs: video ? 700 : 0,
    },
    counts: {},
    commits: [{ component: 'PostCard', instanceId: '1', commits: 2, mountCommits: 1, updateCommits: 1, totalActualMs: 12, maxActualMs: 8, lastActualMs: 4, totalBaseMs: 20 }],
    counters: { logicalRequests: requests.length, httpAttempts: 4, profilerCommits: 2, listLoads: 2, videoMounts: video ? 1 : 0 },
  };
}

function fakeController() {
  let netCalls = 0;
  let memCalls = 0;
  const opened = [];
  const deleted = [];
  const controller = {
    appPackage: 'com.popularia.mobile',
    clockTicks: 100,
    opened,
    deleted,
    startCalls: 0,
    async deleteAppFile(path) { deleted.push(path); return { ok: true }; },
    async openDeepLink(url) { opened.push(url); return { ok: true, stderr: '' }; },
    async forceStop() { return { ok: true, stderr: '' }; },
    async keyevent() { return { ok: true, stderr: '' }; },
    async resetFrameStats() { return { ok: true, stderr: '' }; },
    async start() {
      controller.startCalls += 1;
      return {
        ok: true,
        stderr: '',
        stdout: 'Status: ok\nLaunchState: COLD\nTotalTime: 2000\nWaitTime: 2100',
        startup: { available: true, status: 'ok', launchState: 'COLD', totalTimeMs: 2_000, waitTimeMs: 2_100 },
      };
    },
    async waitForElement() { return { element: { center: { x: 10, y: 20 } }, dump: { ok: true }, elapsedMs: 10 }; },
    async logcat() { return { ok: true, text: 'Displayed com.popularia.mobile/.MainActivity: +1999ms' }; },
    async swipe() { return { ok: true, stderr: '' }; },
    async tapLabel() { return { tapped: true, element: { center: { x: 10, y: 20 } } }; },
    async inputText() { return { ok: true, stderr: '' }; },
    async screenshot() { return { ok: true, buffer: Buffer.from('png'), error: null }; },
    async dumpUi() { return { ok: true, xml: '<hierarchy />', error: null }; },
    async frameStats() {
      return {
        ok: true,
        metrics: {
          available: true,
          measuredFrames: 100,
          jankyFrames: 10,
          jankPct: 10,
          p50Ms: 16.6,
          p95Ms: 24,
          p99Ms: 40,
          maxMs: 80,
          interaction: { samples: 10, p95Ms: 45, maxMs: 50 },
          jsStalls: { count: 1, maxMs: 80, totalMs: 80 },
        },
      };
    },
    async netStats() {
      netCalls += 1;
      return {
        ok: true,
        metrics: netCalls === 1
          ? { available: true, rxBytes: 1_000, txBytes: 200, rxPackets: 10, txPackets: 2 }
          : { available: true, rxBytes: 3_000, txBytes: 700, rxPackets: 30, txPackets: 7 },
      };
    },
    async meminfo() {
      memCalls += 1;
      return { ok: true, metrics: { available: true, pssKb: 200_000 + memCalls * 5_000, javaHeapKb: 60_000, nativeHeapKb: 80_000 } };
    },
    async processStat() {
      return { ok: true, pid: 42, metrics: { ticks: 100 + memCalls * 10, clockTicks: 100 } };
    },
    async readAppFile() {
      const isReset = opened[opened.length - 1]?.includes('collector=reset');
      return {
        ok: true,
        source: 'run-as',
        text: JSON.stringify(isReset ? snapshot({ pagination: false }) : snapshot({ pagination: true, video: true })),
      };
    },
  };
  return controller;
}

const processInfo = {
  commit: 'abc1234',
  build: { type: 'development' },
  device: { model: 'sdk_gphone64_x86_64', androidVersion: '14', isEmulator: true },
};

const fastSleep = async () => { await new Promise((resolve) => setTimeout(resolve, 2)); };

describe('agregações do runner', () => {
  it('calcula PSS de pico, CPU e rede sem transformar indisponível em zero', () => {
    expect(summarizeMemory([
      { pssKb: 100, javaHeapKb: 1 },
      { pssKb: 150 },
      { pssKb: 120 },
    ])).toMatchObject({ available: true, pssStartKb: 100, pssEndKb: 120, pssPeakKb: 150, pssDeltaKb: 20 });
    expect(summarizeMemory([])).toMatchObject({ available: false, pssPeakKb: null });
    expect(summarizeCpu({ pid: 1, cpuTicks: 100 }, { pid: 1, cpuTicks: 150 }, 1_000, 100)).toBe(50);
    expect(summarizeCpu({ pid: 1, cpuTicks: 100 }, { pid: 2, cpuTicks: 150 }, 1_000, 100)).toBeNull();
    expect(summarizeNetwork({ available: true, rxBytes: 100, txBytes: 50 }, { available: true, rxBytes: 400, txBytes: 100 })).toMatchObject({ available: true, rxBytes: 300, txBytes: 50 });
    expect(summarizeNetwork({ available: false }, { available: true, rxBytes: 400, txBytes: 100 })).toMatchObject({ available: false, rxBytes: null });
  });

  it('extrai paginação, vídeo, commits e requests do snapshot POP-5', () => {
    const metrics = extractAppMetrics(snapshot({ pagination: true, video: true }));
    expect(metrics).toMatchObject({
      available: true,
      requests: { total: 3, pagination: 2, retries: 1, errors: 1 },
      pagination: { pagesLoaded: 3, paginationRequests: 2, feedListLoads: 2, latestListLoadMs: 120 },
      video: { firstFrameCount: 1, averageFirstFrameMs: 700, maxFirstFrameMs: 700, mountedNow: 1, playingNow: 1 },
      commits: { maxActualMs: 8, count: 2 },
    });
  });

  it('lê o snapshot pelo run-as e ignora JSON inválido', async () => {
    const controller = {
      async readAppFile() { return { ok: true, text: JSON.stringify(snapshot()), source: 'run-as' }; },
    };
    await expect(readSnapshot(controller)).resolves.toMatchObject({ available: true, path: 'cache/popularia-performance-diagnostico.json', source: 'run-as' });
    const invalid = { async readAppFile() { return { ok: true, text: 'not json', source: 'run-as' }; } };
    await expect(readSnapshot(invalid)).resolves.toMatchObject({ available: false, error: expect.stringContaining('JSON inválido') });
  });
});

describe('runner de um cenário', () => {
  it('executa o feed, grava evidências e devolve métricas reais do duplo', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'pop72-run-'));
    try {
      const controller = fakeController();
      const run = await runScenario({
        controller,
        scenario: { ...SCENARIOS.feed, launchAfterReset: true, steps: [{ type: 'wait', ms: 1 }] },
        iteration: 1,
        options: { sleep: fastSleep, bridgeWaitMs: 0, uiTimeoutMs: 10 },
        outDir,
        processInfo,
        logger: { log: () => {} },
      });

      expect(run.status).toBe('ok');
      expect(run.metrics.frames.jankPct).toBe(10);
      expect(run.metrics.startup.displayedTimeMs).toBe(1999);
      expect(run.metrics.memory.pssPeakKb).toBeGreaterThan(200_000);
      expect(run.metrics.cpu.processPct).toBeGreaterThan(0);
      expect(run.metrics.network).toMatchObject({ available: true, rxBytes: 2_000, txBytes: 500 });
      expect(run.metrics.pagination).toMatchObject({ pagesLoaded: 3, paginationRequests: 2 });
      expect(run.jsSnapshot.available).toBe(true);
      expect(run.evidence.screenshot).toBeTruthy();
      expect(run.evidence.snapshot).toBeTruthy();
      expect(existsSync(join(outDir, 'runs/feed/1/screen.png'))).toBe(true);
      expect(existsSync(join(outDir, 'runs/feed/1/js-snapshot.json'))).toBe(true);
      const saved = JSON.parse(readFileSync(join(outDir, 'runs/feed/1/run.json'), 'utf8'));
      expect(saved).toMatchObject({ scenario: 'feed', iteration: 1, status: 'ok' });
      expect(controller.opened.some((url) => url.includes('collector=reset'))).toBe(true);
      expect(controller.opened.some((url) => url.includes('collector=snapshot'))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('não relança o app quando o reset já devolveu o feed', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'pop72-run-'));
    try {
      const controller = fakeController();
      const run = await runScenario({
        controller,
        scenario: { ...SCENARIOS.feed, steps: [{ type: 'wait', ms: 1 }] },
        iteration: 1,
        options: { sleep: fastSleep, bridgeWaitMs: 0, uiTimeoutMs: 10 },
        outDir,
        processInfo,
        logger: { log: () => {} },
      });
      expect(controller.startCalls).toBe(0);
      expect(run.evidence.launch).toBe('reset-next:/');
      expect(run.metrics.startup).toBeNull();
      expect(run.status).toBe('ok');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('marca erro de passo sem inventar sucesso', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'pop72-run-'));
    try {
      const controller = fakeController();
      controller.tapLabel = async () => ({ tapped: false, element: null });
      const run = await runScenario({
        controller,
        scenario: { ...SCENARIOS.composer, steps: [{ type: 'tapLabel', label: 'Criar publicação' }] },
        iteration: 1,
        options: { sleep: fastSleep, bridgeWaitMs: 0, uiTimeoutMs: 10 },
        outDir,
        processInfo,
        logger: { log: () => {} },
      });
      expect(run.status).toBe('error');
      expect(run.errors[0]).toContain('rótulo não encontrado');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('pula vídeo sem --video-post', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'pop72-run-'));
    try {
      const run = await runScenario({
        controller: fakeController(),
        scenario: { ...SCENARIOS.video, skipped: true, skipReason: 'faltam opções: --video-post' },
        iteration: 1,
        options: { sleep: fastSleep },
        outDir,
        processInfo,
        logger: { log: () => {} },
      });
      expect(run).toMatchObject({ status: 'skipped', metrics: {}, durationMs: 0 });
      expect(run.notes[0]).toContain('--video-post');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
