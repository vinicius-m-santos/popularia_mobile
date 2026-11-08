/**
 * Relatório, CSV, calibração de thresholds e comparação antes/depois do POP-72.
 *
 * Regra central: threshold é advisory. O relatório pode apontar regressão, mas
 * não transforma ruído de emulador em bloqueio de merge. A decisão de bloquear
 * é explícita (`--fail-on-regression`, fora do fluxo inicial).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { metricMatrixForReport } from './metrics-matrix.mjs';
import { mad, median, readPath, round, summarize } from './statistics.mjs';

export const REPORT_SCHEMA_VERSION = 1;

export const DEFAULT_THRESHOLDS = {
  'frames.jankPct': { floor: 8, unit: '%', label: 'Frames janky', direction: 'lower' },
  'frames.p95Ms': { floor: 32, unit: 'ms', label: 'Frame p95', direction: 'lower' },
  'frames.p99Ms': { floor: 50, unit: 'ms', label: 'Frame p99', direction: 'lower' },
  'frames.maxMs': { floor: 120, unit: 'ms', label: 'Frame máximo', direction: 'lower' },
  'interaction.p95Ms': { floor: 100, unit: 'ms', label: 'Interação p95', direction: 'lower' },
  'jsStalls.maxMs': { floor: 200, unit: 'ms', label: 'JS stall proxy máximo', direction: 'lower' },
  'startup.totalTimeMs': { floor: 4_000, unit: 'ms', label: 'Inicialização', direction: 'lower' },
  'memory.pssPeakKb': { floor: 450_000, unit: 'KiB', label: 'PSS de pico', direction: 'lower' },
  'cpu.processPct': { floor: 70, unit: '%', label: 'CPU do processo', direction: 'lower' },
  'pagination.p95RequestMs': { floor: 1_800, unit: 'ms', label: 'Paginação p95', direction: 'lower' },
  'video.maxFirstFrameMs': { floor: 1_500, unit: 'ms', label: 'TTFF máximo', direction: 'lower' },
};

function unique(values) {
  return [...new Set(values)];
}

function flattenNumericMetrics(object, prefix = '', output = {}) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return output;
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number' && Number.isFinite(value)) output[path] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) flattenNumericMetrics(value, path, output);
  }
  return output;
}

function runMetricValues(runs, path) {
  return runs
    .map((run) => readPath(run.metrics, path))
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
}

export function summarizeScenarios(runs) {
  const scenarioIds = unique(runs.map((run) => run.scenario));
  const scenarios = {};
  for (const scenario of scenarioIds) {
    const scenarioRuns = runs.filter((run) => run.scenario === scenario);
    const measured = scenarioRuns.filter((run) => run.status !== 'skipped');
    const paths = unique(measured.flatMap((run) => Object.keys(flattenNumericMetrics(run.metrics ?? {}))));
    const metrics = {};
    for (const path of paths) {
      metrics[path] = summarize(runMetricValues(measured, path));
    }
    scenarios[scenario] = {
      title: scenarioRuns[0]?.title ?? scenario,
      runs: scenarioRuns.length,
      ok: scenarioRuns.filter((run) => run.status === 'ok').length,
      partial: scenarioRuns.filter((run) => run.status === 'partial').length,
      error: scenarioRuns.filter((run) => run.status === 'error').length,
      skipped: scenarioRuns.filter((run) => run.status === 'skipped').length,
      status: scenarioRuns.every((run) => run.status === 'skipped') ? 'skipped' : 'measured',
      metrics,
    };
  }
  return scenarios;
}

/**
 * Mediana + 3×MAD (escala 1,4826) e um piso de 15% da mediana. O piso absoluto
 * evita threshold apertado demais quando o emulador está muito estável; o
 * relatório marca `confident: false` se houver menos execuções que o mínimo.
 */
export function calibrateThresholds(runs, options = {}) {
  const { minRuns = 3, defaults = DEFAULT_THRESHOLDS } = options;
  const scenarios = {};
  const scenarioIds = unique(runs.filter((run) => run.status !== 'skipped').map((run) => run.scenario));

  for (const scenario of scenarioIds) {
    const scenarioRuns = runs.filter((run) => run.scenario === scenario && run.status !== 'skipped');
    const metrics = {};
    for (const [path, definition] of Object.entries(defaults)) {
      const values = runMetricValues(scenarioRuns, path);
      if (values.length === 0) continue;
      const middle = median(values);
      const deviation = mad(values);
      const robustSpread = (deviation ?? 0) * 1.4826;
      const calibrated = Math.max(definition.floor, middle + Math.max(3 * robustSpread, Math.abs(middle) * 0.15));
      const confident = values.length >= minRuns;
      metrics[path] = {
        ...definition,
        threshold: round(confident ? calibrated : definition.floor, 2),
        median: round(middle, 2),
        mad: round(deviation, 2),
        samples: values.length,
        confident,
        source: confident ? 'calibrated' : 'default',
      };
    }
    if (Object.keys(metrics).length > 0) scenarios[scenario] = metrics;
  }

  return {
    version: 1,
    generatedFromRuns: runs.filter((run) => run.status !== 'skipped').length,
    minRuns,
    source: Object.values(scenarios).some((metrics) => Object.values(metrics).some((metric) => metric.source === 'calibrated'))
      ? 'calibrated'
      : 'default',
    blocking: false,
    gate: 'advisory',
    scenarios,
    defaults: { ...DEFAULT_THRESHOLDS },
  };
}

function availableIn(runs, predicate) {
  return runs.some((run) => {
    try {
      return predicate(run);
    } catch {
      return false;
    }
  });
}

export function buildCoverage(runs) {
  const measured = runs.filter((run) => run.status !== 'skipped');
  return [
    {
      metric: 'Frame timing/jank',
      available: availableIn(measured, (run) => (run.metrics?.frames?.measuredFrames ?? 0) > 0 || typeof run.metrics?.frames?.jankyFrames === 'number'),
      source: 'dumpsys gfxinfo framestats',
      note: 'ADB local; emulador não substitui aparelho.',
    },
    {
      metric: 'Latência de interação',
      available: availableIn(measured, (run) => (run.metrics?.interaction?.samples ?? 0) > 0),
      source: 'gfxinfo HandleInputStart → FrameCompleted',
      note: 'Somente frames com input.',
    },
    {
      metric: 'JS stalls (proxy)',
      available: availableIn(measured, (run) => run.metrics?.jsStalls?.count !== null && run.metrics?.jsStalls?.count !== undefined),
      source: 'frames longos + commits',
      note: 'Proxy; não é long task do Hermes.',
    },
    {
      metric: 'Inicialização',
      available: availableIn(measured, (run) => run.metrics?.startup?.totalTimeMs !== null && run.metrics?.startup?.totalTimeMs !== undefined),
      source: 'am start -W',
      note: 'Frio e quente separados.',
    },
    {
      metric: 'Memória/PSS',
      available: availableIn(measured, (run) => run.metrics?.memory?.available === true),
      source: 'dumpsys meminfo',
      note: 'PSS do processo.',
    },
    {
      metric: 'CPU',
      available: availableIn(measured, (run) => run.metrics?.cpu?.available === true),
      source: '/proc/<pid>/stat',
      note: 'Sofre influência do host.',
    },
    {
      metric: 'Rede',
      available: availableIn(measured, (run) => run.metrics?.network?.available === true),
      source: 'dumpsys netstats',
      note: 'Formato pode variar; sem dado fica null.',
    },
    {
      metric: 'Paginação',
      available: availableIn(measured, (run) => run.metrics?.pagination?.available === true),
      source: 'snapshot JS',
      note: 'Requests de paginação e onLoad.',
    },
    {
      metric: 'Vídeo/TTFF',
      available: availableIn(measured, (run) => run.metrics?.video?.available === true),
      source: 'snapshot JS + cenário de vídeo',
      note: 'Exige --video-post e ponte JS.',
    },
    {
      metric: 'Snapshot JS (POP-5)',
      available: availableIn(measured, (run) => run.jsSnapshot?.available === true),
      source: 'run-as/cache',
      note: 'Exige EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1.',
    },
  ];
}

export function buildLimitations({ runs, environment, coverage }) {
  const limitations = [
    'Execução local em emulador Android via ADB/WSL; não é baseline de release e não substitui aparelho físico.',
    'Frames vêm do gfxinfo do processo; o coletor não separa UI thread de JS thread e o JS stall é um proxy de frames longos.',
    'PSS é memória do processo no instante da amostra; não é heap JS, memória total do sistema ou pico nativo contínuo.',
    'CPU é delta de utime+stime de /proc; o host do emulador e o carregamento da máquina alteram o número.',
    'Rede é delta de netstats do UID; rotação de buffer, VPN e formato da ROM podem deixar a métrica indisponível.',
    'TTFF e onLoad do vídeo dependem do snapshot JS e de um development build com a ponte ligada.',
    'iOS não é coberto: Instruments/MetricKit e aparelho físico continuam obrigatórios para a matriz final.',
    'Thresholds são advisory e calibrados com poucas execuções; não bloqueiam merge nesta entrega.',
    'Física de gesto, teclado nativo, VoiceOver/TalkBack, Reduce Motion e aquecimento/bateria continuam manuais (POP-64).',
  ];
  if (environment?.device?.isEmulator === false) {
    limitations[0] = 'Execução em aparelho físico Android via ADB; compare apenas com o mesmo modelo, SO, rede e build.';
  }
  if (runs.some((run) => run.status !== 'skipped' && run.jsSnapshot?.available !== true)) {
    limitations.push('Algumas execuções não tiveram snapshot JS; elas não têm requests, paginação, TTFF nem commits no relatório.');
  }
  if (runs.some((run) => run.scenario === 'video' && run.status === 'skipped')) {
    limitations.push('Cenário de vídeo não foi executado porque --video-post não foi informado.');
  }
  if (coverage?.some((item) => item.metric === 'Rede' && !item.available)) {
    limitations.push('netstats não retornou dados do UID em pelo menos uma execução; rede aparece como indisponível, nunca como zero.');
  }
  return unique(limitations);
}

/** Compara dois relatórios; a saída é advisory por definição. */
export function compareReports(before, after) {
  const rows = [];
  const scenarioIds = unique([
    ...Object.keys(before?.summary?.scenarios ?? {}),
    ...Object.keys(after?.summary?.scenarios ?? {}),
  ]);

  for (const scenario of scenarioIds) {
    const beforeScenario = before?.summary?.scenarios?.[scenario];
    const afterScenario = after?.summary?.scenarios?.[scenario];
    const thresholdPaths = unique([
      ...Object.keys(before?.thresholds?.scenarios?.[scenario] ?? {}),
      ...Object.keys(after?.thresholds?.scenarios?.[scenario] ?? {}),
    ]);
    const paths = thresholdPaths.length > 0
      ? thresholdPaths
      : unique(Object.keys(afterScenario?.metrics ?? beforeScenario?.metrics ?? {}));

    for (const path of paths) {
      const beforeMetric = beforeScenario?.metrics?.[path];
      const afterMetric = afterScenario?.metrics?.[path];
      const definition = before?.thresholds?.scenarios?.[scenario]?.[path]
        ?? after?.thresholds?.scenarios?.[scenario]?.[path]
        ?? DEFAULT_THRESHOLDS[path]
        ?? {};
      const beforeMedian = beforeMetric?.median ?? null;
      const afterMedian = afterMetric?.median ?? null;
      const comparable = Number.isFinite(beforeMedian) && Number.isFinite(afterMedian);
      const delta = comparable ? round(afterMedian - beforeMedian, 2) : null;
      const deltaPct = comparable && beforeMedian !== 0 ? round((delta / beforeMedian) * 100, 2) : null;
      const threshold = Number.isFinite(definition.threshold) ? definition.threshold : (DEFAULT_THRESHOLDS[path]?.floor ?? null);
      const exceeded = Boolean(comparable && definition.direction !== 'higher' && threshold !== null && afterMedian > threshold);
      rows.push({
        scenario,
        metric: path,
        label: definition.label ?? path,
        unit: definition.unit ?? null,
        direction: definition.direction ?? 'lower',
        beforeMedian,
        afterMedian,
        delta,
        deltaPct,
        threshold,
        exceeded,
        comparable,
        samplesBefore: beforeMetric?.samples ?? 0,
        samplesAfter: afterMetric?.samples ?? 0,
      });
    }
  }

  const comparable = rows.filter((row) => row.comparable);
  const exceeded = rows.filter((row) => row.exceeded);
  return {
    beforeCommit: before?.environment?.commit ?? null,
    afterCommit: after?.environment?.commit ?? null,
    beforeGeneratedAt: before?.generatedAt ?? null,
    afterGeneratedAt: after?.generatedAt ?? null,
    rows,
    comparable: comparable.length,
    exceeded: exceeded.length,
    blocking: false,
    gate: 'advisory',
    verdict: exceeded.length > 0
      ? 'regression-advisory'
      : comparable.length > 0 ? 'no-regression-detected' : 'inconclusive',
    note: 'Comparação advisory: mesmo device/SO/dataset/rede/cache e build com profiling são obrigatórios para concluir ganho ou perda.',
  };
}

export function buildReport({ environment, runs, options = {} }) {
  const summaryScenarios = summarizeScenarios(runs);
  const thresholds = calibrateThresholds(runs, { minRuns: options.minRuns ?? 3 });
  const coverage = buildCoverage(runs);
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    environment,
    summary: {
      totals: {
        runs: runs.length,
        ok: runs.filter((run) => run.status === 'ok').length,
        partial: runs.filter((run) => run.status === 'partial').length,
        error: runs.filter((run) => run.status === 'error').length,
        skipped: runs.filter((run) => run.status === 'skipped').length,
      },
      scenarios: summaryScenarios,
    },
    thresholds,
    coverage,
    metricMatrix: metricMatrixForReport(),
    limitations: buildLimitations({ runs, environment, coverage }),
    comparison: null,
    runs,
  };
  if (options.baseline) report.comparison = compareReports(options.baseline, report);
  return report;
}

export function buildCsv(report) {
  const columns = [
    ['scenario', 'scenario'],
    ['iteration', 'iteration'],
    ['status', 'status'],
    ['startedAt', 'startedAt'],
    ['durationMs', 'durationMs'],
    ['commit', 'commit'],
    ['device', 'device.model'],
    ['android', 'device.androidVersion'],
    ['buildType', 'build.type'],
    ['framesMeasured', 'metrics.frames.measuredFrames'],
    ['jankyFrames', 'metrics.frames.jankyFrames'],
    ['jankPct', 'metrics.frames.jankPct'],
    ['frameP50Ms', 'metrics.frames.p50Ms'],
    ['frameP95Ms', 'metrics.frames.p95Ms'],
    ['frameP99Ms', 'metrics.frames.p99Ms'],
    ['frameMaxMs', 'metrics.frames.maxMs'],
    ['skippedFrames', 'metrics.frames.skippedFrames'],
    ['interactionSamples', 'metrics.interaction.samples'],
    ['interactionP95Ms', 'metrics.interaction.p95Ms'],
    ['jsStallProxyCount', 'metrics.jsStalls.count'],
    ['jsStallProxyMaxMs', 'metrics.jsStalls.maxMs'],
    ['startupTotalMs', 'metrics.startup.totalTimeMs'],
    ['startupWaitMs', 'metrics.startup.waitTimeMs'],
    ['pssStartKb', 'metrics.memory.pssStartKb'],
    ['pssEndKb', 'metrics.memory.pssEndKb'],
    ['pssPeakKb', 'metrics.memory.pssPeakKb'],
    ['javaHeapKb', 'metrics.memory.javaHeapKb'],
    ['nativeHeapKb', 'metrics.memory.nativeHeapKb'],
    ['cpuProcessPct', 'metrics.cpu.processPct'],
    ['networkRxBytes', 'metrics.network.rxBytes'],
    ['networkTxBytes', 'metrics.network.txBytes'],
    ['paginationPages', 'metrics.pagination.pagesLoaded'],
    ['paginationP95Ms', 'metrics.pagination.p95RequestMs'],
    ['videoFirstFrameMaxMs', 'metrics.video.maxFirstFrameMs'],
    ['videoMountedNow', 'metrics.video.mountedNow'],
    ['videoPlayingNow', 'metrics.video.playingNow'],
    ['logicalRequests', 'metrics.app.requests.total'],
    ['paginationRequests', 'metrics.app.requests.pagination'],
    ['profilerCommits', 'metrics.app.commits.count'],
    ['listLoads', 'metrics.app.pagination.feedListLoads'],
    ['snapshotAvailable', 'jsSnapshot.available'],
    ['notes', 'notes'],
    ['screenshot', 'evidence.screenshot'],
  ];
  const header = columns.map(([key]) => key);
  const lines = [header.join(',')];
  for (const run of report.runs ?? []) {
    const values = columns.map(([key, path]) => {
      let value;
      if (key === 'device') value = run.device?.model ?? report.environment?.device?.model ?? null;
      else if (key === 'notes') value = (run.notes ?? []).join('; ');
      else value = readPath(run, path);
      if (Array.isArray(value)) value = value.join('; ');
      return csvCell(value);
    });
    lines.push(values.join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function fmt(value, unit = '') {
  if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) return '—';
  if (typeof value === 'number') {
    const rounded = Math.abs(value) >= 100 ? Math.round(value) : round(value, 2);
    return `${rounded}${unit ? ` ${unit}` : ''}`;
  }
  return String(value);
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function mdTable(headers, rows) {
  return [
    `| ${headers.map(mdCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`),
  ].join('\n');
}

function evidenceLinks(run) {
  const links = [];
  if (run.evidence?.screenshot) links.push(`[print](${run.evidence.screenshot})`);
  if (run.evidence?.uiDump) links.push(`[UI](${run.evidence.uiDump})`);
  if (run.evidence?.snapshot) links.push(`[snapshot](${run.evidence.snapshot})`);
  if (run.evidence?.launchOutput) links.push(`[launch](${run.evidence.launchOutput})`);
  for (const [index, path] of (run.evidence?.stepScreenshots ?? []).entries()) links.push(`[passo ${index + 1}](${path})`);
  return links.length > 0 ? links.join(' · ') : '—';
}

export function renderMarkdown(report) {
  const environment = report.environment ?? {};
  const device = environment.device ?? {};
  const build = environment.build ?? {};
  const lines = [
    '# POP-72 — Relatório de performance por cenário',
    '',
    `Gerado em ${report.generatedAt}. Schema v${report.schemaVersion}.`,
    '',
    '## Ambiente da execução',
    '',
    mdTable(['Campo', 'Valor'], [
      ['Commit', environment.commit ?? '—'],
      ['Branch', environment.branch ?? '—'],
      ['Dispositivo', [device.manufacturer, device.model].filter(Boolean).join(' ') || '—'],
      ['SO', device.androidVersion ? `Android ${device.androidVersion} (SDK ${device.sdk ?? '?'})` : '—'],
      ['Resolução / refresh', device.resolution?.value ? `${device.resolution.value} · ${device.refreshRateHz ?? '?'} Hz` : '—'],
      ['Emulador', device.isEmulator === true ? 'sim' : device.isEmulator === false ? 'não' : '—'],
      ['Build do app', [build.type, build.versionName, build.versionCode ? `(${build.versionCode})` : null].filter(Boolean).join(' ') || '—'],
      ['Pacote', environment.appPackage ?? '—'],
      ['Dataset', environment.dataset ?? '—'],
      ['Rede', environment.network ?? '—'],
      ['Cache', environment.cache ?? '—'],
      ['Orquestrador', environment.orchestrator ?? '—'],
    ]),
    '',
    '## Cobertura das métricas (POP-5 × POP-72)',
    '',
    mdTable(['Métrica', 'POP-5', 'Coleta POP-72', 'Status', 'Limite'], report.metricMatrix.map((row) => ([
      row.metric,
      row.pop5,
      row.collector,
      row.status,
      row.notes,
    ]))),
    '',
    '## Resumo por cenário',
    '',
    mdTable(
      ['Cenário', 'Execuções', 'OK', 'Jank %', 'Frame p95', 'Interação p95', 'PSS pico', 'CPU %', 'Páginas', 'TTFF máx.'],
      Object.entries(report.summary.scenarios).map(([scenario, summary]) => {
        const metrics = summary.metrics;
        return [
          `${summary.title} (${scenario})`,
          summary.runs,
          summary.ok,
          fmt(metrics['frames.jankPct']?.median, '%'),
          fmt(metrics['frames.p95Ms']?.median, 'ms'),
          fmt(metrics['interaction.p95Ms']?.median, 'ms'),
          fmt(metrics['memory.pssPeakKb']?.median, 'KiB'),
          fmt(metrics['cpu.processPct']?.median, '%'),
          fmt(metrics['pagination.pagesLoaded']?.median),
          fmt(metrics['video.maxFirstFrameMs']?.median, 'ms'),
        ];
      }),
    ),
    '',
    '## Detalhe por cenário',
    '',
  ];

  for (const [scenario, summary] of Object.entries(report.summary.scenarios)) {
    lines.push(`### ${summary.title} (${scenario})`, '');
    const scenarioRuns = report.runs.filter((run) => run.scenario === scenario);
    if (scenarioRuns.length === 0) {
      lines.push('Nenhuma execução registrada.', '');
      continue;
    }
    lines.push(mdTable(
      ['Exec.', 'Status', 'Duração', 'Jank %', 'Frame p95', 'Interação p95', 'PSS pico', 'CPU %', 'Rede RX', 'Páginas', 'TTFF máx.', 'Evidência'],
      scenarioRuns.map((run) => {
        const metrics = run.metrics ?? {};
        return [
          run.iteration,
          run.status,
          fmt(run.durationMs, 'ms'),
          fmt(metrics.frames?.jankPct, '%'),
          fmt(metrics.frames?.p95Ms, 'ms'),
          fmt(metrics.interaction?.p95Ms, 'ms'),
          fmt(metrics.memory?.pssPeakKb, 'KiB'),
          fmt(metrics.cpu?.processPct, '%'),
          fmt(metrics.network?.rxBytes, 'B'),
          fmt(metrics.pagination?.pagesLoaded),
          fmt(metrics.video?.maxFirstFrameMs, 'ms'),
          evidenceLinks(run),
        ];
      }),
    ), '');
    for (const run of scenarioRuns) {
      if (run.notes?.length || run.errors?.length) {
        lines.push(`- Execução ${run.iteration}: ${[...(run.notes ?? []), ...(run.errors ?? [])].join('; ')}`);
      }
    }
    lines.push('');
  }

  lines.push('## Thresholds (advisory)', '');
  lines.push(`Fonte: **${report.thresholds.source}**; mínimo de execuções para calibrar: ${report.thresholds.minRuns}; bloqueio de merge: **não**.`);
  lines.push('');
  const thresholdRows = [];
  for (const [scenario, metrics] of Object.entries(report.thresholds.scenarios)) {
    for (const [path, metric] of Object.entries(metrics)) {
      thresholdRows.push([
        scenario,
        metric.label ?? path,
        fmt(metric.threshold, metric.unit),
        metric.source,
        metric.samples,
        fmt(metric.median, metric.unit),
        fmt(metric.mad, metric.unit),
        metric.confident ? 'sim' : 'não',
      ]);
    }
  }
  lines.push(thresholdRows.length > 0
    ? mdTable(['Cenário', 'Métrica', 'Threshold', 'Fonte', 'Amostras', 'Mediana', 'MAD', 'Confiável'], thresholdRows)
    : 'Sem amostras suficientes para threshold.');
  lines.push('');

  lines.push('## Comparação antes/depois', '');
  if (!report.comparison) {
    lines.push('Não solicitada. Use `--baseline <report.json>` no `run` ou o comando `compare`.', '');
  } else {
    const comparison = report.comparison;
    lines.push(`Antes: \`${comparison.beforeCommit ?? '—'}\` · depois: \`${comparison.afterCommit ?? '—'}\` · veredito: **${comparison.verdict}** (${comparison.note}).`, '');
    lines.push(mdTable(
      ['Cenário', 'Métrica', 'Antes', 'Depois', 'Delta', 'Delta %', 'Threshold', 'Excedeu?'],
      comparison.rows.map((row) => [
        row.scenario,
        row.label,
        fmt(row.beforeMedian, row.unit),
        fmt(row.afterMedian, row.unit),
        fmt(row.delta, row.unit),
        fmt(row.deltaPct, '%'),
        fmt(row.threshold, row.unit),
        row.comparable ? (row.exceeded ? 'sim (advisory)' : 'não') : 'sem par',
      ]),
    ), '');
  }

  lines.push('## Limitações', '');
  for (const limitation of report.limitations) lines.push(`- ${limitation}`);
  lines.push('');
  lines.push('## Como reproduzir', '');
  lines.push('```bash');
  lines.push('# Windows Emulator + ADB acessível pelo WSL; development build com a ponte JS');
  lines.push('EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1 npm run perf:android -- run \\');
  lines.push(`  --app-package ${environment.appPackage ?? 'com.popularia.mobile'} \\`);
  lines.push('  --iterations 3 --dataset "QA fixture 240 posts/3 páginas" --network "Wi-Fi local" --cache warm');
  lines.push('# comparar com um relatório anterior');
  lines.push('npm run perf:android -- compare --before artifacts/performance/<antes>/report.json --after artifacts/performance/<depois>/report.json');
  lines.push('```');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function writeReportArtifacts(report, outDir) {
  mkdirSync(outDir, { recursive: true });
  const reportJson = join(outDir, 'report.json');
  const runsCsv = join(outDir, 'runs.csv');
  const reportMarkdown = join(outDir, 'report.md');
  writeFileSync(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(runsCsv, buildCsv(report));
  writeFileSync(reportMarkdown, renderMarkdown(report));
  const paths = { reportJson, runsCsv, reportMarkdown };
  if (report.comparison) {
    const comparisonJson = join(outDir, 'comparison.json');
    const comparisonMarkdown = join(outDir, 'comparison.md');
    writeFileSync(comparisonJson, `${JSON.stringify(report.comparison, null, 2)}\n`);
    writeFileSync(comparisonMarkdown, `${renderComparisonMarkdown(report.comparison)}\n`);
    paths.comparisonJson = comparisonJson;
    paths.comparisonMarkdown = comparisonMarkdown;
  }
  return paths;
}

export function renderComparisonMarkdown(comparison) {
  return [
    '# POP-72 — Comparação antes/depois',
    '',
    `Antes: \`${comparison.beforeCommit ?? '—'}\` · depois: \`${comparison.afterCommit ?? '—'}\``,
    '',
    `Veredito: **${comparison.verdict}** (gate ${comparison.gate}, blocking=${comparison.blocking}).`,
    '',
    comparison.note,
    '',
    mdTable(
      ['Cenário', 'Métrica', 'Antes', 'Depois', 'Delta', 'Delta %', 'Threshold', 'Excedeu?'],
      comparison.rows.map((row) => [
        row.scenario,
        row.label,
        fmt(row.beforeMedian, row.unit),
        fmt(row.afterMedian, row.unit),
        fmt(row.delta, row.unit),
        fmt(row.deltaPct, '%'),
        fmt(row.threshold, row.unit),
        row.comparable ? (row.exceeded ? 'sim (advisory)' : 'não') : 'sem par',
      ]),
    ),
  ].join('\n');
}
