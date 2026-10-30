import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import { ApiError, NotFoundError } from '@/lib/errors';

import { getEvent, listAttendees, listEvents } from '../api';

jest.mock('@/constants/config', () => ({
  API_BASE_URL: 'http://api.test/api/v1',
  API_TIMEOUT_MS: 1000,
  DEMO_MODE: false,
  USE_MOCKS: true,
  MOCK_LATENCY_MS: 0,
}));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

const api = jest.mocked(apiRequest);
const id = '019abcde-0000-7000-8000-000000000010';
const eventDto = {
  id, title: 'Assembleia', description: '', format: 'in_person', status: 'scheduled', timeZone: 'America/Manaus',
  startsAt: '2026-11-05T19:00:00-04:00', endsAt: null, placeName: 'Sindicato', address: null, onlineUrl: null,
  comuna: { id: 'c', slug: 'londrina', name: 'Londrina', visibility: 'public', status: 'active' },
  organizer: { id: 'u1', handle: 'dona', displayName: 'Dona Souza', avatarUrl: null },
  goingCount: 1, maybeCount: 0, viewerAttendance: null, canManage: false, canRespond: true, past: false,
  createdAt: '2026-11-01T15:00:00+00:00', updatedAt: '2026-11-01T15:00:00+00:00', cancelledAt: null,
};

beforeEach(() => { api.mockReset(); });

describe('API de eventos', () => {
  it('pede a página seguinte com o cursor composto e o limite', async () => {
    const cursor = '2026-11-05T23:00:00+00:00|019abcde-0000-7000-8000-000000000099';
    api.mockResolvedValue({ items: [], nextCursor: null });
    await listEvents('londrina', 'upcoming', cursor, 20);
    expect(api).toHaveBeenCalledWith(
      `/comunas/londrina/events?when=upcoming&cursor=${encodeURIComponent(cursor)}&limit=20`,
      expect.objectContaining({ auth: true }),
    );
  });

  it('traduz 404 de evento e de presenças para ausência', async () => {
    api.mockRejectedValue(new ApiError(404, '/errors/not-found', 'Ausente'));
    await expect(getEvent(id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listAttendees(id, 'going', null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('mantém o organizador como pessoa', async () => {
    api.mockResolvedValue(eventDto);
    const event = await getEvent(id);
    expect(event.organizer).toMatchObject({ id: 'u1', name: 'Dona Souza', handle: 'dona' });
  });
});
