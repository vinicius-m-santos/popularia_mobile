import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  getPerformanceSnapshot,
  resetPerformanceSession,
  setPerformanceInstrumentationOverride,
} from '@/lib/performance';

import { apiRequest, startSession, type TokensDto } from '../client';

jest.mock('@/constants/config', () => ({
  API_BASE_URL: 'http://api.test/api/v1',
  API_TIMEOUT_MS: 1000,
}));

let mockStored: string | null = null;
jest.mock('../token-store', () => ({
  readRefreshToken: jest.fn(async () => mockStored),
  saveRefreshToken: jest.fn(async (token: string) => { mockStored = token; }),
  deleteRefreshToken: jest.fn(async () => { mockStored = null; }),
}));

function tokens(n: number): TokensDto {
  return {
    tokenType: 'Bearer',
    accessToken: `access-${n}`,
    accessTokenExpiresIn: 900,
    refreshToken: `refresh-${n}`,
    refreshTokenExpiresIn: 2592000,
    sessionId: 'session',
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = jest.fn<(url: string, init: RequestInit) => Promise<Response>>();
const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

beforeEach(async () => {
  mockStored = null;
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
});

describe('instrumentação no cliente HTTP', () => {
  it('conta a request lógica, a tentativa e a tela sem guardar a query string', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));

    await apiRequest('/feed?cursor=cursor-secreto', { performance: { screen: 'feed', action: 'refresh' } });

    const snapshot = getPerformanceSnapshot();
    expect(snapshot.requests).toHaveLength(1);
    expect(snapshot.requests[0]).toMatchObject({ path: '/feed', attempts: 1, status: 200, outcome: 'success' });
    expect(snapshot.requests[0].scope).toEqual({ screen: 'feed', action: 'refresh' });
    expect(snapshot.requestsByScreen.feed).toMatchObject({ count: 1, refreshCount: 1 });
    expect(snapshot.counters.httpAttempts).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain('cursor-secreto');
  });

  it('conta as duas tentativas HTTP depois de renovar a sessão', async () => {
    await startSession(tokens(1));
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/auth/refresh')) return json(200, tokens(2));
      const authorization = (fetchMock.mock.calls.at(-1)?.[1].headers as Record<string, string>).Authorization;
      return authorization === 'Bearer access-2' ? json(200, { ok: true }) : json(401, { type: '/errors/unauthorized' });
    });

    await apiRequest('/posts/1/support', { method: 'PUT', auth: true, performance: { screen: 'feed', action: 'user' } });

    const snapshot = getPerformanceSnapshot();
    const support = snapshot.requests.find((record) => record.path === '/posts/1/support');
    expect(support).toMatchObject({ attempts: 2, status: 200, outcome: 'success' });
    expect(snapshot.requests.some((record) => record.path === '/auth/refresh')).toBe(true);
    expect(snapshot.counters.httpAttempts).toBe(3);
  });

  it('marca como abortada uma request cancelada', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new Error('aborted'));

    await expect(apiRequest('/feed', { signal: controller.signal, performance: { screen: 'feed', action: 'initial' } })).rejects.toBeTruthy();

    expect(getPerformanceSnapshot().requests[0]).toMatchObject({ path: '/feed', outcome: 'aborted' });
  });
});
