import { describe, expect, it } from '@jest/globals';

import {
  findUiElement,
  parseDeviceIdentity,
  parseDisplayedLaunch,
  parseFrameStats,
  parseGetprop,
  parseGfxInfoSummary,
  parseMeminfo,
  parseNetStats,
  parsePackageInfo,
  parseProcessStat,
  parseRefreshRate,
  parseStartupOutput,
  parseUiautomator,
  parseWmDensity,
  parseWmSize,
} from '../lib/parsers.mjs';

const FRAME_HEADER = 'Flags,IntendedVsync,Vsync,OldestInputEvent,NewestInputEvent,HandleInputStart,AnimationStart,PerformTraversalsStart,DrawStart,SyncQueued,SyncStart,IssueDrawCommandsStart,SwapBuffers,FrameCompleted,DequeueBufferDuration,QueueBufferDuration,GpuCompleted';

function frameRow({ intended, completed, input = 0, flags = 0 }) {
  return [flags, intended, intended, 0, 0, input, intended, intended, intended, intended, intended, intended, completed, completed, 0, 0, completed].join(',');
}

const GFXINFO_FRAMESTATS = `Graphics info for pid 1234 [com.popularia.mobile]:
Refresh rate: 60.00
Janky frames: 2 (50.00%)
Total frames rendered: 4
Skipped frames: 1
---PROFILEDATA---
${FRAME_HEADER}
${frameRow({ intended: 1_000_000_000, completed: 1_016_666_667 })}
${frameRow({ intended: 2_000_000_000, completed: 2_020_000_000, input: 2_000_000_000 })}
${frameRow({ intended: 3_000_000_000, completed: 3_040_000_000 })}
${frameRow({ intended: 4_000_000_000, completed: 4_100_000_000 })}
---END---`;

const MEMINFO = `** MEMINFO in pid 1234 [com.popularia.mobile] **
                   Pss(KB)                        Rss(KB)
                   ------                        ------
           Java Heap:    12000                         14000
         Native Heap:    34000                         36000
                Code:     8000                          8000
               Stack:      500                           500
            Graphics:     6000                          6000
       Private Other:     3000
              System:     9000
             TOTAL:    72500      TOTAL SWAP PSS: 0
`;

const NETSTATS = `Dev stats:
  [0] iface=wlan0 uid=10123 set=DEFAULT tag=0x0(none) primary={rxBytes:1200 txBytes:3400 rxPackets:10 txPackets:20} 
  [1] iface=wlan0 uid=10123 set=FOREGROUND tag=0x0(none) primary={rxBytes:300 txBytes:100 rxPackets:2 txPackets:1}
  [2] iface=wlan0 uid=10999 set=DEFAULT tag=0x0(none) primary={rxBytes:9999 txBytes:9999 rxPackets:99 txPackets:99}
`;

const UI_XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.popularia.mobile" content-desc="" clickable="false" enabled="true" bounds="[0,0][1080,2400]">
    <node index="0" text="Para você" resource-id="" class="android.widget.TextView" package="com.popularia.mobile" content-desc="" clickable="true" enabled="true" bounds="[100,200][400,260]" />
    <node index="1" text="" resource-id="" class="android.widget.Button" package="com.popularia.mobile" content-desc="Criar publicação" clickable="true" enabled="true" bounds="[20,300][1060,360]" />
  </node>
</hierarchy>`;

describe('parsers de dispositivo', () => {
  it('lê getprop, tamanho, densidade e refresh rate', () => {
    const props = parseGetprop('[ro.product.manufacturer]: [Google]\n[ro.product.model]: [sdk_gphone64_x86_64]\n[ro.build.version.sdk]: [34]\n');
    expect(props).toMatchObject({ 'ro.product.manufacturer': 'Google', 'ro.build.version.sdk': '34' });
    expect(parseWmSize('Physical size: 1080x2400\nOverride size: 720x1600')).toMatchObject({ width: 720, height: 1600, overridden: true });
    expect(parseWmDensity('Physical density: 420\nOverride density: 320')).toMatchObject({ density: 320, overridden: true });
    expect(parseRefreshRate('mRefreshRate=120.0')).toBe(120);
    expect(parseRefreshRate('sem refresh', 60)).toBe(60);
  });

  it('identifica emulador e lê o pacote', () => {
    const identity = parseDeviceIdentity({
      props: {
        'ro.product.manufacturer': 'Google',
        'ro.product.model': 'sdk_gphone64_x86_64',
        'ro.product.device': 'emu64xa',
        'ro.build.version.release': '14',
        'ro.build.version.sdk': '34',
        'ro.product.cpu.abi': 'x86_64',
        'ro.kernel.qemu': '1',
      },
      wmSize: 'Physical size: 1080x2400',
      wmDensity: 'Physical density: 420',
      display: 'mRefreshRate=60.0',
      packageInfo: 'versionCode=7 versionName=1.2.3\nuserId=10123\nDEBUGGABLE',
    });
    expect(identity).toMatchObject({
      model: 'sdk_gphone64_x86_64',
      androidVersion: '14',
      sdk: 34,
      isEmulator: true,
      refreshRateHz: 60,
      resolution: { width: 1080, height: 2400 },
      build: { versionCode: 7, versionName: '1.2.3', userId: 10123, debug: true },
    });
    expect(parsePackageInfo('versionName=1.0 versionCode=2')).toMatchObject({ versionName: '1.0', versionCode: 2 });
  });
});

describe('parser de frames', () => {
  it('calcula jank, percentis e latência de input sem inventar frames', () => {
    const metrics = parseFrameStats(GFXINFO_FRAMESTATS, { refreshRateHz: 60 });
    expect(metrics).toMatchObject({
      available: true,
      source: 'gfxinfo-framestats',
      refreshRateHz: 60,
      measuredFrames: 4,
      jankyFrames: 2,
      jankPct: 50,
      slowFrames: 2,
      skippedFrames: 1,
    });
    expect(metrics.p50Ms).toBeGreaterThan(19);
    expect(metrics.maxMs).toBe(100);
    expect(metrics.interaction).toMatchObject({ samples: 1, maxMs: 20 });
    expect(metrics.jsStalls).toMatchObject({ count: 1, maxMs: 100 });
  });

  it('usa o resumo agregado quando o framestats não está disponível', () => {
    const summary = parseGfxInfoSummary('Janky frames: 12 (6.00%)\nTotal frames rendered: 200\nSkipped frames: 3\n');
    expect(summary).toMatchObject({ jankyFrames: 12, totalFrames: 200, skippedFrames: 3, jankPct: 6 });
    const metrics = parseFrameStats('Janky frames: 12 (6.00%)\nTotal frames rendered: 200\n');
    expect(metrics).toMatchObject({ available: false, source: 'gfxinfo-summary', jankyFrames: 12, jankPct: 6 });
  });

  it('devolve indisponível em vez de zero quando não há frames', () => {
    const metrics = parseFrameStats('sem dados');
    expect(metrics).toMatchObject({ available: false, source: 'none', measuredFrames: 0, jankPct: null });
  });
});

describe('parsers de memória, CPU, rede e startup', () => {
  it('lê PSS/java/native do App Summary', () => {
    expect(parseMeminfo(MEMINFO)).toMatchObject({
      available: true,
      pssKb: 72500,
      javaHeapKb: 12000,
      nativeHeapKb: 34000,
      codeKb: 8000,
      graphicsKb: 6000,
    });
    expect(parseMeminfo('sem meminfo')).toMatchObject({ available: false, pssKb: null });
  });

  it('soma utime+stime a partir do /proc/<pid>/stat', () => {
    const stat = '1234 (com.popularia.mobile) S 1 1234 1234 0 -1 4194560 100 0 0 0 25 10 0 0 20 0 20 0 100 1000000 200 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0';
    expect(parseProcessStat(stat, 100)).toMatchObject({ utimeTicks: 25, stimeTicks: 10, ticks: 35, clockTicks: 100 });
    expect(parseProcessStat('', 100)).toBeNull();
  });

  it('soma apenas as linhas primary do UID e ignora outros UIDs', () => {
    expect(parseNetStats(NETSTATS, 10123)).toMatchObject({
      available: true,
      entries: 2,
      rxBytes: 1500,
      txBytes: 3500,
      rxPackets: 12,
      txPackets: 21,
    });
    expect(parseNetStats('', 10123)).toMatchObject({ available: false, rxBytes: 0, note: expect.stringContaining('10123') });
  });

  it('lê am start -W e o fallback de logcat', () => {
    const output = [
      'Starting: Intent { cmp=com.popularia.mobile/.MainActivity }',
      'Status: ok',
      'LaunchState: COLD',
      'Activity: com.popularia.mobile/.MainActivity',
      'TotalTime: 1234',
      'WaitTime: 1500',
    ].join('\n');
    expect(parseStartupOutput(output)).toMatchObject({
      available: true,
      status: 'ok',
      launchState: 'COLD',
      totalTimeMs: 1234,
      waitTimeMs: 1500,
    });
    expect(parseDisplayedLaunch('Displayed com.popularia.mobile/.MainActivity: +987ms', 'com.popularia.mobile')).toMatchObject({ available: true, totalTimeMs: 987 });
    expect(parseDisplayedLaunch('nada', 'com.popularia.mobile')).toMatchObject({ available: false, totalTimeMs: null });
  });
});

describe('parser do uiautomator', () => {
  it('encontra labels por texto/content-desc e calcula o centro', () => {
    const elements = parseUiautomator(UI_XML);
    expect(elements).toHaveLength(3);
    const button = findUiElement(elements, 'Criar publicação', { exact: true });
    expect(button).toMatchObject({ contentDesc: 'Criar publicação', clickable: true, center: { x: 540, y: 330 } });
    expect(findUiElement(elements, 'Para você')).toMatchObject({ text: 'Para você' });
    expect(findUiElement(elements, 'inexistente')).toBeNull();
  });
});
