import { describe, expect, it } from '@jest/globals';

import { parseAdbDevices, resolveAdbPath, selectDevice, windowsPathToWsl } from '../lib/adb.mjs';

describe('caminho do adb no WSL', () => {
  it('converte caminhos do Windows e aceita adb Linux', () => {
    expect(windowsPathToWsl('C:\\Users\\Ana\\AppData\\Local\\Android\\Sdk')).toBe('/mnt/c/Users/Ana/AppData/Local/Android/Sdk');
    expect(windowsPathToWsl('/usr/bin/adb')).toBe('/usr/bin/adb');
  });

  it('prioriza ADB_PATH existente e cai no adb do PATH', () => {
    const seen = [];
    const path = resolveAdbPath({
      env: { ADB_PATH: '/custom/adb' },
      platform: 'linux',
      home: '/home/qa',
      exists: (candidate) => { seen.push(candidate); return candidate === '/custom/adb'; },
      readdir: () => [],
    });
    expect(path).toBe('/custom/adb');
    expect(seen).toContain('/custom/adb');
    expect(seen).not.toContain('/usr/bin/adb');
  });

  it('procura o SDK do Android Studio no WSL', () => {
    const path = resolveAdbPath({
      env: {},
      platform: 'linux',
      home: '/home/qa',
      exists: (candidate) => candidate === '/mnt/c/Users' || candidate === '/mnt/c/Users/Ana/AppData/Local/Android/Sdk/platform-tools/adb.exe',
      readdir: () => [{ name: 'Ana', isDirectory: () => true }],
    });
    expect(path).toBe('/mnt/c/Users/Ana/AppData/Local/Android/Sdk/platform-tools/adb.exe');
  });
});

describe('seleção de dispositivo', () => {
  it('lê adb devices -l e exige --serial quando há mais de um pronto', () => {
    const devices = parseAdbDevices(`List of devices attached
emulator-5554\tdevice product:sdk_gphone64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1
R58M456\tdevice usb:1-2 transport_id:3
R58M123\tunauthorized usb:1-1 transport_id:2
`);
    expect(devices).toHaveLength(3);
    expect(devices[0]).toMatchObject({ serial: 'emulator-5554', state: 'device', model: 'sdk_gphone64_x86_64' });
    expect(selectDevice(devices, 'emulator-5554').serial).toBe('emulator-5554');
    expect(() => selectDevice(devices)).toThrow(/Mais de um dispositivo/);
    expect(() => selectDevice(devices, 'R58M123')).toThrow(/estado "unauthorized"/);
    expect(() => selectDevice([], null)).toThrow(/Nenhum dispositivo/);
  });
});
