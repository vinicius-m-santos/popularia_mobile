/**
 * Parsers determinísticos das saídas do ADB usadas pelo POP-72.
 *
 * Tudo aqui recebe texto (ou XML) já capturado. Nenhum parser toca no aparelho,
 * o que permite testar o relatório sem emulador. Quando o formato não é
 * reconhecido, a métrica fica `available: false` em vez de virar zero.
 */

import { mean, quantile, round } from './statistics.mjs';

const DEFAULT_REFRESH_RATE_HZ = 60;

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMatch(text, regex) {
  const match = regex.exec(text ?? '');
  return match ? match[1] : null;
}

function decodeXmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function parseGetprop(text) {
  const props = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = /^\[([^\]]+)\]:\s*\[(.*)\]$/.exec(line.trim());
    if (match) props[match[1]] = match[2];
  }
  return props;
}

export function parseWmSize(text) {
  const overridden = firstMatch(text, /Override size:\s*(\d+x\d+)/i);
  const physical = firstMatch(text, /Physical size:\s*(\d+x\d+)/i);
  const value = overridden ?? physical;
  if (!value) return null;
  const [width, height] = value.split('x').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height, value, overridden: Boolean(overridden) };
}

export function parseWmDensity(text) {
  const overridden = firstMatch(text, /Override density:\s*(\d+)/i);
  const physical = firstMatch(text, /Physical density:\s*(\d+)/i);
  const value = numberOrNull(overridden ?? physical);
  return value === null ? null : { density: value, overridden: Boolean(overridden) };
}

export function parseRefreshRate(text, fallback = DEFAULT_REFRESH_RATE_HZ) {
  const patterns = [
    /Refresh rate:\s*([\d.]+)/i,
    /mRefreshRate\s*=\s*([\d.]+)/i,
    /refreshRate\s*=\s*([\d.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text ?? '');
    const value = numberOrNull(match?.[1]);
    if (value !== null && value > 0 && value <= 240) return value;
  }
  return fallback;
}

export function parsePackageInfo(text) {
  const body = String(text ?? '');
  return {
    versionName: firstMatch(body, /versionName=([^\s]+)/),
    versionCode: numberOrNull(firstMatch(body, /versionCode=(\d+)/)),
    userId: numberOrNull(firstMatch(body, /\buserId=(\d+)/)),
    debug: /\bDEBUGGABLE\b/.test(body),
  };
}

export function parseDeviceIdentity({ props = {}, wmSize = '', wmDensity = '', display = '', packageInfo = '' } = {}) {
  const isEmulator = props['ro.kernel.qemu'] === '1'
    || props['ro.boot.qemu'] === '1'
    || /emulator|sdk_gphone|generic/i.test(`${props['ro.product.model'] ?? ''} ${props['ro.product.device'] ?? ''} ${props['ro.build.fingerprint'] ?? ''}`)
    || /emulator/i.test(props['ro.build.characteristics'] ?? '');

  return {
    manufacturer: props['ro.product.manufacturer'] ?? null,
    model: props['ro.product.model'] ?? null,
    device: props['ro.product.device'] ?? null,
    androidVersion: props['ro.build.version.release'] ?? null,
    sdk: numberOrNull(props['ro.build.version.sdk']),
    abi: props['ro.product.cpu.abi'] ?? null,
    fingerprint: props['ro.build.fingerprint'] ?? null,
    isEmulator,
    resolution: parseWmSize(wmSize),
    density: parseWmDensity(wmDensity),
    refreshRateHz: parseRefreshRate(display),
    build: parsePackageInfo(packageInfo),
  };
}

export function parseGfxInfoSummary(text) {
  const body = String(text ?? '');
  const janky = numberOrNull(firstMatch(body, /Janky frames:\s*(\d+)/i));
  const total = numberOrNull(firstMatch(body, /Total frames rendered:\s*(\d+)/i));
  const skipped = numberOrNull(firstMatch(body, /Skipped frames:\s*(\d+)/i));
  const percent = numberOrNull(firstMatch(body, /Janky frames:\s*\d+\s*\(([\d.]+)%\)/i));
  if (janky === null && total === null && skipped === null) return null;
  return {
    jankyFrames: janky,
    totalFrames: total,
    skippedFrames: skipped,
    jankPct: percent ?? (janky !== null && total ? round((janky / total) * 100, 2) : null),
  };
}

function framePercentiles(values) {
  if (values.length === 0) {
    return { samples: 0, minMs: null, p50Ms: null, p90Ms: null, p95Ms: null, p99Ms: null, maxMs: null, meanMs: null };
  }
  return {
    samples: values.length,
    minMs: round(Math.min(...values), 2),
    p50Ms: round(quantile(values, 0.5), 2),
    p90Ms: round(quantile(values, 0.9), 2),
    p95Ms: round(quantile(values, 0.95), 2),
    p99Ms: round(quantile(values, 0.99), 2),
    maxMs: round(Math.max(...values), 2),
    meanMs: round(mean(values), 2),
  };
}

function parseFrameCsv(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^Flags,IntendedVsync,/i.test(line.trim()));
  if (headerIndex < 0) return null;
  const header = lines[headerIndex].split(',').map((part) => part.trim().toLowerCase());
  const indexes = {
    intended: header.indexOf('intendedvsync'),
    completed: header.indexOf('framecompleted'),
    input: header.indexOf('handleinputstart'),
  };
  if (indexes.intended < 0 || indexes.completed < 0) return null;

  const rows = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith('---') || /^[A-Za-z]/.test(line)) break;
    const columns = line.split(',');
    if (columns.length <= indexes.completed) continue;
    const intended = numberOrNull(columns[indexes.intended]);
    const completed = numberOrNull(columns[indexes.completed]);
    if (intended === null || completed === null || intended <= 0 || completed <= 0) continue;
    const frameMs = (completed - intended) / 1_000_000;
    if (!Number.isFinite(frameMs) || frameMs < 0 || frameMs > 60_000) continue;
    const inputStart = indexes.input >= 0 ? numberOrNull(columns[indexes.input]) : null;
    const inputLatencyMs = inputStart !== null && inputStart > 0 && completed > inputStart
      ? (completed - inputStart) / 1_000_000
      : null;
    rows.push({ frameMs, inputLatencyMs, flags: numberOrNull(columns[0]) });
  }
  return rows.length > 0 ? rows : null;
}

/**
 * `dumpsys gfxinfo <pkg> framestats` entrega o CSV de frames; a mesma saída
 * também tem um resumo agregado. A medição de jank usa o frame budget do
 * refresh rate e um multiplicador para não classificar ruído de 1 frame.
 */
export function parseFrameStats(text, options = {}) {
  const {
    refreshRateHz = DEFAULT_REFRESH_RATE_HZ,
    jankMultiplier = 1.5,
    slowMultiplier = 2,
    jsStallThresholdMs = 100,
  } = options;
  const refresh = numberOrNull(refreshRateHz) ?? DEFAULT_REFRESH_RATE_HZ;
  const frameBudgetMs = 1000 / refresh;
  const rows = parseFrameCsv(text);
  const summary = parseGfxInfoSummary(text);

  if (!rows) {
    return {
      available: false,
      source: summary ? 'gfxinfo-summary' : 'none',
      refreshRateHz: refresh,
      frameBudgetMs: round(frameBudgetMs, 2),
      measuredFrames: summary?.totalFrames ?? 0,
      jankyFrames: summary?.jankyFrames ?? null,
      jankPct: summary?.jankPct ?? null,
      skippedFrames: summary?.skippedFrames ?? null,
      slowFrames: null,
      slowPct: null,
      p50Ms: null,
      p90Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null,
      meanMs: null,
      interaction: { samples: 0, p50Ms: null, p90Ms: null, p95Ms: null, maxMs: null },
      jsStalls: { source: 'gfxinfo-long-frame-proxy', thresholdMs: jsStallThresholdMs, count: null, maxMs: null, totalMs: null },
      note: summary ? 'framestats ausente; usando o resumo agregado do gfxinfo' : 'gfxinfo sem frames mensuráveis',
    };
  }

  const frameValues = rows.map((row) => row.frameMs);
  const interactionValues = rows.map((row) => row.inputLatencyMs).filter((value) => value !== null);
  const metrics = framePercentiles(frameValues);
  const interaction = framePercentiles(interactionValues);
  const jankThresholdMs = frameBudgetMs * jankMultiplier;
  const slowThresholdMs = frameBudgetMs * slowMultiplier;
  const jankyFrames = frameValues.filter((value) => value > jankThresholdMs).length;
  const slowFrames = frameValues.filter((value) => value > slowThresholdMs).length;
  const longFrames = frameValues.filter((value) => value >= jsStallThresholdMs);

  return {
    available: true,
    source: 'gfxinfo-framestats',
    refreshRateHz: refresh,
    frameBudgetMs: round(frameBudgetMs, 2),
    jankThresholdMs: round(jankThresholdMs, 2),
    slowThresholdMs: round(slowThresholdMs, 2),
    measuredFrames: metrics.samples,
    jankyFrames,
    jankPct: round((jankyFrames / metrics.samples) * 100, 2),
    skippedFrames: summary?.skippedFrames ?? null,
    slowFrames,
    slowPct: round((slowFrames / metrics.samples) * 100, 2),
    ...metrics,
    interaction: {
      ...interaction,
      p50Ms: interaction.p50Ms,
      p90Ms: interaction.p90Ms,
      p95Ms: interaction.p95Ms,
      maxMs: interaction.maxMs,
    },
    jsStalls: {
      source: 'gfxinfo-long-frame-proxy',
      thresholdMs: jsStallThresholdMs,
      count: longFrames.length,
      maxMs: longFrames.length > 0 ? round(Math.max(...longFrames), 2) : 0,
      totalMs: round(longFrames.reduce((total, value) => total + value, 0), 2),
    },
    note: null,
  };
}

export function parseMeminfo(text) {
  const body = String(text ?? '');
  const summary = /App Summary([\s\S]*?)(?:\n\s*\n|$)/i.exec(body)?.[1] ?? body;
  const pss = numberOrNull(firstMatch(summary, /\bTOTAL:\s*(\d+)/i))
    ?? numberOrNull(firstMatch(body, /TOTAL PSS:\s*(\d+)/i));
  const rss = numberOrNull(firstMatch(summary, /\bTOTAL RSS:\s*(\d+)/i))
    ?? numberOrNull(firstMatch(body, /TOTAL RSS:\s*(\d+)/i));
  const javaHeap = numberOrNull(firstMatch(summary, /Java Heap:\s*(\d+)/i));
  const nativeHeap = numberOrNull(firstMatch(summary, /Native Heap:\s*(\d+)/i));
  const code = numberOrNull(firstMatch(summary, /\bCode:\s*(\d+)/i));
  const stack = numberOrNull(firstMatch(summary, /\bStack:\s*(\d+)/i));
  const graphics = numberOrNull(firstMatch(summary, /\bGraphics:\s*(\d+)/i));
  const system = numberOrNull(firstMatch(summary, /\bSystem:\s*(\d+)/i));
  return {
    available: pss !== null,
    pssKb: pss,
    rssKb: rss,
    javaHeapKb: javaHeap,
    nativeHeapKb: nativeHeap,
    codeKb: code,
    stackKb: stack,
    graphicsKb: graphics,
    systemKb: system,
    note: pss === null ? 'meminfo sem App Summary/TOTAL PSS' : null,
  };
}

export function parseProcessStat(text, clockTicks = 100) {
  const body = String(text ?? '').trim();
  const closing = body.lastIndexOf(')');
  if (closing < 0) return null;
  const fields = body.slice(closing + 1).trim().split(/\s+/);
  // fields[0] é o estado (campo 3 de /proc/<pid>/stat); utime/stime são 14/15.
  const utime = numberOrNull(fields[11]);
  const stime = numberOrNull(fields[12]);
  if (utime === null || stime === null) return null;
  const ticks = utime + stime;
  return {
    utimeTicks: utime,
    stimeTicks: stime,
    ticks,
    clockTicks,
    cpuSeconds: ticks / clockTicks,
  };
}

/** `dumpsys netstats detail` pode ter uma linha por iface/tag; soma só `primary`. */
export function parseNetStats(text, uid) {
  const target = String(uid);
  const entries = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!new RegExp(`\\buid=${target}\\b`).test(line)) continue;
    const scope = /primary=\{([^}]*)\}/.exec(line)?.[1] ?? line;
    const rxBytes = numberOrNull(firstMatch(scope, /rxBytes[:=](\d+)/i));
    const txBytes = numberOrNull(firstMatch(scope, /txBytes[:=](\d+)/i));
    const rxPackets = numberOrNull(firstMatch(scope, /rxPackets[:=](\d+)/i));
    const txPackets = numberOrNull(firstMatch(scope, /txPackets[:=](\d+)/i));
    if (rxBytes === null && txBytes === null) continue;
    entries.push({ rxBytes: rxBytes ?? 0, txBytes: txBytes ?? 0, rxPackets: rxPackets ?? 0, txPackets: txPackets ?? 0 });
  }
  const total = entries.reduce((accumulator, entry) => ({
    rxBytes: accumulator.rxBytes + entry.rxBytes,
    txBytes: accumulator.txBytes + entry.txBytes,
    rxPackets: accumulator.rxPackets + entry.rxPackets,
    txPackets: accumulator.txPackets + entry.txPackets,
  }), { rxBytes: 0, txBytes: 0, rxPackets: 0, txPackets: 0 });
  return {
    available: entries.length > 0,
    uid: numberOrNull(uid),
    entries: entries.length,
    ...total,
    note: entries.length === 0 ? `netstats sem linhas para uid=${target}` : null,
  };
}

export function parseStartupOutput(text) {
  const body = String(text ?? '');
  const totalTimeMs = numberOrNull(firstMatch(body, /\bTotalTime:\s*(\d+)/i));
  const waitTimeMs = numberOrNull(firstMatch(body, /\bWaitTime:\s*(\d+)/i));
  return {
    available: totalTimeMs !== null || waitTimeMs !== null,
    status: firstMatch(body, /\bStatus:\s*([^\s]+)/i),
    launchState: firstMatch(body, /\bLaunchState:\s*([^\s]+)/i),
    activity: firstMatch(body, /\bActivity:\s*([^\s]+)/i),
    totalTimeMs,
    waitTimeMs,
    note: totalTimeMs === null ? 'am start -W sem TotalTime' : null,
  };
}

/** Fallback independente do `am start -W`: linha `Displayed ...: +123ms`. */
export function parseDisplayedLaunch(logcat, packageName) {
  const pattern = new RegExp(`Displayed\\s+${String(packageName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\w.$/]*:\\s*\\+(\\d+)ms`, 'g');
  let match;
  let last = null;
  while ((match = pattern.exec(String(logcat ?? ''))) !== null) {
    last = { totalTimeMs: Number(match[1]), raw: match[0] };
  }
  return last ? { available: true, ...last } : { available: false, totalTimeMs: null, raw: null };
}

/** Extrai os nós do dump do uiautomator sem dependência de parser XML. */
export function parseUiautomator(xml) {
  const elements = [];
  const nodePattern = /<node\b([^>]*)>/g;
  let node;
  while ((node = nodePattern.exec(String(xml ?? ''))) !== null) {
    const attributes = {};
    const attributePattern = /([\w:-]+)="([^"]*)"/g;
    let attribute;
    while ((attribute = attributePattern.exec(node[1])) !== null) {
      attributes[attribute[1]] = decodeXmlEntities(attribute[2]);
    }
    const boundsMatch = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attributes.bounds ?? '');
    const bounds = boundsMatch
      ? {
          left: Number(boundsMatch[1]),
          top: Number(boundsMatch[2]),
          right: Number(boundsMatch[3]),
          bottom: Number(boundsMatch[4]),
        }
      : null;
    elements.push({
      text: attributes.text ?? '',
      contentDesc: attributes['content-desc'] ?? '',
      resourceId: attributes['resource-id'] ?? '',
      className: attributes.class ?? '',
      package: attributes.package ?? '',
      clickable: attributes.clickable === 'true',
      enabled: attributes.enabled !== 'false',
      bounds,
      center: bounds
        ? { x: Math.round((bounds.left + bounds.right) / 2), y: Math.round((bounds.top + bounds.bottom) / 2) }
        : null,
    });
  }
  return elements;
}

export function findUiElement(elements, label, options = {}) {
  const { exact = false, clickableOnly = false } = options;
  const normalized = String(label ?? '').toLocaleLowerCase('pt-BR');
  if (!normalized) return null;
  const candidates = (elements ?? []).filter((element) => {
    if (clickableOnly && !element.clickable) return false;
    if (!element.center) return false;
    const labels = [element.text, element.contentDesc, element.resourceId].filter(Boolean).map((value) => value.toLocaleLowerCase('pt-BR'));
    return labels.some((value) => (exact ? value === normalized : value.includes(normalized)));
  });
  if (candidates.length === 0) return null;
  const exactMatch = candidates.find((element) => [element.text, element.contentDesc].some((value) => value.toLocaleLowerCase('pt-BR') === normalized));
  const clickable = candidates.find((element) => element.clickable);
  return exactMatch ?? clickable ?? candidates[0];
}
