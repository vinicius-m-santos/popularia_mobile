/**
 * Instrumentação local de performance (POP-5).
 *
 * Regras:
 * - Fechada por padrão. Só liga com `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1`
 *   e nunca em produção (`EXPO_PUBLIC_APP_ENV=production`), mesmo se a flag
 *   pública for ligada por engano.
 * - Sem rede, sem upload, sem PII: guarda apenas caminhos de API sem query
 *   string, contadores e durações. Nada é enviado ao Sentry.
 * - Memória limitada: as listas são circulares e a agregação de commits é por
 *   instância montada. `resetPerformanceSession` limpa tudo.
 * - Sem timer, polling ou log por frame: os registros acontecem nos pontos de
 *   medição (Profiler, cliente HTTP, onLoad e eventos do player).
 */

import { Platform } from 'react-native';

export type PerformanceAction = 'initial' | 'refresh' | 'pagination' | 'user' | 'session' | 'other';
export type PerformanceScope = { screen: string; action: PerformanceAction };
export type RequestOutcome = 'success' | 'error' | 'aborted';
export type ProfilePhase = 'mount' | 'update' | 'nested-update';

export type PerformanceRequestRecord = {
  id: string;
  path: string;
  method: string;
  scope: PerformanceScope;
  attempts: number;
  attemptDurationsMs: number[];
  durationMs: number;
  status: number | null;
  outcome: RequestOutcome;
};

export type PerformanceCommitRecord = {
  component: string;
  instanceId: string;
  commits: number;
  mountCommits: number;
  updateCommits: number;
  totalActualMs: number;
  maxActualMs: number;
  lastActualMs: number;
  totalBaseMs: number;
};

export type PerformanceListRecord = {
  list: string;
  elapsedTimeInMs: number;
  itemCount: number;
  atMs: number;
};

export type VideoSurface = 'feed' | 'fullscreen';

export type PerformanceVideoEvent =
  | 'mount'
  | 'unmount'
  | 'play'
  | 'pause'
  | 'first-frame'
  | 'fullscreen-enter'
  | 'fullscreen-exit'
  /** Primeiro quadro de uma surface recém-montada; `valueMs` é a espera. */
  | 'surface-first-frame'
  | 'error';

export type PerformanceVideoRecord = {
  event: PerformanceVideoEvent;
  mediaId: string;
  valueMs?: number;
  surface?: VideoSurface;
  atMs: number;
};

export type ImageCacheType = 'none' | 'disk' | 'memory';

export type PerformancePhotoEvent = 'open' | 'load' | 'display' | 'error';

/**
 * Marcas da foto em tela cheia (POP-24).
 *
 * `elapsedMs` vai da abertura do visualizador até `onLoad`/`onDisplay`; não é
 * um timer de decodificação nativa. `estimatedBytes` é a estimativa de bitmap
 * ARGB (`width * height * 4`), não uma leitura de memória do aparelho.
 */
export type PerformancePhotoRecord = {
  event: PerformancePhotoEvent;
  mediaId: string;
  elapsedMs?: number;
  width?: number;
  height?: number;
  cacheType?: ImageCacheType;
  estimatedBytes?: number;
  atMs: number;
};

export type PerformancePhotoStats = {
  events: PerformancePhotoRecord[];
  openCount: number;
  loadCount: number;
  displayCount: number;
  errorCount: number;
  loadTotalMs: number;
  loadMaxMs: number;
  displayTotalMs: number;
  displayMaxMs: number;
  memoryCacheHits: number;
  diskCacheHits: number;
  networkLoads: number;
  largestDecodedBytes: number;
};

export type PerformanceScreenSummary = {
  count: number;
  errors: number;
  aborted: number;
  refreshCount: number;
  durationMs: number;
};

/**
 * Estado do cache de pôsteres de vídeo (POP-22). É um retrato do processo, não
 * da sessão de medição: o cache continua existindo quando uma sessão é zerada.
 * Não é estimativa de memória; `size` é o número de miniaturas retidas.
 */
export type PerformancePosterCacheStats = {
  capacity: number;
  size: number;
  retained: number;
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  generationRequests: number;
  generationFailures: number;
  dedupedGenerations: number;
  discardedGenerations: number;
  clears: number;
};

export type PerformanceSnapshot = {
  enabled: boolean;
  sessionId: string | null;
  startedAt: string | null;
  durationMs: number;
  platform: string;
  appEnvironment: string;
  development: boolean;
  requests: PerformanceRequestRecord[];
  requestsByScreen: Record<string, PerformanceScreenSummary>;
  commits: PerformanceCommitRecord[];
  lists: PerformanceListRecord[];
  video: {
    events: PerformanceVideoRecord[];
    mountedNow: number;
    playingNow: number;
    firstFrameCount: number;
    firstFrameTotalMs: number;
    firstFrameMaxMs: number;
  };
  photos: PerformancePhotoStats;
  posters: PerformancePosterCacheStats;
  counters: {
    logicalRequests: number;
    httpAttempts: number;
    profilerCommits: number;
    listLoads: number;
    videoMounts: number;
  };
  dropped: number;
};

export type RequestTrace = {
  id: string;
  path: string;
  method: string;
  scope: PerformanceScope;
  startedAt: number;
  attempts: number;
  attemptDurationsMs: number[];
  lastOutcome: RequestOutcome;
  lastStatus: number | null;
};

const MAX_REQUEST_RECORDS = 400;
const MAX_COMMIT_INSTANCES = 400;
const MAX_LIST_RECORDS = 100;
const MAX_VIDEO_RECORDS = 300;
const MAX_PHOTO_RECORDS = 200;
const MAX_ATTEMPT_DURATIONS = 10;

const DEFAULT_SCOPE: PerformanceScope = { screen: 'unknown', action: 'other' };

type SessionState = {
  id: string;
  startedAt: string;
  startedMonotonic: number;
  requests: PerformanceRequestRecord[];
  httpAttempts: number;
  commits: Map<string, PerformanceCommitRecord>;
  lists: PerformanceListRecord[];
  video: PerformanceVideoRecord[];
  videoMounted: Set<string>;
  videoPlaying: Set<string>;
  photos: PerformancePhotoRecord[];
  photoOpenCount: number;
  photoLoadCount: number;
  photoDisplayCount: number;
  photoErrorCount: number;
  photoLoadTotalMs: number;
  photoLoadMaxMs: number;
  photoDisplayTotalMs: number;
  photoDisplayMaxMs: number;
  photoMemoryCacheHits: number;
  photoDiskCacheHits: number;
  photoNetworkLoads: number;
  photoLargestDecodedBytes: number;
  firstFrameTotalMs: number;
  firstFrameMaxMs: number;
  firstFrameCount: number;
  listLoads: number;
  videoMounts: number;
  dropped: number;
};

const EMPTY_POSTER_CACHE_STATS: PerformancePosterCacheStats = {
  capacity: 0,
  size: 0,
  retained: 0,
  hits: 0,
  misses: 0,
  stores: 0,
  evictions: 0,
  generationRequests: 0,
  generationFailures: 0,
  dedupedGenerations: 0,
  discardedGenerations: 0,
  clears: 0,
};

let session: SessionState | null = null;
let sessionCounter = 0;
let requestCounter = 0;
let enabledOverride: boolean | null = null;
let currentScope: PerformanceScope | null = null;
let posterCacheStatsProvider: (() => PerformancePosterCacheStats) | null = null;

/** `performance.now()` quando existe; Date.now() como fallback (Jest/Node antigo). */
export function performanceNow(): number {
  const perf = typeof globalThis === 'undefined' ? undefined : globalThis.performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

export function performanceAppEnvironment(): string {
  return process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
}

/**
 * O cache de pôsteres registra a própria leitura aqui para aparecer no
 * snapshot/JSON sem criar dependência de `lib/performance` para a feature.
 */
export function registerPosterCacheStatsProvider(provider: (() => PerformancePosterCacheStats) | null): void {
  posterCacheStatsProvider = provider;
}

export function performanceInstrumentationEnabled(): boolean {
  // Produção nunca instrumenta, nem com a flag pública ligada por engano.
  if (performanceAppEnvironment() === 'production') return false;
  if (enabledOverride !== null) return enabledOverride;
  return process.env.EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION === '1';
}

/**
 * Tela de diagnóstico (POP-5): existe só em desenvolvimento e staging.
 *
 * Não basta olhar para `EXPO_PUBLIC_APP_ENV` porque um build de release sem a
 * variável cairia no default `development`. Por isso, fora do staging, exige
 * `__DEV__`. Produção é recusada antes de qualquer outra condição.
 */
export function performanceDiagnosticsAvailable(): boolean {
  const environment = performanceAppEnvironment();
  if (environment === 'production') return false;
  if (environment === 'staging') return true;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

/** Só para testes e para o harness de QA. Em produção continua bloqueado. */
export function setPerformanceInstrumentationOverride(value: boolean | null): void {
  enabledOverride = value;
  if (!performanceInstrumentationEnabled()) {
    session = null;
    return;
  }
  ensureSession();
}

function ensureSession(): SessionState | null {
  if (!performanceInstrumentationEnabled()) return null;
  if (!session) session = newSession();
  return session;
}

function newSession(): SessionState {
  sessionCounter += 1;
  return {
    id: `perf-${sessionCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    startedMonotonic: performanceNow(),
    requests: [],
    httpAttempts: 0,
    commits: new Map(),
    lists: [],
    video: [],
    videoMounted: new Set(),
    videoPlaying: new Set(),
    photos: [],
    photoOpenCount: 0,
    photoLoadCount: 0,
    photoDisplayCount: 0,
    photoErrorCount: 0,
    photoLoadTotalMs: 0,
    photoLoadMaxMs: 0,
    photoDisplayTotalMs: 0,
    photoDisplayMaxMs: 0,
    photoMemoryCacheHits: 0,
    photoDiskCacheHits: 0,
    photoNetworkLoads: 0,
    photoLargestDecodedBytes: 0,
    firstFrameTotalMs: 0,
    firstFrameMaxMs: 0,
    firstFrameCount: 0,
    listLoads: 0,
    videoMounts: 0,
    dropped: 0,
  };
}

function pushBounded<T>(items: T[], item: T, limit: number, state: SessionState): void {
  if (items.length >= limit) {
    items.shift();
    state.dropped += 1;
  }
  items.push(item);
}

/** Reinicia a coleta (ex.: entre duas repetições do mesmo cenário). */
export function resetPerformanceSession(): void {
  session = performanceInstrumentationEnabled() ? newSession() : null;
  currentScope = null;
  requestCounter = 0;
}

/**
 * Executa `fn` capturando o escopo de tela/ação para requests iniciados de forma
 * síncrona ali dentro. O escopo é lido no começo de cada request, não no fim,
 * para que uma navegação durante a espera não atribua a resposta à tela errada.
 */
export function runWithPerformanceScope<T>(scope: PerformanceScope, fn: () => T): T {
  const previous = currentScope;
  currentScope = scope;
  try {
    return fn();
  } finally {
    currentScope = previous;
  }
}

function safePath(path: string): string {
  // Remove query string e fragmento: tokens, cursores e filtros não entram na medição.
  const withoutQuery = path.split('?')[0].split('#')[0];
  return withoutQuery.length > 0 ? withoutQuery.slice(0, 160) : '/unknown';
}

export function createRequestTrace(path: string, method: string, scope?: PerformanceScope): RequestTrace | null {
  if (!performanceInstrumentationEnabled()) return null;
  ensureSession();
  requestCounter += 1;
  return {
    id: `req-${requestCounter.toString(36)}`,
    path: safePath(path),
    method,
    scope: scope ?? currentScope ?? DEFAULT_SCOPE,
    startedAt: performanceNow(),
    attempts: 0,
    attemptDurationsMs: [],
    lastOutcome: 'success',
    lastStatus: null,
  };
}

/** Registra uma tentativa HTTP real (inclui retry de sessão e transfer nativo). */
export function recordRequestAttempt(trace: RequestTrace | null, durationMs: number, outcome: RequestOutcome, status: number | null): void {
  if (!trace || !session) return;
  trace.attempts += 1;
  trace.lastOutcome = outcome;
  trace.lastStatus = status;
  if (trace.attemptDurationsMs.length < MAX_ATTEMPT_DURATIONS) {
    trace.attemptDurationsMs.push(Math.max(0, Math.round(durationMs * 100) / 100));
  }
  session.httpAttempts += 1;
}

export function finishRequest(trace: RequestTrace | null, outcome: RequestOutcome): void {
  // Sem tentativa HTTP não houve request: não inventa um registro para uma
  // renovação que nem chegou a sair por falta de sessão.
  if (!trace || !session || trace.attempts === 0) return;
  const finalOutcome: RequestOutcome = outcome === 'error'
    ? (trace.lastOutcome === 'aborted' ? 'aborted' : 'error')
    : (trace.lastStatus !== null && trace.lastStatus >= 400 ? 'error' : outcome);
  pushBounded(session.requests, {
    id: trace.id,
    path: trace.path,
    method: trace.method,
    scope: { ...trace.scope },
    attempts: Math.max(1, trace.attempts),
    attemptDurationsMs: [...trace.attemptDurationsMs],
    durationMs: Math.max(0, Math.round((performanceNow() - trace.startedAt) * 100) / 100),
    status: trace.lastStatus,
    outcome: finalOutcome,
  }, MAX_REQUEST_RECORDS, session);
}

export function recordProfileCommit(input: {
  component: string;
  instanceId: string;
  phase: ProfilePhase;
  actualDurationMs: number;
  baseDurationMs: number;
}): void {
  if (!session) return;
  const key = `${input.component}#${input.instanceId}`;
  const existing = session.commits.get(key);
  if (!existing) {
    if (session.commits.size >= MAX_COMMIT_INSTANCES) {
      session.dropped += 1;
      return;
    }
    session.commits.set(key, {
      component: input.component,
      instanceId: input.instanceId,
      commits: 0,
      mountCommits: 0,
      updateCommits: 0,
      totalActualMs: 0,
      maxActualMs: 0,
      lastActualMs: 0,
      totalBaseMs: 0,
    });
  }
  const record = session.commits.get(key)!;
  const actual = Math.max(0, Math.round(input.actualDurationMs * 100) / 100);
  record.commits += 1;
  if (input.phase === 'mount') record.mountCommits += 1;
  else record.updateCommits += 1;
  record.totalActualMs += actual;
  record.lastActualMs = actual;
  record.maxActualMs = Math.max(record.maxActualMs, actual);
  record.totalBaseMs += Math.max(0, Math.round(input.baseDurationMs * 100) / 100);
}

/** `FlashList.onLoad`: tempo até desenhar os itens. Não é FPS nem TTI. */
export function recordListLoad(list: string, elapsedTimeInMs: number, itemCount: number): void {
  if (!session) return;
  session.listLoads += 1;
  pushBounded(session.lists, {
    list,
    elapsedTimeInMs: Math.max(0, Math.round(elapsedTimeInMs * 100) / 100),
    itemCount,
    atMs: Math.round(performanceNow() - session.startedMonotonic),
  }, MAX_LIST_RECORDS, session);
}

function recordVideoEvent(event: PerformanceVideoEvent, mediaId: string, valueMs?: number, surface?: VideoSurface): void {
  if (!session) return;
  pushBounded(session.video, {
    event,
    mediaId,
    ...(valueMs === undefined ? {} : { valueMs: Math.max(0, Math.round(valueMs * 100) / 100) }),
    ...(surface === undefined ? {} : { surface }),
    atMs: Math.round(performanceNow() - session.startedMonotonic),
  }, MAX_VIDEO_RECORDS, session);
}

export function recordVideoMount(mediaId: string): void {
  if (!session) return;
  session.videoMounts += 1;
  session.videoMounted.add(mediaId);
  recordVideoEvent('mount', mediaId);
}

export function recordVideoUnmount(mediaId: string): void {
  if (!session) return;
  session.videoMounted.delete(mediaId);
  session.videoPlaying.delete(mediaId);
  recordVideoEvent('unmount', mediaId);
}

export function recordVideoPlay(mediaId: string): void {
  if (!session) return;
  session.videoPlaying.add(mediaId);
  recordVideoEvent('play', mediaId);
}

export function recordVideoPause(mediaId: string): void {
  if (!session) return;
  session.videoPlaying.delete(mediaId);
  recordVideoEvent('pause', mediaId);
}

export function recordVideoFirstFrame(mediaId: string, elapsedMs: number): void {
  if (!session) return;
  session.firstFrameCount += 1;
  session.firstFrameTotalMs += Math.max(0, elapsedMs);
  session.firstFrameMaxMs = Math.max(session.firstFrameMaxMs, elapsedMs);
  recordVideoEvent('first-frame', mediaId, elapsedMs);
}

/**
 * Marca a troca feed ↔ tela cheia. O primeiro quadro da surface de destino é
 * registrado à parte (`recordVideoSurfaceFirstFrame`), porque em Android/iOS a
 * nova surface nativa pode levar alguns frames para receber o quadro.
 */
export function recordVideoFullscreen(mediaId: string, phase: 'enter' | 'exit'): void {
  const event = phase === 'enter' ? 'fullscreen-enter' : 'fullscreen-exit';
  recordVideoEvent(event, mediaId, undefined, phase === 'enter' ? 'fullscreen' : 'feed');
}

/** Espera até o primeiro quadro da surface de destino depois da troca. */
export function recordVideoSurfaceFirstFrame(mediaId: string, surface: VideoSurface, elapsedMs: number): void {
  recordVideoEvent('surface-first-frame', mediaId, elapsedMs, surface);
}

export function recordVideoError(mediaId: string): void {
  recordVideoEvent('error', mediaId);
}

/** Bitmap ARGB de 32 bits: referência para comparar o custo de decodificação, não leitura de memória. */
export function estimateImageBitmapBytes(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  return Math.round(width * height * 4);
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function recordPhotoEvent(event: PerformancePhotoEvent, mediaId: string, details: Omit<PerformancePhotoRecord, 'event' | 'mediaId' | 'atMs'> = {}): void {
  if (!session) return;
  pushBounded(session.photos, {
    event,
    mediaId,
    ...details,
    atMs: Math.round(performanceNow() - session.startedMonotonic),
  }, MAX_PHOTO_RECORDS, session);
}

export function recordPhotoOpen(mediaId: string): void {
  if (!session) return;
  session.photoOpenCount += 1;
  recordPhotoEvent('open', mediaId);
}

export function recordPhotoLoaded(mediaId: string, input: {
  elapsedMs: number;
  width: number;
  height: number;
  cacheType: ImageCacheType;
}): void {
  if (!session) return;
  const elapsedMs = roundMs(input.elapsedMs);
  const estimatedBytes = estimateImageBitmapBytes(input.width, input.height);
  session.photoLoadCount += 1;
  session.photoLoadTotalMs += elapsedMs;
  session.photoLoadMaxMs = Math.max(session.photoLoadMaxMs, elapsedMs);
  if (input.cacheType === 'memory') session.photoMemoryCacheHits += 1;
  else if (input.cacheType === 'disk') session.photoDiskCacheHits += 1;
  else session.photoNetworkLoads += 1;
  session.photoLargestDecodedBytes = Math.max(session.photoLargestDecodedBytes, estimatedBytes);
  recordPhotoEvent('load', mediaId, {
    elapsedMs,
    width: input.width,
    height: input.height,
    cacheType: input.cacheType,
    estimatedBytes,
  });
}

export function recordPhotoDisplayed(mediaId: string, elapsedMs: number): void {
  if (!session) return;
  const rounded = roundMs(elapsedMs);
  session.photoDisplayCount += 1;
  session.photoDisplayTotalMs += rounded;
  session.photoDisplayMaxMs = Math.max(session.photoDisplayMaxMs, rounded);
  recordPhotoEvent('display', mediaId, { elapsedMs: rounded });
}

export function recordPhotoError(mediaId: string): void {
  if (!session) return;
  session.photoErrorCount += 1;
  recordPhotoEvent('error', mediaId);
}

export function getPerformanceSnapshot(): PerformanceSnapshot {
  const requests = session ? session.requests.map((record) => ({ ...record, scope: { ...record.scope }, attemptDurationsMs: [...record.attemptDurationsMs] })) : [];
  const requestsByScreen: Record<string, PerformanceScreenSummary> = {};
  for (const record of requests) {
    const summary = requestsByScreen[record.scope.screen] ??= { count: 0, errors: 0, aborted: 0, refreshCount: 0, durationMs: 0 };
    summary.count += 1;
    summary.durationMs += record.durationMs;
    if (record.outcome === 'error') summary.errors += 1;
    if (record.outcome === 'aborted') summary.aborted += 1;
    if (record.scope.action === 'refresh') summary.refreshCount += 1;
  }
  const commits = session ? [...session.commits.values()].map((record) => ({ ...record })) : [];
  const profilerCommits = commits.reduce((total, record) => total + record.commits, 0);
  const posters = posterCacheStatsProvider?.() ?? EMPTY_POSTER_CACHE_STATS;
  return {
    enabled: performanceInstrumentationEnabled(),
    sessionId: session?.id ?? null,
    startedAt: session?.startedAt ?? null,
    durationMs: session ? Math.max(0, Math.round(performanceNow() - session.startedMonotonic)) : 0,
    platform: Platform.OS,
    appEnvironment: performanceAppEnvironment(),
    development: typeof __DEV__ === 'undefined' ? false : __DEV__,
    requests,
    requestsByScreen,
    commits,
    lists: session ? session.lists.map((record) => ({ ...record })) : [],
    video: {
      events: session ? session.video.map((record) => ({ ...record })) : [],
      mountedNow: session?.videoMounted.size ?? 0,
      playingNow: session?.videoPlaying.size ?? 0,
      firstFrameCount: session?.firstFrameCount ?? 0,
      firstFrameTotalMs: session?.firstFrameTotalMs ?? 0,
      firstFrameMaxMs: session?.firstFrameMaxMs ?? 0,
    },
    photos: {
      events: session ? session.photos.map((record) => ({ ...record })) : [],
      openCount: session?.photoOpenCount ?? 0,
      loadCount: session?.photoLoadCount ?? 0,
      displayCount: session?.photoDisplayCount ?? 0,
      errorCount: session?.photoErrorCount ?? 0,
      loadTotalMs: session?.photoLoadTotalMs ?? 0,
      loadMaxMs: session?.photoLoadMaxMs ?? 0,
      displayTotalMs: session?.photoDisplayTotalMs ?? 0,
      displayMaxMs: session?.photoDisplayMaxMs ?? 0,
      memoryCacheHits: session?.photoMemoryCacheHits ?? 0,
      diskCacheHits: session?.photoDiskCacheHits ?? 0,
      networkLoads: session?.photoNetworkLoads ?? 0,
      largestDecodedBytes: session?.photoLargestDecodedBytes ?? 0,
    },
    posters: { ...posters },
    counters: {
      logicalRequests: requests.length,
      httpAttempts: session?.httpAttempts ?? 0,
      profilerCommits,
      listLoads: session?.listLoads ?? 0,
      videoMounts: session?.videoMounts ?? 0,
    },
    dropped: session?.dropped ?? 0,
  };
}

/** Export local para colar num relatório; não faz upload de nada. */
export function exportPerformanceSnapshot(): string {
  return JSON.stringify(getPerformanceSnapshot(), null, 2);
}
