/**
 * Observabilidade do app: inicialização do Sentry e helpers para capturar erros.
 *
 * Regras de privacidade (ver docs/observability.md):
 * - Nenhum conteúdo da Praça, posts, comentários ou PDFs é enviado.
 * - Usuário identificado apenas por UUID interno (sem e-mail, nome, telefone).
 * - Request body nunca é incluído em breadcrumbs ou eventos.
 * - Tokens e Authorization headers são filtrados automaticamente pelo SDK.
 * - Session Replay está desabilitado.
 * - Performance tracing está desabilitado.
 */
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

import { SENTRY_DSN, SENTRY_ENVIRONMENT } from '@/constants/config';

export function initSentry(): void {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: buildRelease(),

    // Performance: desabilitado para o beta (prioridade é erros, não APM).
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // Session Replay: desabilitado (conteúdo político sensível).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Não enviar PII automaticamente.
    sendDefaultPii: false,

    // Desabilitar em desenvolvimento local.
    enabled: !!SENTRY_DSN && SENTRY_ENVIRONMENT !== 'development',

    // Filtrar breadcrumbs: remover conteúdo de requisições, manter só metadados.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.type === 'http') {
        // Remover query strings que possam conter tokens ou dados sensíveis.
        if (typeof breadcrumb.data?.url === 'string') {
          breadcrumb.data.url = stripSensitiveParams(breadcrumb.data.url);
        }
        // Nunca incluir response body nos breadcrumbs.
        delete breadcrumb.data?.response;
        delete breadcrumb.data?.requestBody;
      }
      // Remover console.log em produção (podem vazar conteúdo).
      if (breadcrumb.type === 'console' && breadcrumb.level === 'log' && SENTRY_ENVIRONMENT !== 'staging') {
        return null;
      }
      return breadcrumb;
    },

    // Filtrar eventos antes de enviar.
    beforeSend(event, hint) {
      // Não enviar erros de rede esperados (dispositivo offline, timeout).
      const error = hint?.originalException;
      if (isExpectedNetworkError(error)) return null;
      return event;
    },
  });
}

/** Define o usuário autenticado no escopo (apenas UUID interno). */
export function setSentryUser(userId: string): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser({ id: userId });
}

/** Limpa o usuário do escopo ao fazer logout. */
export function clearSentryUser(): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

/**
 * Registra a tela/rota atual como contexto de navegação.
 * Chamado pelo hook de navegação para enriquecer breadcrumbs.
 */
export function setSentryRoute(routeName: string): void {
  if (!SENTRY_DSN) return;
  Sentry.addBreadcrumb({
    type: 'navigation',
    category: 'navigation',
    message: routeName,
    level: 'info',
  });
}

/**
 * Captura um erro HTTP suspeito (5xx, parsing inesperado, contrato quebrado).
 * NÃO usar para 401/403/404/422/429 — esses são fluxos esperados.
 */
export function captureApiError(error: unknown, context: {
  path: string;
  method: string;
  status?: number;
  requestId?: string;
}): void {
  if (!SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTag('api_path', sanitizePath(context.path));
    scope.setTag('http_method', context.method);
    if (context.status) scope.setTag('http_status', String(context.status));
    if (context.requestId) scope.setTag('request_id', context.requestId);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
}

function buildRelease(): string {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode ??
    '0';
  return `popularia@${version}+${buildNumber}`;
}

function stripSensitiveParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|key|secret|auth|password|code/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function sanitizePath(path: string): string {
  // Reduz IDs de UUID/numéricos para não criar cardinalidade infinita de tags.
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+\b/g, '/:id');
}

function isExpectedNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name;
  // AbortError: request cancelado pelo usuário ou timeout controlado.
  if (name === 'AbortError') return true;
  // Erros de conectividade (sem internet, DNS).
  if (error.message.includes('Network request failed')) return true;
  return false;
}
