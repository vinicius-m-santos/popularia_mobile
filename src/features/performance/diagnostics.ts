import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

import {
  exportPerformanceSnapshot,
  performanceAppEnvironment,
  performanceDiagnosticsAvailable,
  performanceInstrumentationEnabled,
  resetPerformanceSession,
  setPerformanceInstrumentationOverride,
  type PerformanceCommitRecord,
  type PerformanceListRecord,
  type PerformanceRequestRecord,
  type PerformanceScreenSummary,
  type PerformanceSnapshot,
} from '@/lib/performance';

/** Ação primária da tela: liga a instrumentação (se preciso) e começa uma sessão limpa. */
export function startPerformanceMeasurement(): boolean {
  if (!performanceDiagnosticsAvailable()) return false;
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
  return performanceInstrumentationEnabled();
}

/** Zera os contadores sem desligar a instrumentação. */
export function resetPerformanceMeasurement(): boolean {
  if (!performanceDiagnosticsAvailable() || !performanceInstrumentationEnabled()) return false;
  resetPerformanceSession();
  return true;
}

export type PerformanceReportExportResult = 'shared' | 'copied' | 'downloaded';

const REPORT_FILE_NAME = 'popularia-performance-diagnostico.json';

/**
 * Exporta o snapshot local como JSON.
 *
 * Nada é enviado para a rede: no aparelho abre a folha de compartilhamento
 * (`expo-sharing`); no navegador baixa o arquivo. Quando o compartilhamento
 * nativo não está disponível, copia para a área de transferência.
 */
export async function sharePerformanceReport(): Promise<PerformanceReportExportResult> {
  const json = exportPerformanceSnapshot();

  if (Platform.OS === 'web') {
    try {
      downloadJsonOnWeb(json);
      return 'downloaded';
    } catch {
      await Clipboard.setStringAsync(json);
      return 'copied';
    }
  }

  // Módulos carregados só na ação, como no download de PDF do acervo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fileSystem = require('expo-file-system/legacy') as {
    cacheDirectory: string | null;
    writeAsStringAsync: (uri: string, contents: string) => Promise<void>;
  };
  if (!fileSystem.cacheDirectory) {
    await Clipboard.setStringAsync(json);
    return 'copied';
  }

  // Nome fixo: uma exportação substitui a anterior e não acumula arquivos no cache.
  const uri = `${fileSystem.cacheDirectory}${REPORT_FILE_NAME}`;
  await fileSystem.writeAsStringAsync(uri, json);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharing = require('expo-sharing') as {
    isAvailableAsync: () => Promise<boolean>;
    shareAsync: (uri: string, options: { mimeType: string; UTI: string; dialogTitle: string }) => Promise<void>;
  };
  if (await sharing.isAvailableAsync()) {
    await sharing.shareAsync(uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Compartilhar diagnóstico de performance',
    });
    return 'shared';
  }

  await Clipboard.setStringAsync(json);
  return 'copied';
}

function downloadJsonOnWeb(json: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Download indisponível.');
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = REPORT_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type RequestScreenDiagnostics = PerformanceScreenSummary & {
  screen: string;
  retries: number;
  averageMs: number;
};

/** Requests por tela, com retries contadas apenas nas requests concluídas. */
export function requestScreenDiagnostics(snapshot: PerformanceSnapshot): RequestScreenDiagnostics[] {
  const retriesByScreen = new Map<string, number>();
  for (const record of snapshot.requests) {
    const retries = Math.max(0, record.attempts - 1);
    retriesByScreen.set(record.scope.screen, (retriesByScreen.get(record.scope.screen) ?? 0) + retries);
  }
  return Object.entries(snapshot.requestsByScreen)
    .map(([screen, summary]) => ({
      screen,
      ...summary,
      retries: retriesByScreen.get(screen) ?? 0,
      averageMs: summary.count > 0 ? summary.durationMs / summary.count : 0,
    }))
    .sort((a, b) => b.count - a.count || a.screen.localeCompare(b.screen));
}

/** Soma das tentativas extras das requests concluídas (não inclui request em voo). */
export function totalRequestRetries(snapshot: PerformanceSnapshot): number {
  return snapshot.requests.reduce((total, record) => total + Math.max(0, record.attempts - 1), 0);
}

export function recentRequests(snapshot: PerformanceSnapshot, limit = 12): PerformanceRequestRecord[] {
  return snapshot.requests.slice(-limit).reverse();
}

export function recentListLoads(snapshot: PerformanceSnapshot, limit = 12): PerformanceListRecord[] {
  return snapshot.lists.slice(-limit).reverse();
}

export type CommitComponentDiagnostics = {
  component: string;
  instances: number;
  commits: number;
  mountCommits: number;
  updateCommits: number;
  totalActualMs: number;
  maxActualMs: number;
  averageActualMs: number;
};

/** Agrega as instâncias de Profiler por componente, sem esconder as não medidas. */
export function commitComponentDiagnostics(snapshot: PerformanceSnapshot): CommitComponentDiagnostics[] {
  const components = new Map<string, CommitComponentDiagnostics>();
  for (const record of snapshot.commits) {
    const current = components.get(record.component) ?? {
      component: record.component,
      instances: 0,
      commits: 0,
      mountCommits: 0,
      updateCommits: 0,
      totalActualMs: 0,
      maxActualMs: 0,
      averageActualMs: 0,
    };
    current.instances += 1;
    current.commits += record.commits;
    current.mountCommits += record.mountCommits;
    current.updateCommits += record.updateCommits;
    current.totalActualMs += record.totalActualMs;
    current.maxActualMs = Math.max(current.maxActualMs, record.maxActualMs);
    components.set(record.component, current);
  }
  return [...components.values()]
    .map((component) => ({
      ...component,
      averageActualMs: component.commits > 0 ? component.totalActualMs / component.commits : 0,
    }))
    .sort((a, b) => b.commits - a.commits || a.component.localeCompare(b.component));
}

export type VideoTransitionDiagnostics = {
  enterCount: number;
  exitCount: number;
  enterFirstFrameCount: number;
  averageEnterFirstFrameMs: number;
  maxEnterFirstFrameMs: number;
  exitFirstFrameCount: number;
  averageExitFirstFrameMs: number;
  maxExitFirstFrameMs: number;
};

export type VideoDiagnostics = PerformanceSnapshot['video'] & {
  averageFirstFrameMs: number;
  errorCount: number;
  transitions: VideoTransitionDiagnostics;
};

function surfaceFirstFrameTotals(
  events: PerformanceSnapshot['video']['events'],
  surface: 'feed' | 'fullscreen',
): { count: number; totalMs: number; maxMs: number } {
  return events.reduce((totals, event) => {
    if (event.event !== 'surface-first-frame' || event.surface !== surface) return totals;
    const value = event.valueMs ?? 0;
    return {
      count: totals.count + 1,
      totalMs: totals.totalMs + value,
      maxMs: Math.max(totals.maxMs, value),
    };
  }, { count: 0, totalMs: 0, maxMs: 0 });
}

/**
 * Transição feed → tela cheia → feed. A espera é medida até o primeiro quadro
 * da surface de destino; estes números não detectam frame preto (isso exige
 * gravação de tela em 60/120 fps no aparelho).
 */
export function videoTransitionDiagnostics(snapshot: PerformanceSnapshot): VideoTransitionDiagnostics {
  const enterCount = snapshot.video.events.filter((event) => event.event === 'fullscreen-enter').length;
  const exitCount = snapshot.video.events.filter((event) => event.event === 'fullscreen-exit').length;
  const fullscreen = surfaceFirstFrameTotals(snapshot.video.events, 'fullscreen');
  const feed = surfaceFirstFrameTotals(snapshot.video.events, 'feed');
  return {
    enterCount,
    exitCount,
    enterFirstFrameCount: fullscreen.count,
    averageEnterFirstFrameMs: fullscreen.count > 0 ? fullscreen.totalMs / fullscreen.count : 0,
    maxEnterFirstFrameMs: fullscreen.maxMs,
    exitFirstFrameCount: feed.count,
    averageExitFirstFrameMs: feed.count > 0 ? feed.totalMs / feed.count : 0,
    maxExitFirstFrameMs: feed.maxMs,
  };
}

export function videoDiagnostics(snapshot: PerformanceSnapshot): VideoDiagnostics {
  return {
    ...snapshot.video,
    averageFirstFrameMs: snapshot.video.firstFrameCount > 0
      ? snapshot.video.firstFrameTotalMs / snapshot.video.firstFrameCount
      : 0,
    errorCount: snapshot.video.events.filter((event) => event.event === 'error').length,
    transitions: videoTransitionDiagnostics(snapshot),
  };
}

/** Duração curta: abaixo de 1 s em ms; acima, em segundos com duas casas. */
export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value < 1) return `${value.toFixed(2).replace('.', ',')} ms`;
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2).replace('.', ',')} s`;
}

/** Tempo decorrido da sessão, em m:ss ou h:mm:ss. */
export function formatElapsed(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (part: number) => String(part).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function environmentLabel(): string {
  const environment = performanceAppEnvironment();
  if (environment === 'production') return 'Produção';
  if (environment === 'staging') return 'Staging';
  if (environment === 'development') return 'Desenvolvimento';
  return environment;
}

/**
 * Resumo de componentes de commit para exibição. Exportado à parte para manter a
 * tela burra e permitir testar os números sem render.
 */
export type CommitTotals = {
  instances: number;
  commits: number;
  mountCommits: number;
  updateCommits: number;
  totalActualMs: number;
  maxActualMs: number;
};

export function commitTotals(records: PerformanceCommitRecord[]): CommitTotals {
  return records.reduce<CommitTotals>((totals, record) => ({
    instances: totals.instances + 1,
    commits: totals.commits + record.commits,
    mountCommits: totals.mountCommits + record.mountCommits,
    updateCommits: totals.updateCommits + record.updateCommits,
    totalActualMs: totals.totalActualMs + record.totalActualMs,
    maxActualMs: Math.max(totals.maxActualMs, record.maxActualMs),
  }), { instances: 0, commits: 0, mountCommits: 0, updateCommits: 0, totalActualMs: 0, maxActualMs: 0 });
}
