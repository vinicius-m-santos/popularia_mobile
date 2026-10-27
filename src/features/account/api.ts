/**
 * Conta e sessão na API real (/api/v1). As telas não chamam fetch: usam o
 * AccountProvider, que usa estas funções. Formatos documentados no OpenAPI do backend
 * (GET /api/v1/docs.jsonopenapi).
 */
import { apiRequest, clearSession, startSession, type TokensDto } from '@/lib/api/client';
import { NetworkError } from '@/lib/errors';
import type { TopicId } from '@/types/models';

/** GET /me: a própria conta. Única resposta da API com e-mail e interesses. */
export type MeDto = {
  isPrivate?: boolean;
  id: string;
  handle: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  bio: string;
  city: string | null;
  interests: TopicId[];
  platformRole: 'user' | 'platform_moderator' | 'admin';
  createdAt: string;
  updatedAt: string;
};

export type RegistrationInput = {
  email: string;
  password: string;
  handle: string;
  displayName: string;
  bio?: string;
  city?: string;
  interests?: TopicId[];
};

export type ProfilePatch = Partial<Pick<MeDto, 'displayName' | 'bio' | 'interests' | 'isPrivate'>> & { city?: string };

/** Sempre 202, exista ou não conta com o e-mail (o servidor não revela). */
export async function register(input: RegistrationInput): Promise<void> {
  await apiRequest('/auth/register', { method: 'POST', body: input });
}

export async function login(email: string, password: string, deviceLabel: string): Promise<void> {
  const tokens = await apiRequest<TokensDto>('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password, deviceLabel },
  });
  await startSession(tokens);
}

/**
 * Encerra a sessão no servidor (esta ou todas) e sempre apaga os tokens do aparelho,
 * mesmo sem conexão: nesse caso o servidor deixa de aceitar o access token em minutos
 * e o refresh token já não existe aqui.
 */
export async function logout(everywhere = false): Promise<void> {
  try {
    await apiRequest(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST', auth: true });
  } catch (error) {
    if (!(error instanceof NetworkError)) throw error;
  } finally {
    await clearSession();
  }
}

export function getMe(): Promise<MeDto> {
  return apiRequest<MeDto>('/me', { auth: true });
}

export function updateMe(patch: ProfilePatch): Promise<MeDto> {
  return apiRequest<MeDto>('/me', { method: 'PATCH', body: patch, auth: true, contentType: 'application/merge-patch+json' });
}

export async function verifyEmail(code: string): Promise<void> {
  await apiRequest('/me/email-verification', { method: 'POST', body: { code }, auth: true });
}

export async function resendVerificationCode(): Promise<void> {
  await apiRequest('/me/email-verification/resend', { method: 'POST', auth: true });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest('/auth/password-reset/request', { method: 'POST', body: { email: email.trim() } });
}

/** Troca a senha com o código do e-mail. O servidor encerra todas as sessões da conta. */
export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  await apiRequest('/auth/password-reset/confirm', { method: 'POST', body: { email: email.trim(), code, newPassword } });
}

export async function isHandleAvailable(handle: string): Promise<boolean> {
  const result = await apiRequest<{ handle: string; available: boolean }>(`/handles/${encodeURIComponent(handle)}/availability`);
  return result.available;
}
