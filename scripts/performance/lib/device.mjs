/**
 * Controlador de um dispositivo Android via ADB.
 *
 * As ações (tap, swipe, texto, deep link) e as leituras (gfxinfo, meminfo,
 * /proc, netstats) ficam neste módulo. O runner recebe uma instância e pode ser
 * testado com um duplo em memória.
 */

import { requireOk } from './adb.mjs';
import {
  findUiElement,
  parseDeviceIdentity,
  parseFrameStats,
  parseMeminfo,
  parseNetStats,
  parseProcessStat,
  parseStartupOutput,
  parseUiautomator,
} from './parsers.mjs';
import { round } from './statistics.mjs';

export const UI_DUMP_PATHS = ['/sdcard/popularia-window.xml', '/data/local/tmp/popularia-window.xml'];

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shellQuote(value) {
  return `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`;
}

function firstNumber(text) {
  const match = /(\d+)/.exec(String(text ?? ''));
  return match ? Number(match[1]) : null;
}

export function createDeviceController({
  adb,
  appPackage,
  activity = '.MainActivity',
  logger = console,
  timeoutMs = 30_000,
} = {}) {
  if (!adb) throw new Error('createDeviceController exige um adb.');
  if (!appPackage) throw new Error('createDeviceController exige appPackage.');

  let identity = null;
  let appUid = null;
  let clockTicks = 100;

  function component() {
    return activity.startsWith('.') ? `${appPackage}/${activity}` : activity;
  }

  async function shell(command, options = {}) {
    return adb.shell(command, { timeout: timeoutMs, ...options });
  }

  async function shellText(command, options = {}) {
    const result = await shell(command, options);
    return { ...result, text: String(result.stdout ?? '') };
  }

  async function getProps() {
    const result = await shellText(['getprop']);
    return result.text;
  }

  async function connect() {
    const [propsResult, sizeResult, densityResult, displayResult, packageResult, clockResult] = await Promise.all([
      getProps(),
      shellText(['wm', 'size']),
      shellText(['wm', 'density']),
      shellText(['dumpsys', 'display']),
      shellText(['dumpsys', 'package', appPackage]),
      shellText(['getconf', 'CLK_TCK']),
    ]);
    const props = {};
    for (const line of propsResult.split(/\r?\n/)) {
      const match = /^\[([^\]]+)\]:\s*\[(.*)\]$/.exec(line.trim());
      if (match) props[match[1]] = match[2];
    }
    identity = parseDeviceIdentity({
      props,
      wmSize: sizeResult.text,
      wmDensity: densityResult.text,
      display: displayResult.text,
      packageInfo: packageResult.text,
    });
    appUid = identity.build.userId;
    clockTicks = firstNumber(clockResult.text) ?? 100;
    return identity;
  }

  return {
    appPackage,
    activity,
    get identity() { return identity; },
    get appUid() { return appUid; },
    get clockTicks() { return clockTicks; },
    connect,

    async getPid() {
      const result = await shellText(['pidof', appPackage]);
      return firstNumber(result.text);
    },

    async forceStop() {
      const result = await shell(['am', 'force-stop', appPackage]);
      return result;
    },

    async start({ deepLink, timeout = timeoutMs } = {}) {
      const command = deepLink
        ? ['am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', shellQuote(deepLink), appPackage]
        : ['am', 'start', '-W', '-n', component()];
      const result = await shell(command, { timeout });
      return {
        ...result,
        startup: parseStartupOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
      };
    },

    async openDeepLink(deepLink, options = {}) {
      return this.start({ deepLink, ...options });
    },

    async resetFrameStats() {
      // Em processo recém-iniciado ou já parado o reset pode falhar; não é fatal.
      return shell(['dumpsys', 'gfxinfo', appPackage, 'reset']);
    },

    async frameStats() {
      const result = await shellText(['dumpsys', 'gfxinfo', appPackage, 'framestats'], { timeout: Math.max(timeoutMs, 45_000) });
      const refreshRateHz = identity?.refreshRateHz ?? 60;
      return {
        ...result,
        metrics: parseFrameStats(result.text, { refreshRateHz }),
      };
    },

    async meminfo() {
      const result = await shellText(['dumpsys', 'meminfo', appPackage], { timeout: Math.max(timeoutMs, 45_000) });
      return { ...result, metrics: parseMeminfo(result.text) };
    },

    async processStat() {
      const pid = await this.getPid();
      if (!pid) return { pid: null, metrics: null, text: '' };
      const result = await shellText(['cat', `/proc/${pid}/stat`]);
      return { ...result, pid, metrics: parseProcessStat(result.text, clockTicks) };
    },

    async netStats() {
      if (appUid === null) return { metrics: parseNetStats('', null) };
      const result = await shellText(['dumpsys', 'netstats', 'detail'], { timeout: Math.max(timeoutMs, 60_000) });
      return { ...result, metrics: parseNetStats(result.text, appUid) };
    },

    async dumpUi() {
      let lastError = null;
      for (const path of UI_DUMP_PATHS) {
        const dump = await shell(['uiautomator', 'dump', path]);
        if (!dump.ok) {
          lastError = dump.stderr || dump.stdout;
          continue;
        }
        const cat = await shellText(['cat', path]);
        if (cat.ok && cat.text.trim().startsWith('<')) {
          return { ok: true, xml: cat.text, path, elements: parseUiautomator(cat.text), error: null };
        }
        lastError = cat.stderr || 'dump vazio';
      }
      return { ok: false, xml: '', path: null, elements: [], error: String(lastError ?? 'uiautomator dump falhou') };
    },

    async waitForElement(label, options = {}) {
      const { timeoutMs: waitTimeoutMs = 12_000, intervalMs = 500, exact = false } = options;
      const startedAt = Date.now();
      let last = null;
      while (Date.now() - startedAt <= waitTimeoutMs) {
        last = await this.dumpUi();
        const element = last.ok ? findUiElement(last.elements, label, { exact }) : null;
        if (element) return { element, dump: last, elapsedMs: Date.now() - startedAt };
        await sleep(intervalMs);
      }
      return { element: null, dump: last, elapsedMs: Date.now() - startedAt };
    },

    async tap(x, y) {
      return shell(['input', 'tap', String(Math.round(x)), String(Math.round(y))]);
    },

    async tapLabel(label, options = {}) {
      const found = await this.waitForElement(label, options);
      if (!found.element) return { ...found, tapped: false };
      const result = await this.tap(found.element.center.x, found.element.center.y);
      return { ...found, tapped: result.ok, tapResult: result };
    },

    async inputText(text) {
      // `input text` não aceita espaços crus nem acentos de forma confiável.
      const encoded = String(text).replace(/ /g, '%s').replace(/[^\x20-\x7E]/g, '');
      return shell(['input', 'text', encoded]);
    },

    async keyevent(code) {
      return shell(['input', 'keyevent', String(code)]);
    },

    async swipe({ from, to, durationMs = 350 }) {
      const width = identity?.resolution?.width ?? 1080;
      const height = identity?.resolution?.height ?? 2400;
      const x1 = Math.round(from.x * width);
      const y1 = Math.round(from.y * height);
      const x2 = Math.round(to.x * width);
      const y2 = Math.round(to.y * height);
      return shell(['input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(Math.round(durationMs))]);
    },

    async screenshot() {
      const result = await adb.execOut(['screencap', '-p'], { timeout: timeoutMs });
      if (!result.ok || !result.stdout || result.stdout.length < 8) return { ok: false, buffer: null, error: String(result.stderr ?? 'screencap vazio') };
      return { ok: true, buffer: result.stdout, error: null };
    },

    async logcat(extra = ['-d', '-t', '1200']) {
      const result = await shellText(['logcat', ...extra], { timeout: Math.max(timeoutMs, 45_000) });
      return result;
    },

    /**
     * Lê um arquivo privado do app. Em development build o `run-as` funciona
     * porque o pacote é debuggable; em emulador com root o caminho direto é o
     * fallback. Em staging sem root, o snapshot JS fica indisponível e o
     * relatório registra isso.
     */
    async readAppFile(relativePath) {
      const viaRunAs = await shell(['run-as', appPackage, 'cat', relativePath]);
      if (viaRunAs.ok && String(viaRunAs.stdout ?? '').trim()) {
        return { ...viaRunAs, text: String(viaRunAs.stdout), source: 'run-as' };
      }
      const directPath = `/data/user/0/${appPackage}/${relativePath}`;
      const direct = await shell(['cat', directPath]);
      if (direct.ok && String(direct.stdout ?? '').trim()) {
        return { ...direct, text: String(direct.stdout), source: 'root' };
      }
      return {
        ok: false,
        text: '',
        source: null,
        stderr: [viaRunAs.stderr, direct.stderr].filter(Boolean).join('\n'),
      };
    },

    /** Evita ler um snapshot antigo quando a ponte JS está desligada. */
    async deleteAppFile(relativePath) {
      const viaRunAs = await shell(['run-as', appPackage, 'rm', '-f', relativePath]);
      if (viaRunAs.ok) return { ok: true, source: 'run-as' };
      const direct = await shell(['rm', '-f', `/data/user/0/${appPackage}/${relativePath}`]);
      return { ok: direct.ok, source: direct.ok ? 'root' : null, stderr: direct.stderr };
    },

    /** Amostra leve para o pico de PSS/CPU durante o cenário. */
    async sample() {
      const [mem, proc] = await Promise.all([this.meminfo(), this.processStat()]);
      return {
        atMs: Date.now(),
        pssKb: mem.metrics?.pssKb ?? null,
        javaHeapKb: mem.metrics?.javaHeapKb ?? null,
        nativeHeapKb: mem.metrics?.nativeHeapKb ?? null,
        cpuTicks: proc.metrics?.ticks ?? null,
        pid: proc.pid ?? null,
      };
    },

    async cpuPercent(startSample, endSample, elapsedMs) {
      if (!startSample?.cpuTicks || !endSample?.cpuTicks || elapsedMs <= 0) return null;
      const deltaTicks = endSample.cpuTicks - startSample.cpuTicks;
      if (deltaTicks < 0) return null;
      return round((deltaTicks / clockTicks) / (elapsedMs / 1000) * 100, 2);
    },

    logger,
  };
}

export function explainAdbFailure(result, label) {
  try {
    return requireOk(result, label).stdout;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
