import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import { queryClient } from '@/lib/query/client';

import {
  GRAVE_CONFIRM,
  comunaReportsKey,
  contentReportPayload,
  invalidateAfterModeration,
  platformReportsKey,
  sendContentReport,
} from '../content-reports';

jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

const request = jest.mocked(apiRequest);

describe('denúncia de conteúdo', () => {
  beforeEach(() => { request.mockReset(); });

  it('envia motivo estruturado e descrição curta, sem HTML inventado', async () => {
    request.mockResolvedValue(undefined as never);
    await sendContentReport({
      targetType: 'post',
      targetId: 'post-1',
      reasonCode: 'threat',
      description: '  Ele ameaçou\r\nna praça  ',
    });
    expect(request).toHaveBeenCalledWith('/reports', {
      auth: true,
      method: 'POST',
      body: {
        targetType: 'post',
        targetId: 'post-1',
        reasonCode: 'threat',
        description: 'Ele ameaçou\nna praça',
      },
    });
  });

  it('omite a descrição quando ela fica vazia e corta o excesso', () => {
    expect(contentReportPayload({ targetType: 'profile', targetId: 'user-1', reasonCode: 'spam', description: '   ' })).toEqual({
      targetType: 'profile',
      targetId: 'user-1',
      reasonCode: 'spam',
    });
    const long = contentReportPayload({ targetType: 'comment', targetId: 'c-1', reasonCode: 'other', description: 'a'.repeat(900) });
    expect(long.description).toHaveLength(800);
  });

  it('pede confirmação explícita só para suspender conta ou comuna', () => {
    expect(GRAVE_CONFIRM.suspend.message).toBe('Ela não poderá usar o Popularia até ser reativada.');
    expect(GRAVE_CONFIRM.suspend_comuna.title).toBe('Suspender esta comuna?');
    expect(GRAVE_CONFIRM.remove).toBeUndefined();
  });

  it('usa chaves de cache da fila, não do aplicativo inteiro', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve());
    invalidateAfterModeration('vila');
    const keys = invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toEqual([
      ['comuna-reports', 'vila'],
      ['platform-reports'],
      ['feed'],
      ['post'],
      ['profile-posts'],
      ['search'],
      ['comuna-pins', 'vila'],
    ]);
    expect(comunaReportsKey('vila', 'open')).toEqual(['comuna-reports', 'vila', 'open']);
    expect(platformReportsKey('closed')).toEqual(['platform-reports', 'closed']);
    invalidate.mockRestore();
  });
});
