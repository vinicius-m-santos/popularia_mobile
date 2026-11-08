/**
 * Camada fina sobre o `adb` para o coletor do POP-72.
 *
 * No WSL o emulador roda no Windows; por isso o caminho padrão procura o
 * `adb.exe` do SDK montado em `/mnt/c/...`. Também aceita `ADB_PATH` e um adb
 * Linux conectado ao mesmo servidor. Nenhum comando é executado no import.
 */

import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsyncDefault = promisify(execFile);

/** Converte `C:\Users\x\...` e `C:/Users/x/...` para o caminho montado no WSL. */
export function windowsPathToWsl(value) {
  const path = String(value ?? '').trim();
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(path);
  if (!match) return path;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
}

export function resolveAdbPath(options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    exists = existsSync,
    readdir = readdirSync,
    home = homedir(),
  } = options;
  const executable = platform === 'win32' ? 'adb.exe' : 'adb';
  const normalize = platform === 'win32' ? (value) => value : windowsPathToWsl;
  const candidates = [];

  if (env.ADB_PATH) candidates.push(normalize(env.ADB_PATH));

  for (const sdk of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, env.ANDROID_SDK]) {
    if (!sdk) continue;
    const normalized = normalize(sdk);
    candidates.push(join(normalized, 'platform-tools', executable));
  }

  // Instalação padrão do Android Studio no Windows, acessível pelo WSL.
  if (platform !== 'win32') {
    const windowsUsers = '/mnt/c/Users';
    if (exists(windowsUsers)) {
      let users = [];
      try {
        users = readdir(windowsUsers, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => !['All Users', 'Default', 'Default User', 'Public', 'desktop.ini'].includes(name));
      } catch {
        users = [];
      }
      for (const user of users) {
        candidates.push(`/mnt/c/Users/${user}/AppData/Local/Android/Sdk/platform-tools/adb.exe`);
      }
    }
  }

  candidates.push(join(home, 'Android/Sdk/platform-tools', executable));
  candidates.push(`/usr/bin/${executable}`);
  candidates.push(`/usr/local/bin/${executable}`);

  for (const candidate of candidates) {
    if (candidate && exists(candidate)) return candidate;
  }
  return env.ADB_PATH ? normalize(env.ADB_PATH) : executable;
}

/** Executa `adb` com timeout e devolve stdout/stderr mesmo em código != 0. */
export function createAdb(options = {}) {
  const {
    adbPath = resolveAdbPath(),
    serial,
    timeoutMs = 30_000,
    maxBuffer = 32 * 1024 * 1024,
    execFileAsync = execFileAsyncDefault,
  } = options;
  const targetArgs = serial ? ['-s', serial] : [];

  async function execute(args, { binary = false, timeout = timeoutMs } = {}) {
    try {
      const result = await execFileAsync(adbPath, [...targetArgs, ...args], {
        encoding: binary ? 'buffer' : 'utf8',
        timeout,
        maxBuffer,
      });
      return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr ?? '' };
    } catch (error) {
      const stderr = error?.stderr && String(error.stderr).trim() ? error.stderr : (error?.message ?? String(error));
      return {
        ok: false,
        code: typeof error?.code === 'number' ? error.code : -1,
        stdout: error?.stdout ?? (binary ? Buffer.alloc(0) : ''),
        stderr,
      };
    }
  }

  return {
    adbPath,
    serial,
    execute,
    shell: (command, options = {}) => execute(['shell', ...(Array.isArray(command) ? command : [command])], options),
    execOut: (command, options = {}) => execute(['exec-out', ...(Array.isArray(command) ? command : [command])], { ...options, binary: true }),
    devices: async () => {
      const result = await execute(['devices', '-l']);
      return { ...result, devices: parseAdbDevices(result.stdout) };
    },
    version: () => execute(['version']),
    raw: (args, options = {}) => execute(args, options),
  };
}

export function parseAdbDevices(text) {
  const devices = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('List of devices')) continue;
    const match = /^(\S+)\s+(\S+)(?:\s+(.*))?$/.exec(trimmed);
    if (!match) continue;
    const details = {};
    for (const part of (match[3] ?? '').split(/\s+/)) {
      const [key, value] = part.split(':');
      if (key && value) details[key] = value;
    }
    devices.push({ serial: match[1], state: match[2], ...details });
  }
  return devices;
}

export function selectDevice(devices, requestedSerial) {
  if (!devices || devices.length === 0) {
    throw new Error('Nenhum dispositivo ADB encontrado. Suba o emulador Android e rode `adb devices -l`.');
  }
  if (requestedSerial) {
    const found = devices.find((device) => device.serial === requestedSerial);
    if (!found) throw new Error(`Dispositivo "${requestedSerial}" não está conectado. Disponíveis: ${devices.map((device) => device.serial).join(', ')}`);
    if (found.state !== 'device') throw new Error(`Dispositivo "${requestedSerial}" está em estado "${found.state}", não "device".`);
    return found;
  }
  const ready = devices.filter((device) => device.state === 'device');
  if (ready.length === 0) throw new Error('Nenhum dispositivo ADB pronto (estado "device").');
  if (ready.length > 1) throw new Error(`Mais de um dispositivo pronto (${ready.map((device) => device.serial).join(', ')}). Use --serial.`);
  return ready[0];
}

export function requireOk(result, label) {
  if (!result?.ok) {
    const detail = String(result?.stderr ?? '').trim() || String(result?.stdout ?? '').trim() || 'sem detalhes';
    throw new Error(`${label} falhou (adb=${result?.code ?? '?'}): ${detail}`);
  }
  return result;
}
