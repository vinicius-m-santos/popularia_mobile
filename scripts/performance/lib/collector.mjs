/**
 * Runner dos cenários do POP-72.
 *
 * Fluxo de um cenário de interação:
 *   reset da sessão JS -> abre o app -> assenta a tela -> zera gfxinfo ->
 *   amostra inicial -> executa os passos -> amostra final -> gfxinfo/meminfo/
 *   netstats -> exporta o snapshot JS -> salva evidências.
 *
 * Abertura fria/quente mede o launch: a preparação é o force-stop/home e o
 * cronômetro começa antes do `am start -W`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { parseDisplayedLaunch } from './parsers.mjs';
import { collectorDeepLink } from './scenarios.mjs';
import { quantile, round } from './statistics.mjs';

export const SNAPSHOT_RELATIVE_PATHS = [
  'cache/popularia-performance-diagnostico.json',
  'files/popularia-performance-diagnostico.json',
];

export function nowIso() {
  return new Date().toISOString();
}

export function summarizeCpu(start, end, elapsedMs, clockTicks = 100) {
  if (!start || !end || !Number.isFinite(start.cpuTicks) || !Number.isFinite(end.cpuTicks)) return null;
  if (elapsedMs <= 0) return null;
  if (start.pid && end.pid && start.pid !== end.pid) return null;
  const deltaTicks = end.cpuTicks - start.cpuTicks;
  if (deltaTicks < 0) return null;
  return round((deltaTicks / clockTicks) / (elapsedMs / 1000) * 100, 2);
}

export function summarizeNetwork(before, after) {
  if (!before?.available || !after?.available) {
    return {
      available: false,
      rxBytes: null,
      txBytes: null,
      rxPackets: null,
      txPackets: null,
      before: before ?? null,
      after: after ?? null,
      note: 'netstats indisponível no início ou no fim; rede não comparável',
    };
  }
  return {
    available: true,
    rxBytes: Math.max(0, after.rxBytes - before.rxBytes),
    txBytes: Math.max(0, after.txBytes - before.txBytes),
    rxPackets: Math.max(0, after.rxPackets - before.rxPackets),
    txPackets: Math.max(0, after.txPackets - before.txPackets),
    before: { rxBytes: before.rxBytes, txBytes: before.txBytes },
    after: { rxBytes: after.rxBytes, txBytes: after.txBytes },
    note: null,
  };
}

function maxOrNull(values) {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

export function summarizeMemory(samples) {
  const valid = (samples ?? []).filter((sample) => Number.isFinite(sample?.pssKb));
  if (valid.length === 0) {
    return {
      available: false,
      pssStartKb: null,
      pssEndKb: null,
      pssPeakKb: null,
      pssDeltaKb: null,
      javaHeapKb: null,
      nativeHeapKb: null,
      sampleCount: 0,
      note: 'meminfo sem PSS',
    };
  }
  const start = valid[0].pssKb;
  const end = valid[valid.length - 1].pssKb;
  return {
    available: true,
    pssStartKb: start,
    pssEndKb: end,
    pssPeakKb: Math.max(...valid.map((sample) => sample.pssKb)),
    pssDeltaKb: end - start,
    javaHeapKb: valid[valid.length - 1].javaHeapKb ?? null,
    nativeHeapKb: valid[valid.length - 1].nativeHeapKb ?? null,
    sampleCount: valid.length,
    note: null,
  };
}

/** Extrai do snapshot do POP-5 só o que o coletor agrega; não recalcula TTFF. */
export function extractAppMetrics(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const requests = Array.isArray(snapshot.requests) ? snapshot.requests : [];
  const paginationRequests = requests.filter((request) => request?.scope?.action === 'pagination');
  const initialFeedRequests = requests.filter((request) => request?.scope?.screen === 'feed' && request?.scope?.action === 'initial');
  const feedLists = (Array.isArray(snapshot.lists) ? snapshot.lists : []).filter((item) => String(item?.list ?? '').startsWith('feed:'));
  const paginationDurations = paginationRequests.map((request) => request?.durationMs).filter((value) => Number.isFinite(value));
  const retries = requests.reduce((total, request) => total + Math.max(0, (request?.attempts ?? 1) - 1), 0);
  const errors = requests.filter((request) => request?.outcome === 'error').length;
  const video = snapshot.video ?? {};
  const commits = Array.isArray(snapshot.commits) ? snapshot.commits : [];
  const firstFrameCount = Number(video.firstFrameCount ?? 0);

  return {
    available: true,
    sessionId: snapshot.sessionId ?? null,
    startedAt: snapshot.startedAt ?? null,
    durationMs: snapshot.durationMs ?? null,
    platform: snapshot.platform ?? null,
    counters: { ...(snapshot.counters ?? {}) },
    requests: {
      total: requests.length,
      pagination: paginationRequests.length,
      initialFeed: initialFeedRequests.length,
      retries,
      errors,
      p95DurationMs: round(quantile(requests.map((request) => request.durationMs), 0.95), 2),
      maxDurationMs: maxOrNull(requests.map((request) => request.durationMs)),
      byScreen: snapshot.requestsByScreen ?? {},
    },
    pagination: {
      available: requests.length > 0,
      pagesLoaded: initialFeedRequests.length > 0 ? 1 + paginationRequests.length : paginationRequests.length,
      paginationRequests: paginationRequests.length,
      p95RequestMs: round(quantile(paginationDurations, 0.95), 2),
      maxRequestMs: maxOrNull(paginationDurations),
      feedListLoads: feedLists.length,
      latestListLoadMs: feedLists.length > 0 ? feedLists[feedLists.length - 1].elapsedTimeInMs ?? null : null,
      maxListLoadMs: maxOrNull(feedLists.map((item) => item.elapsedTimeInMs)),
    },
    video: {
      available: firstFrameCount > 0 || Number(video.mountedNow ?? 0) > 0,
      firstFrameCount,
      averageFirstFrameMs: firstFrameCount > 0 ? round((video.firstFrameTotalMs ?? 0) / firstFrameCount, 2) : null,
      maxFirstFrameMs: Number.isFinite(video.firstFrameMaxMs) ? video.firstFrameMaxMs : null,
      mountedNow: video.mountedNow ?? 0,
      playingNow: video.playingNow ?? 0,
      errors: (video.events ?? []).filter((event) => event?.event === 'error').length,
      firstFrameEvents: (video.events ?? []).filter((event) => event?.event === 'first-frame').map((event) => event.valueMs).filter((value) => Number.isFinite(value)),
      note: 'mountedNow/playingNow são do instante da leitura, depois de abrir o diagnóstico; firstFrame preserva o TTFF.',
    },
    commits: {
      maxActualMs: maxOrNull(commits.map((record) => record.maxActualMs)),
      totalActualMs: round(commits.reduce((total, record) => total + (record.totalActualMs ?? 0), 0), 2),
      count: commits.reduce((total, record) => total + (record.commits ?? 0), 0),
    },
  };
}

export async function readSnapshot(controller) {
  let lastError = null;
  for (const path of SNAPSHOT_RELATIVE_PATHS) {
    const result = await controller.readAppFile(path);
    if (!result.ok || !result.text?.trim()) {
      lastError = result.stderr || `arquivo vazio: ${path}`;
      continue;
    }
    try {
      const snapshot = JSON.parse(result.text);
      return { available: true, snapshot, path, source: result.source, error: null };
    } catch (error) {
      lastError = `JSON inválido em ${path}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return { available: false, snapshot: null, path: null, source: null, error: String(lastError ?? 'snapshot não encontrado') };
}

async function clearSnapshotFiles(controller) {
  for (const path of SNAPSHOT_RELATIVE_PATHS) {
    await controller.deleteAppFile(path);
  }
}

async function requestCollectorSnapshot(controller, action, options, nonce, next = null) {
  const opened = await controller.openDeepLink(collectorDeepLink(action, nonce, next ? { next } : undefined));
  await options.sleep(options.bridgeWaitMs ?? 1_200);
  const read = await readSnapshot(controller);
  return { action, opened: Boolean(opened?.ok), ...read };
}

async function captureSample(controller) {
  const [memory, process] = await Promise.all([controller.meminfo(), controller.processStat()]);
  return {
    at: Date.now(),
    pid: process.pid ?? null,
    pssKb: memory.metrics?.pssKb ?? null,
    javaHeapKb: memory.metrics?.javaHeapKb ?? null,
    nativeHeapKb: memory.metrics?.nativeHeapKb ?? null,
    cpuTicks: process.metrics?.ticks ?? null,
  };
}


async function attachDisplayedFallback(controller, launch) {
  if (!launch || typeof controller.logcat !== 'function') return launch;
  const logcat = await controller.logcat(['-d', '-t', '500']);
  const displayed = parseDisplayedLaunch(logcat.text, controller.appPackage);
  if (displayed.available) {
    launch.startup = { ...(launch.startup ?? {}), displayedTimeMs: displayed.totalTimeMs };
  }
  return launch;
}

async function launchScenario(controller, scenario, options, notes) {
  const deepLink = typeof scenario.buildDeepLink === 'function'
    ? scenario.buildDeepLink(options)
    : scenario.deepLink;
  let launch = await controller.start(deepLink ? { deepLink } : {});
  if (!launch.ok) {
    notes.push(`am start falhou: ${String(launch.stderr ?? '').trim() || 'sem detalhes'}`);
  }
  if (deepLink && launch.startup?.status && launch.startup.status !== 'ok') {
    notes.push(`deep link "${deepLink}" não abriu (Status=${launch.startup.status}); tentando launcher`);
    launch = await controller.start({});
  }
  return { launch, deepLink };
}

async function runSteps({ controller, scenario, options, runDir, evidence, errors }) {
  const steps = [];
  const samples = [];
  const stepScreenshots = [];

  const captureStepScreenshot = async (name) => {
    const shot = await controller.screenshot();
    if (!shot.ok) return null;
    const fileName = `${name}.png`;
    writeFileSync(join(runDir, fileName), shot.buffer);
    stepScreenshots.push(fileName);
    return fileName;
  };

  for (let index = 0; index < (scenario.steps ?? []).length; index += 1) {
    const step = scenario.steps[index];
    const startedAt = Date.now();
    let ok = true;
    let error = null;

    if (step.type === 'wait') {
      await options.sleep(step.ms ?? 500);
    } else if (step.type === 'swipe') {
      const repeat = step.repeat ?? 1;
      for (let turn = 0; turn < repeat; turn += 1) {
        const reverse = Boolean(step.alternate) && turn % 2 === 1;
        const from = reverse ? step.to : step.from;
        const to = reverse ? step.from : step.to;
        const result = await controller.swipe({ from, to, durationMs: step.durationMs ?? 300 });
        if (!result.ok) {
          ok = false;
          error = `swipe falhou: ${String(result.stderr ?? '').trim() || 'sem detalhes'}`;
        }
        await options.sleep(step.pauseMs ?? 400);
      }
    } else if (step.type === 'tapLabel') {
      const result = await controller.tapLabel(step.label, { timeoutMs: step.timeoutMs ?? 10_000, exact: step.exact });
      if (!result.tapped) {
        ok = false;
        error = `rótulo não encontrado: ${step.label}`;
      }
    } else if (step.type === 'assertLabel') {
      const result = await controller.waitForElement(step.label, { timeoutMs: step.timeoutMs ?? 8_000, exact: step.exact });
      if (!result.element) {
        ok = false;
        error = `rótulo esperado não encontrado: ${step.label}`;
      }
    } else if (step.type === 'inputText') {
      const result = await controller.inputText(step.text ?? 'TestePOP72');
      if (!result.ok) {
        ok = false;
        error = `input text falhou: ${String(result.stderr ?? '').trim() || 'sem detalhes'}`;
      }
    } else if (step.type === 'keyevent') {
      const result = await controller.keyevent(step.code ?? 4);
      if (!result.ok) {
        ok = false;
        error = `keyevent falhou: ${String(result.stderr ?? '').trim() || 'sem detalhes'}`;
      }
    } else if (step.type === 'screenshot') {
      const file = await captureStepScreenshot(step.name ?? `step-${index + 1}`);
      if (!file) {
        ok = false;
        error = 'screenshot do passo falhou';
      }
    } else {
      ok = false;
      error = `passo desconhecido: ${step.type}`;
    }

    steps.push({ index, type: step.type, ok, error, durationMs: Date.now() - startedAt });
    if (error) errors.push(error);

    const isLast = index === (scenario.steps ?? []).length - 1;
    if (!isLast && (index + 1) % 4 === 0) samples.push(await captureSample(controller));
  }

  return { steps, samples, stepScreenshots };
}

/**
 * Executa uma repetição de um cenário e devolve o run bruto do relatório.
 * Falhas de passo viram `status: error` e notas; o runner não inventa métricas.
 */
export async function runScenario({
  controller,
  scenario,
  iteration,
  options = {},
  outDir,
  processInfo = {},
  logger = console,
}) {
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const runOptions = { ...options, sleep };
  const runDir = join(outDir, 'runs', scenario.id, String(iteration));
  mkdirSync(runDir, { recursive: true });

  const notes = [];
  const errors = [];
  const evidence = {};
  const nonce = `${scenario.id}-${iteration}-${Date.now().toString(36)}`;
  const startedAtIso = nowIso();

  if (scenario.skipped) {
    return {
      scenario: scenario.id,
      title: scenario.title,
      iteration,
      status: 'skipped',
      startedAt: startedAtIso,
      durationMs: 0,
      metrics: {},
      notes: [scenario.skipReason],
      errors: [],
      evidence: {},
    };
  }

  logger?.log?.(`[perf] ${scenario.id} · execução ${iteration}: preparando`);
  await clearSnapshotFiles(controller);

  let resetSnapshot = null;
  if (scenario.resetSession) {
    resetSnapshot = await requestCollectorSnapshot(controller, 'reset', runOptions, `${nonce}-reset`, scenario.resetNext ?? null);
    if (!resetSnapshot.available) {
      notes.push(`ponte JS indisponível no reset: ${resetSnapshot.error}`);
    }
  }

  if (scenario.forceStop) {
    const stopped = await controller.forceStop();
    if (!stopped.ok) notes.push(`force-stop falhou: ${String(stopped.stderr ?? '').trim() || 'sem detalhes'}`);
    await sleep(800);
  }
  if (scenario.goHome) {
    await controller.keyevent(3);
    await sleep(700);
  }

  let launch = null;
  let before = null;
  let sampleBefore = null;
  let startedAtMs;
  let steps = [];
  let samples = [];

  if (scenario.measure === 'launch') {
    await controller.resetFrameStats();
    before = await controller.netStats();
    sampleBefore = await captureSample(controller);
    startedAtMs = Date.now();
    const launched = await launchScenario(controller, scenario, options, notes);
    launch = launched.launch;
    evidence.launch = launched.deepLink ?? 'launcher';
    if (!launch?.ok) errors.push('am start falhou durante o launch');
    await sleep(scenario.waitMs ?? 3_000);
    if (scenario.waitForLabel) {
      const waited = await controller.waitForElement(scenario.waitForLabel, { timeoutMs: options.uiTimeoutMs ?? 10_000 });
      if (!waited.element) notes.push(`rótulo "${scenario.waitForLabel}" não apareceu após o launch`);
    }
    await attachDisplayedFallback(controller, launch);
  } else {
    // Se o reset já devolveu o feed via `next=/`, não há por que abrir o root de
    // novo. Vídeo é a exceção: ele precisa do deep link da publicação.
    const resetReturned = Boolean(resetSnapshot?.available && scenario.resetNext);
    let shouldLaunch = !resetReturned || scenario.launchAfterReset !== false;
    let launched = null;
    if (shouldLaunch) {
      launched = await launchScenario(controller, scenario, options, notes);
      launch = launched.launch;
      evidence.launch = launched.deepLink ?? 'launcher';
      if (!launch?.ok) errors.push('am start falhou durante o launch');
    } else {
      evidence.launch = `reset-next:${scenario.resetNext}`;
    }
    await sleep(scenario.waitMs ?? 2_500);

    let waited = null;
    if (scenario.waitForLabel) {
      waited = await controller.waitForElement(scenario.waitForLabel, { timeoutMs: options.uiTimeoutMs ?? 10_000 });
      if (!waited.element) notes.push(`rótulo "${scenario.waitForLabel}" não apareceu antes do cenário`);
    }
    // O reset pode ter falhado em navegar (deep link sem ponte). Relança uma vez.
    if (scenario.waitForLabel && !waited?.element && !shouldLaunch) {
      notes.push('reset não devolveu a tela esperada; relançando o app');
      launched = await launchScenario(controller, scenario, options, notes);
      launch = launched.launch;
      evidence.launch = launched.deepLink ?? 'launcher';
      if (!launch?.ok) errors.push('am start falhou durante o relançamento');
      await sleep(scenario.waitMs ?? 2_500);
      waited = await controller.waitForElement(scenario.waitForLabel, { timeoutMs: options.uiTimeoutMs ?? 10_000 });
      if (!waited.element) notes.push(`rótulo "${scenario.waitForLabel}" ainda ausente após relançar`);
    }
    if (scenario.waitForLabel && !waited?.element) {
      errors.push(`tela esperada não apareceu: ${scenario.waitForLabel}`);
    }
    await attachDisplayedFallback(controller, launch);
    await controller.resetFrameStats();
    before = await controller.netStats();
    sampleBefore = await captureSample(controller);
    startedAtMs = Date.now();
    const stepResult = await runSteps({ controller, scenario, options: runOptions, runDir, evidence, errors });
    steps = stepResult.steps;
    samples = stepResult.samples;
    evidence.stepScreenshots = stepResult.stepScreenshots.map((file) => relative(outDir, join(runDir, file)));
  }

  const endedAtMs = Date.now();
  const durationMs = Math.max(0, endedAtMs - startedAtMs);

  // Lê frames/rede/PSS antes de screenshot e uiautomator: essas operações
  // também geram frames e contaminariam o gfxinfo do cenário.
  const frameResult = await controller.frameStats();
  const frames = frameResult.metrics;
  const after = await controller.netStats();
  const sampleAfter = await captureSample(controller);

  const shot = await controller.screenshot();
  if (shot.ok) {
    writeFileSync(join(runDir, 'screen.png'), shot.buffer);
    evidence.screenshot = relative(outDir, join(runDir, 'screen.png'));
  } else {
    notes.push(`screenshot final falhou: ${shot.error ?? 'sem detalhes'}`);
  }
  const uiDump = await controller.dumpUi();
  if (uiDump.ok) {
    writeFileSync(join(runDir, 'window.xml'), uiDump.xml);
    evidence.uiDump = relative(outDir, join(runDir, 'window.xml'));
  } else {
    notes.push(`uiautomator dump falhou: ${uiDump.error ?? 'sem detalhes'}`);
  }
  if (launch?.stdout || launch?.stderr) {
    writeFileSync(join(runDir, 'launch.txt'), `${launch.stdout ?? ''}\n${launch.stderr ?? ''}`.trim());
    evidence.launchOutput = relative(outDir, join(runDir, 'launch.txt'));
  }

  const appSnapshot = scenario.captureSnapshot
    ? await requestCollectorSnapshot(controller, 'snapshot', runOptions, `${nonce}-snapshot`)
    : { available: false, error: 'captura desligada neste cenário' };
  if (scenario.captureSnapshot && !appSnapshot.available) {
    notes.push(`snapshot JS indisponível: ${appSnapshot.error}`);
  }
  if (appSnapshot.available && resetSnapshot?.snapshot?.sessionId && appSnapshot.snapshot?.sessionId !== resetSnapshot.snapshot.sessionId) {
    notes.push(`sessão JS ${appSnapshot.snapshot?.sessionId ?? '?'} difere da sessão zerada ${resetSnapshot.snapshot.sessionId}`);
  }
  if (appSnapshot.available) {
    writeFileSync(join(runDir, 'js-snapshot.json'), JSON.stringify(appSnapshot.snapshot, null, 2));
    evidence.snapshot = relative(outDir, join(runDir, 'js-snapshot.json'));
  } else {
    writeFileSync(join(runDir, 'js-snapshot.error.txt'), String(appSnapshot.error ?? 'indisponível'));
  }

  const app = appSnapshot.available ? extractAppMetrics(appSnapshot.snapshot) : null;
  const memory = summarizeMemory([sampleBefore, ...samples, sampleAfter]);
  const cpuPercent = summarizeCpu(sampleBefore, sampleAfter, durationMs, controller.clockTicks ?? 100);
  const network = summarizeNetwork(before?.metrics, after?.metrics);

  const metrics = {
    frames,
    interaction: frames?.interaction ?? null,
    jsStalls: frames?.jsStalls ?? null,
    startup: launch?.startup ?? null,
    memory,
    cpu: {
      available: cpuPercent !== null,
      processPct: cpuPercent,
      clockTicks: controller.clockTicks ?? 100,
      pidStart: sampleBefore?.pid ?? null,
      pidEnd: sampleAfter?.pid ?? null,
      note: cpuPercent === null ? 'PID ausente/reiniciado ou /proc indisponível' : null,
    },
    network,
    pagination: app?.pagination ?? null,
    video: app?.video ?? null,
    app,
  };

  const status = errors.length > 0 ? 'error' : (scenario.captureSnapshot && !appSnapshot.available ? 'partial' : 'ok');
  const run = {
    scenario: scenario.id,
    title: scenario.title,
    iteration,
    status,
    startedAt: new Date(startedAtMs).toISOString(),
    durationMs,
    commit: processInfo.commit ?? null,
    build: processInfo.build ?? null,
    device: processInfo.device ?? null,
    metrics,
    jsSnapshot: {
      available: appSnapshot.available,
      path: appSnapshot.path ?? null,
      source: appSnapshot.source ?? null,
      sessionId: appSnapshot.snapshot?.sessionId ?? null,
      startedAt: appSnapshot.snapshot?.startedAt ?? null,
      durationMs: appSnapshot.snapshot?.durationMs ?? null,
      error: appSnapshot.error ?? null,
      expectedSessionId: resetSnapshot?.snapshot?.sessionId ?? null,
    },
    steps,
    evidence,
    notes,
    errors,
  };

  writeFileSync(join(runDir, 'run.json'), JSON.stringify(run, null, 2));
  evidence.run = relative(outDir, join(runDir, 'run.json'));

  logger?.log?.(`[perf] ${scenario.id} · execução ${iteration}: ${status} · ${durationMs} ms · jank ${frames?.jankPct ?? '—'}%`);
  return run;
}

export function environmentFrom({ commit, branch, device, build, options }) {
  return {
    platform: 'android',
    execution: 'local-emulator-adb',
    orchestrator: process.platform === 'win32' ? 'windows' : 'wsl',
    commit: commit ?? null,
    branch: branch ?? null,
    device: device ?? null,
    build: build ?? null,
    appPackage: options.appPackage,
    activity: options.activity,
    dataset: options.dataset ?? 'não informado',
    network: options.network ?? 'não informado',
    cache: options.cache ?? 'não informado',
    note: 'Emulador Android local via ADB; não substitui aparelho físico nem iOS.',
  };
}
