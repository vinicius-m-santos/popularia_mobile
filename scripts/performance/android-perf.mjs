#!/usr/bin/env node
/**
 * CLI do coletor de performance Android do POP-72.
 *
 * Uso principal (WSL + Windows Emulator + ADB):
 *   EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1 npm run perf:android -- run \
 *     --app-package com.popularia.mobile --iterations 3 \
 *     --dataset "QA fixture 240 posts/3 páginas" --network "Wi-Fi local" --cache warm
 *
 * O comando não sobe emulador, Metro ou build: ele orquestra um app já
 * instalado e um ADB acessível. Sem dispositivo, falha com instrução clara.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { createAdb, resolveAdbPath, selectDevice } from './lib/adb.mjs';
import { createDeviceController } from './lib/device.mjs';
import { environmentFrom, runScenario } from './lib/collector.mjs';
import { buildReport, compareReports, renderComparisonMarkdown, writeReportArtifacts } from './lib/report.mjs';
import { resolveScenarios, SCENARIOS, DEFAULT_SCENARIO_IDS } from './lib/scenarios.mjs';
import { metricMatrixForReport } from './lib/metrics-matrix.mjs';

const OPTIONS = {
  serial: { type: 'string' },
  adb: { type: 'string' },
  'app-package': { type: 'string', default: 'com.popularia.mobile' },
  activity: { type: 'string', default: '.MainActivity' },
  iterations: { type: 'string', default: '3' },
  scenarios: { type: 'string', default: DEFAULT_SCENARIO_IDS.join(',') },
  'video-post': { type: 'string' },
  out: { type: 'string' },
  dataset: { type: 'string', default: 'não informado' },
  network: { type: 'string', default: 'não informado' },
  cache: { type: 'string', default: 'não informado' },
  'build-type': { type: 'string' },
  profiling: { type: 'boolean', default: false },
  commit: { type: 'string' },
  branch: { type: 'string' },
  'bridge-wait': { type: 'string', default: '1200' },
  'ui-timeout': { type: 'string', default: '10000' },
  'min-runs': { type: 'string', default: '3' },
  baseline: { type: 'string' },
  before: { type: 'string' },
  after: { type: 'string' },
  input: { type: 'string' },
  'fail-on-regression': { type: 'boolean', default: false },
  'fail-on-error': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

function usage() {
  console.log(`POP-72 — coletor Android local

Comandos:
  run        executa cenários e grava report.json, runs.csv e report.md
  compare    compara dois report.json (--before, --after)
  report     re-renderiza um report.json existente (--input)
  devices    lista dispositivos ADB
  plan       imprime a matriz de métricas e os cenários

Exemplos:
  npm run perf:android -- devices
  npm run perf:android -- plan
  EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1 npm run perf:android -- run --iterations 3
  npm run perf:android -- run --baseline artifacts/performance/antes/report.json
  npm run perf:android -- compare --before antes/report.json --after depois/report.json

Opções do run:
  --serial <id>            dispositivo ADB (obrigatório se houver mais de um)
  --adb <caminho>          adb.exe do Windows/SDK; default: ANDROID_HOME ou /mnt/c/...
  --app-package <pkg>      default com.popularia.mobile
  --activity <activity>    default .MainActivity
  --scenarios <lista>      default ${DEFAULT_SCENARIO_IDS.join(',')}
  --iterations <n>         default 3 (mínimo de calibração)
  --video-post <id>        habilita o cenário video
  --out <dir>              default artifacts/performance/<timestamp>-<commit>
  --dataset/--network/--cache <texto>  metadados do relatório
  --build-type <tipo>      default EAS_BUILD_PROFILE ou development
  --profiling              marca a build com React Profiler
  --min-runs <n>           mínimo para calibrar threshold (default 3)
  --baseline <report.json> compara antes/depois no mesmo run
  --fail-on-regression     opcional; o fluxo inicial é advisory
  --fail-on-error          opcional; falha de passo vira exit 1

A ponte JS exige EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1 no bundle e um
development build (run-as). Sem ela, o relatório ainda traz gfxinfo, meminfo,
CPU, rede e startup, mas não traz snapshot de requests/paginação/TTFF.`);
}

function parseCli() {
  const parsed = parseArgs({ options: OPTIONS, allowPositionals: true, strict: true });
  const command = parsed.positionals[0] ?? 'run';
  return { command, positionals: parsed.positionals.slice(1), values: parsed.values };
}

function intOption(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function listOption(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function gitInfo() {
  try {
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
    return { commit, branch };
  } catch {
    return { commit: null, branch: null };
  }
}

function buildInfo(values, identity) {
  return {
    type: values['build-type'] ?? process.env.EAS_BUILD_PROFILE ?? 'development',
    profiling: Boolean(values.profiling),
    appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
    versionName: identity?.build?.versionName ?? null,
    versionCode: identity?.build?.versionCode ?? null,
    adb: identity?.isEmulator ? 'emulator' : 'device',
  };
}

function defaultOutDir(commit) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return resolve('artifacts', 'performance', `${stamp}-${commit ?? 'sem-commit'}`);
}

async function getAdb(values) {
  const adbPath = values.adb ?? resolveAdbPath();
  if (adbPath && adbPath.includes('/') && !existsSync(adbPath)) {
    throw new Error(`adb não encontrado em "${adbPath}". Defina --adb ou ADB_PATH.`);
  }
  const probe = createAdb({ adbPath });
  const devices = await probe.devices();
  if (!devices.ok && /ENOENT|not found|No such file/i.test(String(devices.stderr ?? ''))) {
    throw new Error(`adb não executou ("${adbPath}"). No WSL, aponte --adb /mnt/c/.../platform-tools/adb.exe ou ADB_PATH. Detalhe: ${devices.stderr}`);
  }
  return { adbPath, probe, devices };
}

async function commandDevices(values) {
  const { adbPath, devices } = await getAdb(values);
  if (!devices.ok) throw new Error(`adb devices falhou: ${devices.stderr}`);
  console.log(`adb: ${adbPath}`);
  if (devices.devices.length === 0) {
    console.log('Nenhum dispositivo. Suba o emulador Android e confira `adb devices -l`.');
    return;
  }
  for (const device of devices.devices) {
    console.log(`${device.serial}\t${device.state}\t${device.model ?? ''}\t${device.device ?? ''}`);
  }
}

function commandPlan() {
  console.log('Cenários:');
  for (const scenario of Object.values(SCENARIOS)) {
    console.log(`  ${scenario.id}\t${scenario.title}\t${scenario.description}`);
  }
  console.log('\nMatriz de métricas:');
  for (const row of metricMatrixForReport()) {
    console.log(`  [${row.status}] ${row.metric} — ${row.collector} (POP-5: ${row.pop5})`);
  }
  console.log('\nThresholds são advisory nesta entrega; nenhum merge é bloqueado por ruído de emulador.');
}

async function commandRun(values) {
  const { probe } = await getAdb(values);
  const deviceList = await probe.devices();
  if (!deviceList.ok) throw new Error(`adb devices falhou: ${deviceList.stderr}`);
  const selected = selectDevice(deviceList.devices, values.serial);
  const adb = createAdb({ adbPath: probe.adbPath, serial: selected.serial });
  const controller = createDeviceController({
    adb,
    appPackage: values['app-package'],
    activity: values.activity,
  });

  const identity = await controller.connect();
  const git = gitInfo();
  const commit = values.commit ?? git.commit;
  const branch = values.branch ?? git.branch;
  const build = buildInfo(values, identity);
  const device = { serial: selected.serial, ...identity };
  const outDir = values.out ? resolve(values.out) : defaultOutDir(commit);
  mkdirSync(outDir, { recursive: true });

  const scenarios = resolveScenarios(listOption(values.scenarios), {
    videoPostId: values['video-post'],
  });
  const iterations = intOption(values.iterations, 3);
  const runOptions = {
    bridgeWaitMs: intOption(values['bridge-wait'], 1_200),
    uiTimeoutMs: intOption(values['ui-timeout'], 10_000),
    appPackage: values['app-package'],
    activity: values.activity,
    dataset: values.dataset,
    network: values.network,
    cache: values.cache,
  };
  const environment = environmentFrom({
    commit,
    branch,
    device,
    build,
    options: {
      appPackage: values['app-package'],
      activity: values.activity,
      dataset: values.dataset,
      network: values.network,
      cache: values.cache,
    },
  });

  console.log(`[perf] dispositivo ${selected.serial} · ${identity.manufacturer ?? ''} ${identity.model ?? ''} · Android ${identity.androidVersion ?? '?'} · emulador=${identity.isEmulator}`);
  console.log(`[perf] commit ${commit ?? '—'} · build ${build.type} · saída ${outDir}`);
  console.log('[perf] Lembrete: a ponte JS exige EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1 e development build.');

  const runs = [];
  for (const scenario of scenarios) {
    if (scenario.skipped) {
      const skipped = await runScenario({
        controller,
        scenario,
        iteration: 1,
        options: runOptions,
        outDir,
        processInfo: { commit, build, device },
        logger: console,
      });
      runs.push(skipped);
      continue;
    }
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      const run = await runScenario({
        controller,
        scenario,
        iteration,
        options: runOptions,
        outDir,
        processInfo: { commit, build, device },
        logger: console,
      });
      runs.push(run);
    }
  }

  const baseline = values.baseline ? readJson(resolve(values.baseline)) : null;
  const report = buildReport({
    environment,
    runs,
    options: {
      minRuns: intOption(values['min-runs'], 3),
      baseline,
    },
  });
  const paths = writeReportArtifacts(report, outDir);

  console.log(`[perf] relatório: ${paths.reportJson}`);
  console.log(`[perf] CSV: ${paths.runsCsv}`);
  console.log(`[perf] markdown: ${paths.reportMarkdown}`);
  if (report.comparison) {
    console.log(`[perf] comparação: ${report.comparison.verdict} · excedidos=${report.comparison.exceeded} · blocking=${report.comparison.blocking}`);
  }
  console.log(`[perf] resumo: ${report.summary.totals.ok} ok · ${report.summary.totals.partial} parciais · ${report.summary.totals.error} erros · ${report.summary.totals.skipped} pulados`);

  if (values['fail-on-regression'] && report.comparison?.exceeded > 0) {
    console.error('[perf] --fail-on-regression: houve métrica acima do threshold (gate advisory explícito).');
    process.exitCode = 2;
  } else if (values['fail-on-error'] && report.summary.totals.error > 0) {
    console.error('[perf] --fail-on-error: pelo menos uma execução terminou com erro.');
    process.exitCode = 1;
  }
}

async function commandCompare(values) {
  if (!values.before || !values.after) throw new Error('compare exige --before <report.json> e --after <report.json>.');
  const before = readJson(resolve(values.before));
  const after = readJson(resolve(values.after));
  const comparison = compareReports(before, after);
  const outDir = values.out ? resolve(values.out) : resolve(values.after, '..');
  mkdirSync(outDir, { recursive: true });
  const { writeFileSync } = await import('node:fs');
  const jsonPath = join(outDir, 'comparison.json');
  const mdPath = join(outDir, 'comparison.md');
  writeFileSync(jsonPath, `${JSON.stringify(comparison, null, 2)}\n`);
  writeFileSync(mdPath, `${renderComparisonMarkdown(comparison)}\n`);
  console.log(`[perf] antes ${comparison.beforeCommit ?? '—'} · depois ${comparison.afterCommit ?? '—'}`);
  console.log(`[perf] veredito ${comparison.verdict} · comparáveis=${comparison.comparable} · excedidos=${comparison.exceeded} · blocking=${comparison.blocking}`);
  console.log(`[perf] ${jsonPath}`);
  console.log(`[perf] ${mdPath}`);
  if (values['fail-on-regression'] && comparison.exceeded > 0) process.exitCode = 2;
}

async function commandReport(values) {
  if (!values.input) throw new Error('report exige --input <report.json>.');
  const report = readJson(resolve(values.input));
  const outDir = values.out ? resolve(values.out) : resolve(values.input, '..');
  const paths = writeReportArtifacts(report, outDir);
  console.log(`[perf] ${paths.reportJson}`);
  console.log(`[perf] ${paths.runsCsv}`);
  console.log(`[perf] ${paths.reportMarkdown}`);
}

async function main() {
  const { command, values } = parseCli();
  if (values.help || command === 'help') {
    usage();
    return;
  }
  if (command === 'run') return commandRun(values);
  if (command === 'compare') return commandCompare(values);
  if (command === 'report') return commandReport(values);
  if (command === 'devices') return commandDevices(values);
  if (command === 'plan') return commandPlan();
  throw new Error(`Comando desconhecido: ${command}. Use --help.`);
}

main().catch((error) => {
  console.error(`[perf] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
