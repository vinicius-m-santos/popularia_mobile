/**
 * Cenários reproduzíveis do POP-72, alinhados à matriz do POP-64.
 *
 * As coordenadas são normalizadas (0..1) e convertidas pela resolução do
 * aparelho. O runner trata `measure: 'launch'` (abertura fria/quente) de forma
 * diferente dos cenários de interação: neles o launch é preparação e o gfxinfo
 * é zerado depois que a tela assentou.
 */

export const DEFAULT_SCENARIO_IDS = ['cold-start', 'warm-start', 'feed', 'swipe', 'composer', 'pagination', 'video'];

const swipeUp = (repeat = 6, durationMs = 260, pauseMs = 650) => ({
  type: 'swipe',
  from: { x: 0.5, y: 0.82 },
  to: { x: 0.5, y: 0.22 },
  durationMs,
  repeat,
  pauseMs,
});

export const SCENARIOS = {
  'cold-start': {
    id: 'cold-start',
    title: 'Abertura fria',
    description: 'Processo encerrado, abertura pelo launcher/deep link e espera pela primeira tela.',
    measure: 'launch',
    forceStop: true,
    resetSession: false,
    launch: 'deepLink',
    deepLink: 'populariamobile://',
    waitMs: 4_000,
    waitForLabel: 'Para você',
    captureSnapshot: true,
  },
  'warm-start': {
    id: 'warm-start',
    title: 'Abertura quente',
    description: 'App já em memória vai para segundo plano e volta pelo launcher/deep link.',
    measure: 'launch',
    goHome: true,
    resetSession: true,
    resetNext: '/',
    launch: 'deepLink',
    deepLink: 'populariamobile://',
    waitMs: 2_500,
    waitForLabel: 'Para você',
    captureSnapshot: true,
  },
  feed: {
    id: 'feed',
    title: 'Feed',
    description: 'Feed principal com rolagem vertical de seis gestos.',
    measure: 'interaction',
    resetSession: true,
    resetNext: '/',
    launch: 'deepLink',
    deepLink: 'populariamobile://',
    waitMs: 2_500,
    launchAfterReset: false,
    waitForLabel: 'Para você',
    steps: [swipeUp(6)],
    captureSnapshot: true,
  },
  swipe: {
    id: 'swipe',
    title: 'Swipe entre abas do feed',
    description: 'Gestos horizontais alternados entre as abas do feed.',
    measure: 'interaction',
    resetSession: true,
    resetNext: '/',
    launch: 'deepLink',
    deepLink: 'populariamobile://',
    waitMs: 2_500,
    launchAfterReset: false,
    waitForLabel: 'Para você',
    steps: [{
      type: 'swipe',
      from: { x: 0.82, y: 0.45 },
      to: { x: 0.18, y: 0.45 },
      durationMs: 280,
      repeat: 6,
      pauseMs: 1_000,
      alternate: true,
    }],
    captureSnapshot: true,
  },
  composer: {
    id: 'composer',
    title: 'Composer',
    description: 'Abrir o composer pelo feed, focar o texto e digitar uma amostra curta.',
    measure: 'interaction',
    resetSession: true,
    resetNext: '/',
    launch: 'deepLink',
    deepLink: 'populariamobile://',
    waitMs: 2_500,
    launchAfterReset: false,
    waitForLabel: 'Criar publicação',
    steps: [
      { type: 'tapLabel', label: 'Criar publicação', timeoutMs: 10_000 },
      { type: 'wait', ms: 1_200 },
      { type: 'tapLabel', label: 'Texto da publicação', timeoutMs: 10_000 },
      { type: 'inputText', text: 'TestePOP72' },
      { type: 'wait', ms: 1_200 },
      { type: 'assertLabel', label: 'Texto da publicação', timeoutMs: 5_000 },
      { type: 'screenshot', name: 'composer' },
      // Fecha teclado e composer; a publicação NÃO é enviada.
      { type: 'keyevent', code: 4 },
      { type: 'keyevent', code: 4 },
    ],
    captureSnapshot: true,
  },
  pagination: {
    id: 'pagination',
    title: 'Paginação',
    description: 'Rolagem longa até carregar páginas adicionais do feed por cursor.',
    measure: 'interaction',
    resetSession: true,
    resetNext: '/',
    launch: 'deepLink',
    deepLink: 'populariamobile://',
    waitMs: 2_500,
    launchAfterReset: false,
    waitForLabel: 'Para você',
    steps: [swipeUp(24, 220, 550)],
    captureSnapshot: true,
  },
  video: {
    id: 'video',
    title: 'Vídeo',
    description: 'Abre uma publicação com vídeo por deep link e espera o primeiro quadro.',
    measure: 'interaction',
    resetSession: true,
    resetNext: '/',
    requireOptions: ['videoPostId'],
    launch: 'deepLink',
    buildDeepLink: (options) => `populariamobile://post/${encodeURIComponent(options.videoPostId)}`,
    waitMs: 5_000,
    steps: [{ type: 'wait', ms: 2_000 }],
    captureSnapshot: true,
  },
};

export function resolveScenarios(requested, options = {}) {
  const ids = requested && requested.length > 0 ? requested : DEFAULT_SCENARIO_IDS;
  return ids.map((id) => {
    const scenario = SCENARIOS[id];
    if (!scenario) {
      throw new Error(`Cenário desconhecido: ${id}. Disponíveis: ${Object.keys(SCENARIOS).join(', ')}`);
    }
    const labels = { videoPostId: '--video-post' };
    const missing = (scenario.requireOptions ?? []).filter((key) => !options[key]);
    if (missing.length > 0) {
      return { ...scenario, skipped: true, skipReason: `faltam opções: ${missing.map((key) => labels[key] ?? `--${key}`).join(', ')}` };
    }
    return { ...scenario, skipped: false, skipReason: null };
  });
}

/** Deep link usado pela ponte JS do app (POP-72). */
export function collectorDeepLink(action, nonce = Date.now().toString(36), options = {}) {
  const base = `populariamobile://diagnostico-performance?collector=${encodeURIComponent(action)}&nonce=${encodeURIComponent(nonce)}`;
  return options.next ? `${base}&next=${encodeURIComponent(options.next)}` : base;
}
