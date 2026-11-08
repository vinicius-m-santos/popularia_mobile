import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_THRESHOLDS,
  buildCsv,
  buildReport,
  calibrateThresholds,
  compareReports,
  renderMarkdown,
  summarizeScenarios,
  writeReportArtifacts,
} from '../lib/report.mjs';

function sampleRun(overrides = {}) {
  return {
    scenario: 'feed',
    title: 'Feed',
    iteration: 1,
    status: 'ok',
    startedAt: '2026-11-08T12:00:00.000Z',
    durationMs: 5_000,
    commit: 'abc1234',
    build: { type: 'development', profiling: true, versionName: '1.0.0', versionCode: 10 },
    device: { model: 'sdk_gphone64_x86_64', androidVersion: '14', isEmulator: true },
    metrics: {
      frames: {
        available: true,
        measuredFrames: 300,
        jankyFrames: 12,
        jankPct: 4,
        p50Ms: 16.6,
        p95Ms: 24,
        p99Ms: 40,
        maxMs: 80,
        skippedFrames: 1,
      },
      interaction: { samples: 20, p95Ms: 45, maxMs: 80 },
      jsStalls: { count: 1, maxMs: 80, totalMs: 80 },
      startup: { available: true, totalTimeMs: 2_000, waitTimeMs: 2_100 },
      memory: { available: true, pssStartKb: 200_000, pssEndKb: 220_000, pssPeakKb: 225_000, javaHeapKb: 60_000, nativeHeapKb: 80_000 },
      cpu: { available: true, processPct: 25 },
      network: { available: true, rxBytes: 1_000, txBytes: 500 },
      pagination: { available: true, pagesLoaded: 3, p95RequestMs: 400 },
      video: { available: true, maxFirstFrameMs: 700 },
      app: { available: true },
    },
    jsSnapshot: { available: true, sessionId: 'perf-1' },
    notes: ['nota de teste'],
    errors: [],
    evidence: {
      screenshot: 'runs/feed/1/screen.png',
      uiDump: 'runs/feed/1/window.xml',
      snapshot: 'runs/feed/1/js-snapshot.json',
    },
    ...overrides,
  };
}

function reportWith(runs) {
  return buildReport({
    environment: {
      commit: 'abc1234',
      branch: 'ai/pop-72',
      device: { model: 'sdk_gphone64_x86_64', androidVersion: '14', isEmulator: true },
      build: { type: 'development' },
      appPackage: 'com.popularia.mobile',
      dataset: 'QA',
      network: 'Wi-Fi',
      cache: 'warm',
      orchestrator: 'wsl',
    },
    runs,
    options: { minRuns: 3 },
  });
}

describe('resumo e calibração', () => {
  it('agrupa por cenário e calcula mediana/p95 sem esconder execuções', () => {
    const scenarios = summarizeScenarios([sampleRun({ iteration: 1 }), sampleRun({ iteration: 2, status: 'partial' })]);
    expect(scenarios.feed).toMatchObject({ runs: 2, ok: 1, partial: 1, error: 0 });
    expect(scenarios.feed.metrics['frames.jankPct']).toMatchObject({ samples: 2, median: 4, p95: 4 });
    expect(scenarios.feed.metrics['memory.pssPeakKb'].median).toBe(225_000);
  });

  it('usa o piso default com menos execuções que o mínimo', () => {
    const thresholds = calibrateThresholds([sampleRun()], { minRuns: 3 });
    expect(thresholds.scenarios.feed['frames.jankPct']).toMatchObject({
      threshold: DEFAULT_THRESHOLDS['frames.jankPct'].floor,
      source: 'default',
      confident: false,
      samples: 1,
    });
    expect(thresholds).toMatchObject({ blocking: false, gate: 'advisory', source: 'default' });
  });

  it('calibra com 3+ execuções e mantém o piso contra ruído', () => {
    const runs = [4, 5, 6, 30].map((jankPct, index) => sampleRun({ iteration: index + 1, metrics: {
      ...sampleRun().metrics,
      frames: { ...sampleRun().metrics.frames, jankPct, p95Ms: 20 + index },
    } }));
    const thresholds = calibrateThresholds(runs, { minRuns: 3 });
    const metric = thresholds.scenarios.feed['frames.jankPct'];
    expect(metric.source).toBe('calibrated');
    expect(metric.confident).toBe(true);
    expect(metric.samples).toBe(4);
    expect(metric.threshold).toBeGreaterThan(metric.median);
    expect(metric.threshold).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS['frames.jankPct'].floor);
    expect(thresholds.source).toBe('calibrated');
  });
});

describe('comparação antes/depois', () => {
  it('aponta regressão como advisory e não bloqueia', () => {
    const before = reportWith([sampleRun({ iteration: 1 }), sampleRun({ iteration: 2 }), sampleRun({ iteration: 3 })]);
    const after = reportWith([
      sampleRun({ iteration: 1, metrics: { ...sampleRun().metrics, frames: { ...sampleRun().metrics.frames, jankPct: 30, p95Ms: 60 } } }),
      sampleRun({ iteration: 2, metrics: { ...sampleRun().metrics, frames: { ...sampleRun().metrics.frames, jankPct: 30, p95Ms: 60 } } }),
      sampleRun({ iteration: 3, metrics: { ...sampleRun().metrics, frames: { ...sampleRun().metrics.frames, jankPct: 30, p95Ms: 60 } } }),
    ]);
    const comparison = compareReports(before, after);
    expect(comparison).toMatchObject({ blocking: false, gate: 'advisory', verdict: 'regression-advisory' });
    expect(comparison.rows.some((row) => row.metric === 'frames.jankPct' && row.exceeded)).toBe(true);
    expect(comparison.rows.find((row) => row.metric === 'frames.jankPct')?.deltaPct).toBeGreaterThan(0);
  });

  it('devolve inconclusivo quando não há médias comparáveis', () => {
    const before = reportWith([sampleRun({ metrics: {}, jsSnapshot: { available: false } })]);
    const after = reportWith([sampleRun({ metrics: {}, jsSnapshot: { available: false } })]);
    const comparison = compareReports(before, after);
    expect(comparison).toMatchObject({ verdict: 'inconclusive', comparable: 0, exceeded: 0, blocking: false });
  });
});

describe('artefatos do relatório', () => {
  it('gera CSV com cabeçalho estável, escaping e campos ausentes vazios', () => {
    const report = reportWith([sampleRun({ notes: ['a, b', 'linha "quoted"'] })]);
    const csv = buildCsv(report);
    expect(csv.split('\n')[0]).toContain('scenario,iteration,status');
    expect(csv).toContain('"a, b; linha ""quoted"""');
    const partial = buildCsv(reportWith([sampleRun({ metrics: {}, notes: [] })]));
    expect(partial).toContain('feed,1,ok');
  });

  it('renderiza markdown com matriz, cenário, thresholds, limitações e evidências', () => {
    const report = reportWith([sampleRun(), sampleRun({ iteration: 2 }), sampleRun({ iteration: 3 })]);
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('# POP-72 — Relatório de performance por cenário');
    expect(markdown).toContain('Cobertura das métricas');
    expect(markdown).toContain('Frame timing e jank');
    expect(markdown).toContain('## Resumo por cenário');
    expect(markdown).toContain('### Feed (feed)');
    expect(markdown).toContain('[print](runs/feed/1/screen.png)');
    expect(markdown).toContain('## Thresholds (advisory)');
    expect(markdown).toContain('bloqueio de merge: **não**');
    expect(markdown).toContain('emulador Android via ADB/WSL');
  });

  it('grava report.json, runs.csv e report.md em disco', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pop72-report-'));
    try {
      const report = reportWith([sampleRun()]);
      const paths = writeReportArtifacts(report, dir);
      expect(JSON.parse(readFileSync(paths.reportJson, 'utf8')).schemaVersion).toBe(1);
      expect(readFileSync(paths.runsCsv, 'utf8')).toContain('framesMeasured');
      expect(readFileSync(paths.reportMarkdown, 'utf8')).toContain('POP-72');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
