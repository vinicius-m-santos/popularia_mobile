import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { settleQueryClient } from '../query-test-utils';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';

import { applyAttendance, resetAttendanceSession, setAttendance, writeEvent } from '../rsvp';
import { eventQueryKey, type ComunaEvent } from '../types';

jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

const event: ComunaEvent = {
  id: '019abcde-0000-7000-8000-000000000010',
  title: 'Assembleia', description: '', format: 'in_person', status: 'scheduled', timeZone: 'America/Manaus',
  startsAt: '2026-11-05T19:00:00-04:00', endsAt: null, placeName: 'Sindicato', address: null, onlineUrl: null,
  comuna: { id: 'c', slug: 'londrina', name: 'Londrina', visibility: 'public', status: 'active' },
  organizer: null, goingCount: 32, maybeCount: 8, viewerAttendance: null, canManage: false, canRespond: true, past: false,
  createdAt: '2026-11-01T15:00:00Z', updatedAt: '2026-11-01T15:00:00Z', cancelledAt: null,
};

function saved(status: 'going' | 'maybe' | 'not_going', going: number, maybe: number) {
  return { ...event, viewerAttendance: status, goingCount: going, maybeCount: maybe, organizer: null };
}

afterEach(() => { queryClient.clear(); });

beforeEach(() => {
  settleQueryClient();
  queryClient.clear();
  resetAttendanceSession();
  jest.mocked(apiRequest).mockReset();
});

describe('presença otimista', () => {
  it('atualiza na hora e fica com a contagem do servidor', async () => {
    writeEvent(event);
    jest.mocked(apiRequest).mockResolvedValue(saved('going', 40, 8));
    const pending = setAttendance(event, 'going');
    expect(queryClient.getQueryData<ComunaEvent>(eventQueryKey(event.id))?.goingCount).toBe(33);
    await pending;
    expect(queryClient.getQueryData<ComunaEvent>(eventQueryKey(event.id))?.goingCount).toBe(40);
    expect(apiRequest).toHaveBeenCalledWith(`/events/${event.id}/attendance`, { method: 'PUT', body: { status: 'going' }, auth: true });
  });

  it('ignora o segundo toque enquanto o primeiro não voltou', async () => {
    let release: (value: ComunaEvent) => void = () => {};
    jest.mocked(apiRequest).mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const first = setAttendance(event, 'going');
    expect(await setAttendance({ ...event, goingCount: 33, viewerAttendance: 'going' }, 'maybe')).toBe('ignored');
    expect(apiRequest).toHaveBeenCalledTimes(1);
    release(saved('going', 33, 8));
    await first;
  });

  it('desfaz a contagem quando o servidor recusa', async () => {
    writeEvent(event);
    jest.mocked(apiRequest).mockRejectedValue(new ApiError(500, '/errors/server', 'Falhou'));
    await expect(setAttendance(event, 'maybe')).rejects.toBeInstanceOf(ApiError);
    expect(queryClient.getQueryData(eventQueryKey(event.id))).toMatchObject({ goingCount: 32, maybeCount: 8, viewerAttendance: null });
  });

  it('não mexe na contagem ao sair de não vou', () => {
    expect(applyAttendance({ ...event, viewerAttendance: 'not_going' }, 'going').goingCount).toBe(33);
    expect(applyAttendance(event, 'not_going')).toMatchObject({ goingCount: 32, maybeCount: 8, viewerAttendance: 'not_going' });
  });
});
