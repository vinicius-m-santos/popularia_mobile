/**
 * Cliente HTTP da API: URL base, JSON, tempo limite, conversão de erros e sessão.
 *
 * Sessão: o access token (curto, ~15 min) fica só na memória; o refresh token fica no
 * armazenamento seguro (token-store.ts). Quando a API responde 401, o cliente renova a
 * sessão uma única vez (mesmo com várias chamadas ao mesmo tempo) e repete a chamada.
 * Se a renovação for recusada, os tokens são apagados e `onSessionEnded` avisa o app.
 * Tokens nunca vão para logs: os erros carregam só status, `type` e o texto da API.
 */
import { API_BASE_URL, API_TIMEOUT_MS } from '@/constants/config';
import { ApiError, NetworkError } from '@/lib/errors';

import { deleteRefreshToken, readRefreshToken, saveRefreshToken } from './token-store';

/** Resposta de login e de renovação (POST /auth/login, /auth/refresh). */
export type TokensDto = {
  tokenType: 'Bearer';
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
  sessionId: string;
};

export type RequestOptions = {
  transfer?: (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<Response>;
  signal?: AbortSignal;
  timeoutMs?: number;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Envia o access token (e renova a sessão se ele tiver vencido). */
  auth?: boolean;
  /** PATCH usa application/merge-patch+json. */
  contentType?: string;
};

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let refreshing: { generation: number; promise: Promise<string | null> } | null = null;
/** Muda a cada login/logout: uma renovação iniciada antes não pode ressuscitar a sessão encerrada. */
let sessionGeneration = 0;
let sessionEndedListener: (() => void) | null = null;

/** Chamado quando a sessão termina sem a pessoa pedir (refresh recusado, conta suspensa). */
export function onSessionEnded(listener: (() => void) | null): void {
  sessionEndedListener = listener;
}

export async function startSession(tokens: TokensDto): Promise<void> {
  sessionGeneration += 1;
  storeTokens(tokens);
  await saveRefreshToken(tokens.refreshToken);
}

function storeTokens(tokens: TokensDto): void {
  accessToken = tokens.accessToken;
  // Renova 30 s antes de vencer, para não mandar um token no limite.
  accessTokenExpiresAt = Date.now() + (tokens.accessTokenExpiresIn - 30) * 1000;
}

/** Apaga os tokens deste aparelho (memória e armazenamento seguro). */
export async function clearSession(): Promise<void> {
  sessionGeneration += 1;
  accessToken = null;
  accessTokenExpiresAt = 0;
  await deleteRefreshToken();
}

export async function hasStoredSession(): Promise<boolean> {
  return (await readRefreshToken()) !== null;
}

/**
 * Renova a sessão com o refresh token guardado. Retorna o novo access token, ou null
 * se não houver sessão válida. Erros de rede são repassados (a sessão continua guardada).
 */
export function refreshSession(): Promise<string | null> {
  // Uma renovação só é compartilhada dentro da mesma sessão.
  if (refreshing && refreshing.generation === sessionGeneration) return refreshing.promise;
  const generation = sessionGeneration;
  const promise = (async () => {
    try {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) return null;
      const response = await send('/auth/refresh', { method: 'POST', body: { refreshToken } }, null);
      // A pessoa saiu (ou entrou em outra conta) enquanto renovávamos: descarta a resposta.
      if (generation !== sessionGeneration) return null;
      if (response.status === 401 || response.status === 403) {
        await clearSession();
        sessionEndedListener?.();
        return null;
      }
      const tokens = await parse<TokensDto>(response);
      if (generation !== sessionGeneration) return null;
      storeTokens(tokens);
      await saveRefreshToken(tokens.refreshToken);
      return tokens.accessToken;
    } finally {
      // Só limpa se ainda for a renovação desta sessão (outra pode ter começado depois de um novo login).
      if (refreshing?.generation === generation) refreshing = null;
    }
  })();
  refreshing = { generation, promise };
  return promise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return parse<T>(await apiResponse(path, options));
}

/** Transporte binário/multipart com a mesma sessão e refresh das chamadas JSON. */
export async function apiResponse(path: string, options: RequestOptions = {}): Promise<Response> {
  if (!API_BASE_URL) throw new Error('EXPO_PUBLIC_API_URL não está configurada.');
  if (!options.auth) {
    const response = await send(path, options, null);
    if (!response.ok) throw await toError(response);
    return response;
  }

  let token = accessToken && Date.now() < accessTokenExpiresAt ? accessToken : await refreshSession();
  if (!token) throw new ApiError(401, '/errors/unauthorized', 'Sua sessão terminou. Entre novamente.');

  let response = await send(path, options, token);
  if (response.status === 401) {
    token = await refreshSession();
    if (!token) throw new ApiError(401, '/errors/unauthorized', 'Sua sessão terminou. Entre novamente.');
    response = await send(path, options, token);
  }
  if (response.status === 403) {
    const error = await toError(response);
    // Conta suspensa: encerra a sessão local também.
    if (error.type === '/errors/account-inactive') {
      await clearSession();
      sessionEndedListener?.();
    }
    throw error;
  }
  if (!response.ok) throw await toError(response);
  return response;
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = options.contentType ?? 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? API_TIMEOUT_MS);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  try {
    if (options.transfer) return await options.transfer(`${API_BASE_URL}${path}`, headers, controller.signal);
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

type ProblemBody = {
  type?: string;
  title?: string;
  violations?: { propertyPath: string; message: string }[];
};

async function toError(response: Response): Promise<ApiError> {
  let body: ProblemBody = {};
  try {
    body = (await response.json()) as ProblemBody;
  } catch {
    // Corpo vazio ou não-JSON: fica só o status.
  }
  const violations: Record<string, string> = {};
  for (const v of body.violations ?? []) violations[v.propertyPath] ??= v.message;
  const retryAfter = Number(response.headers.get('Retry-After')) || null;
  // Em erros de validação o título do API Platform é genérico: usamos a primeira mensagem de campo.
  const title = body.violations?.[0]?.message ?? body.title ?? 'Algo deu errado. Tente de novo.';
  return new ApiError(response.status, body.type ?? `/errors/${response.status}`, title, violations, retryAfter);
}
