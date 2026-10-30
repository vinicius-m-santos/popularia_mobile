import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiError } from '@/lib/errors';

import { apiRequest, clearSession, onSessionEnded, refreshSession, startSession, type TokensDto } from '../client';
import { deleteRefreshToken, readRefreshToken, saveRefreshToken } from '../token-store';

jest.mock('@/constants/config', () => ({
  API_BASE_URL: 'http://api.test/api/v1',
  API_TIMEOUT_MS: 1000,
}));

// Armazenamento seguro simulado na memória.
let mockStored: string | null = null;
jest.mock('../token-store', () => ({
  readRefreshToken: jest.fn(async () => mockStored),
  saveRefreshToken: jest.fn(async (token: string) => {
    mockStored = token;
  }),
  deleteRefreshToken: jest.fn(async () => {
    mockStored = null;
  }),
}));

function tokens(n: number, expiresIn = 900): TokensDto {
  return {
    tokenType: 'Bearer',
    accessToken: `access-${n}`,
    accessTokenExpiresIn: expiresIn,
    refreshToken: `refresh-${n}`,
    refreshTokenExpiresIn: 2592000,
    sessionId: 'session',
  };
}

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const fetchMock = jest.fn<(url: string, init: RequestInit) => Promise<Response>>();

function route(handler: Handler) {
  fetchMock.mockImplementation(async (url, init) => handler(url, init));
}

function authOf(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string>).Authorization;
}

function calls(path: string) {
  return fetchMock.mock.calls.filter(([url]) => url.endsWith(path));
}

beforeEach(async () => {
  mockStored = null;
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  onSessionEnded(null);
  await clearSession();
  jest.mocked(saveRefreshToken).mockClear();
  jest.mocked(readRefreshToken).mockClear();
  jest.mocked(deleteRefreshToken).mockClear();
});

afterEach(() => {
  onSessionEnded(null);
});

describe('apiRequest com auth', () => {
  it('preserva a última identidade quando gravação do Keychain cruza logout e novo login', async () => {
    let finish!: () => void;
    const slowWrite = new Promise<void>((resolve) => { finish = resolve; });
    jest.mocked(saveRefreshToken).mockImplementationOnce(async (token) => {
      await slowWrite;
      mockStored = token;
    });
    const first = startSession(tokens(1));
    await Promise.resolve();
    const logout = clearSession();
    const second = startSession(tokens(2));
    finish();
    await Promise.all([first, logout, second]);
    expect(mockStored).toBe('refresh-2');
  });
  it.each([200, 401, 403])('descarta resposta %i da conta anterior sem repetir ação ou encerrar a conta nova', async (status) => {
    await startSession(tokens(1));
    let answer!: (response: Response) => void;
    route(() => new Promise<Response>((resolve) => { answer = resolve; }));
    const pending = apiRequest('/posts', { auth: true, method: 'POST', body: { body: 'Conta A' } });
    const rejected = expect(pending).rejects.toMatchObject({ type: '/errors/session-changed' });
    await startSession(tokens(2));
    answer(json(status, status === 200 ? { private: 'A' } : { type: '/errors/account-inactive' }));
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockStored).toBe('refresh-2');
  });

  it('descarta JSON que termina de ser lido depois de logout', async () => {
    await startSession(tokens(1));
    let finish!: (body: unknown) => void;
    const response = json(200, {});
    response.json = () => new Promise((resolve) => { finish = resolve; });
    route(() => response);
    const pending = apiRequest('/me', { auth: true });
    const rejected = expect(pending).rejects.toMatchObject({ type: '/errors/session-changed' });
    while (!finish) await Promise.resolve();
    await clearSession();
    finish({ private: 'A' });
    await rejected;
  });
  it('anexa o access token da sessão', async () => {
    await startSession(tokens(1));
    route(() => json(200, { ok: true }));

    await apiRequest('/me', { auth: true });

    expect(authOf(fetchMock.mock.calls[0][1])).toBe('Bearer access-1');
  });

  it('não anexa token em chamadas sem auth', async () => {
    await startSession(tokens(1));
    route(() => json(200, {}));

    await apiRequest('/topics');

    expect(authOf(fetchMock.mock.calls[0][1])).toBeUndefined();
  });

  it('renova uma única vez quando várias chamadas recebem 401 ao mesmo tempo', async () => {
    await startSession(tokens(1));
    route((url, init) => {
      if (url.endsWith('/auth/refresh')) return json(200, tokens(2));
      return authOf(init) === 'Bearer access-2' ? json(200, { ok: true }) : json(401, { type: '/errors/unauthorized' });
    });

    await Promise.all([apiRequest('/feed', { auth: true }), apiRequest('/me', { auth: true }), apiRequest('/comunas', { auth: true })]);

    expect(calls('/auth/refresh')).toHaveLength(1);
    expect(mockStored).toBe('refresh-2');
  });

  it('não entra em loop: se a chamada renovada ainda der 401, desiste', async () => {
    await startSession(tokens(1));
    route((url) => (url.endsWith('/auth/refresh') ? json(200, tokens(2)) : json(401, { type: '/errors/unauthorized' })));

    await expect(apiRequest('/me', { auth: true })).rejects.toBeInstanceOf(ApiError);

    expect(calls('/auth/refresh')).toHaveLength(1);
    expect(calls('/me')).toHaveLength(2);
  });

  it('limpa as credenciais e avisa o app quando a renovação é recusada', async () => {
    await startSession(tokens(1));
    const ended = jest.fn();
    onSessionEnded(ended);
    route((url) =>
      url.endsWith('/auth/refresh')
        ? json(401, { type: '/errors/invalid-refresh-token' })
        : json(401, { type: '/errors/unauthorized' }),
    );

    await expect(apiRequest('/me', { auth: true })).rejects.toMatchObject({ status: 401 });

    expect(mockStored).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('mantém a sessão guardada quando a renovação falha por falta de rede', async () => {
    await startSession(tokens(1, 0)); // access token já vencido: renova antes de chamar
    route(() => {
      throw new TypeError('Network request failed');
    });

    await expect(apiRequest('/me', { auth: true })).rejects.toMatchObject({ name: 'NetworkError' });

    expect(mockStored).toBe('refresh-1');
  });

  it('e-mail não confirmado (403) não encerra a sessão', async () => {
    await startSession(tokens(1));
    const ended = jest.fn();
    onSessionEnded(ended);
    route(() => json(403, { type: '/errors/email-not-verified', title: 'Confirme seu e-mail.' }));

    await expect(apiRequest('/posts', { method: 'POST', body: { body: 'oi' }, auth: true })).rejects.toMatchObject({
      type: '/errors/email-not-verified',
    });

    expect(mockStored).toBe('refresh-1');
    expect(ended).not.toHaveBeenCalled();
  });

  it('conta suspensa (403 account-inactive) encerra a sessão local', async () => {
    await startSession(tokens(1));
    const ended = jest.fn();
    onSessionEnded(ended);
    route(() => json(403, { type: '/errors/account-inactive', title: 'Conta suspensa.' }));

    await expect(apiRequest('/me', { auth: true })).rejects.toBeInstanceOf(ApiError);

    expect(mockStored).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
  });
});

describe('refreshSession', () => {
  it('não ressuscita a sessão se a pessoa sair durante a renovação', async () => {
    await startSession(tokens(1));
    let answer: (r: Response) => void = () => {};
    route((url) => (url.endsWith('/auth/refresh') ? new Promise<Response>((resolve) => (answer = resolve)) : json(204, undefined)));

    const pending = refreshSession();
    await Promise.resolve();
    await clearSession(); // logout enquanto o servidor ainda não respondeu
    answer(json(200, tokens(2)));

    await expect(pending).resolves.toBeNull();
    expect(mockStored).toBeNull();
    await expect(apiRequest('/me', { auth: true })).rejects.toMatchObject({ status: 401 });
  });

  it('sem refresh token guardado, não chama a API', async () => {
    await expect(refreshSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('erros', () => {
  it('usa a primeira mensagem de validação como título e guarda as mensagens por campo', async () => {
    route(() => json(422, { title: 'An error occurred', violations: [{ propertyPath: 'body', message: 'Escreva alguma coisa.' }] }));

    await expect(apiRequest('/x', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 422,
      title: 'Escreva alguma coisa.',
      violations: { body: 'Escreva alguma coisa.' },
    });
  });
});
