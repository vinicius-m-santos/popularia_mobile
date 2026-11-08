import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Sentry from '@sentry/react-native';

import {
  captureApiError,
  initSentry,
  setSentryRoute,
  setSentryUser,
} from '@/lib/monitoring';

jest.mock('@/constants/config', () => ({
  SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
  SENTRY_ENVIRONMENT: 'production',
}));

const initMock = Sentry.init as unknown as jest.Mock;
const setUserMock = Sentry.setUser as unknown as jest.Mock;
const addBreadcrumbMock = Sentry.addBreadcrumb as unknown as jest.Mock;
const withScopeMock = Sentry.withScope as unknown as jest.Mock;

function sentryOptions() {
  return initMock.mock.calls[0][0] as Record<string, unknown> & {
    beforeBreadcrumb: (breadcrumb: Record<string, unknown>) => Record<string, unknown> | null;
    beforeSend: (event: Record<string, unknown>, hint?: { originalException?: unknown }) => Record<string, unknown> | null;
  };
}

describe('política de privacidade do Sentry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initSentry();
  });

  it('mantém tracing, profiling e replay desligados e não envia PII', () => {
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(sentryOptions()).toMatchObject({
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
      enabled: true,
    });
  });

  it('remove request, extras, breadcrumbs e contexto React antes de enviar', () => {
    const event = {
      user: { id: 'usuario-1', email: 'pessoa@example.com' },
      request: { url: 'https://api.example.com/feed?token=segredo' },
      extra: { rascunho: 'conteúdo privado' },
      breadcrumbs: [{ message: 'conteúdo privado' }],
      contexts: { react: { componentStack: 'stack' }, device: { model: 'QA' } },
      tags: { api_path: '/feed' },
    };

    const sent = sentryOptions().beforeSend(event);

    expect(sent).toEqual({
      user: { id: 'usuario-1', ip_address: '0.0.0.0' },
      contexts: { device: { model: 'QA' } },
      tags: { api_path: '/feed' },
    });
    expect(sent).not.toHaveProperty('request');
    expect(sent).not.toHaveProperty('extra');
    expect(sent).not.toHaveProperty('breadcrumbs');
  });

  it('descarta erros de rede esperados em vez de transformá-los em evento', () => {
    expect(sentryOptions().beforeSend({}, { originalException: new Error('Network request failed') })).toBeNull();
    expect(sentryOptions().beforeSend({}, { originalException: new Error('boom') })).not.toBeNull();
  });

  it('descarta breadcrumbs de HTTP e console; sanitiza navegação', () => {
    const { beforeBreadcrumb } = sentryOptions();

    expect(beforeBreadcrumb({ type: 'http', data: { url: 'https://api.example.com/feed?token=segredo' } })).toBeNull();
    expect(beforeBreadcrumb({ type: 'console', level: 'log', message: 'conteúdo privado' })).toBeNull();
    expect(beforeBreadcrumb({
      type: 'navigation',
      category: 'navigation',
      message: '/post/123e4567-e89b-12d3-a456-426614174000/42',
    })).toMatchObject({ message: '/post/:id/:id' });
  });

  it('identifica a pessoa apenas pelo UUID interno e zera o IP', () => {
    setSentryUser('usuario-1');
    expect(setUserMock).toHaveBeenCalledWith({ id: 'usuario-1', ip_address: '0.0.0.0' });
  });

  it('registra a rota como breadcrumb de navegação', () => {
    setSentryRoute('/perfil');
    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: 'navigation',
      category: 'navigation',
      message: '/perfil',
      level: 'info',
    });
  });

  it('sanitiza o caminho da API antes de usá-lo como tag', () => {
    const setTag = jest.fn();
    const setLevel = jest.fn();
    withScopeMock.mockImplementationOnce((callback: unknown) => {
      (callback as (scope: unknown) => void)({ setTag, setLevel });
    });

    captureApiError(new Error('falha'), {
      path: '/posts/123e4567-e89b-12d3-a456-426614174000/comments/42',
      method: 'GET',
      status: 500,
      requestId: 'req-1',
    });

    expect(setTag).toHaveBeenCalledWith('api_path', '/posts/:id/comments/:id');
    expect(setTag).toHaveBeenCalledWith('request_id', 'req-1');
    expect(setTag).toHaveBeenCalledWith('http_status', '500');
    expect(setLevel).toHaveBeenCalledWith('error');
  });
});
