import { defineConfig, devices } from '@playwright/test';

/**
 * Suíte E2E do app web (Expo Router + Metro).
 *
 * A API é interceptada no navegador por `e2e/support/api-mock.ts`: nenhum teste
 * depende do backend local nem de dados semeados. O servidor web sobe em uma porta
 * própria, com `EXPO_PUBLIC_API_URL` apontando para a mesma origem, para que as
 * chamadas sejam same-origin e a interceptação não esbarre em CORS.
 */
const PORT = Number(process.env.E2E_PORT ?? 8099);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;

// Em WSL o Chromium pode depender das libs baixadas em .cache-pw/libs
// (docs/playwright-screenshots.md). Um LD_LIBRARY_PATH já exportado vence; em CI
// e macOS o fallback é inofensivo (caminho inexistente é ignorado pelo loader).
const browserEnv = process.platform === 'linux'
  ? {
      ...(process.env as Record<string, string>),
      LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? `${process.cwd()}/.cache-pw/libs/usr/lib/x86_64-linux-gnu`,
    }
  : undefined;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // O WSL do projeto é limitado: um Chromium por vez, sem paralelismo entre specs.
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: isCI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad'],
      ...(browserEnv ? { env: browserEnv } : {}),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    // A suíte sobe e derruba o próprio Metro. Não reutilize um servidor já aberto:
    // ele pode ter sido iniciado com outra API e a interceptação deixaria de valer.
    command: `npx expo start --web --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      EXPO_PUBLIC_API_URL: `${BASE_URL}/api/v1`,
      EXPO_PUBLIC_LINK_ORIGIN: BASE_URL,
      EXPO_PUBLIC_SENTRY_DSN: '',
      EXPO_NO_TELEMETRY: '1',
      BROWSER: 'none',
      NODE_OPTIONS: '--max-old-space-size=1024',
    },
  },
});
