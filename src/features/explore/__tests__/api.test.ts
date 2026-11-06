import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ComunaEvent } from '@/features/events/types';
import { apiRequest } from '@/lib/api/client';
import { getDiscoveryData, searchDiscovery } from '../api';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, USE_MOCKS: true }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));
const api = jest.mocked(apiRequest);
const response = { topics: [{ id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' }], comunas: [], people: [{ id: 'ana', handle: 'ana', displayName: 'Ana', following: false }], posts: [], recentPosts: [], next: { comunas: null, people: 'next-person', posts: null } };
const event: ComunaEvent = {
  id: 'ev1', title: 'Assembleia', description: 'Pauta do mês', format: 'in_person', status: 'scheduled',
  timeZone: 'America/Manaus', startsAt: '2026-11-05T19:00:00-04:00', endsAt: null, placeName: 'Sindicato', address: null, onlineUrl: null,
  comuna: { id: 'c', slug: 'hortas', name: 'Hortas', visibility: 'public', status: 'active' }, organizer: null,
  goingCount: 2, maybeCount: 0, viewerAttendance: null, canManage: false, canRespond: true, past: false,
  createdAt: '2026-11-01T15:00:00Z', updatedAt: '2026-11-01T15:00:00Z', cancelledAt: null,
};

beforeEach(() => { api.mockReset(); api.mockResolvedValue(response); });

describe('API de descoberta real', () => {
  it('monta a primeira tela com uma chamada autenticada e traz follow em lote', async () => {
    const result = await getDiscoveryData('me');
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/explore', { auth: true });
    expect(result.people[0]).toMatchObject({ id: 'ana', name: 'Ana', viewerFollowing: false });
  });
  it('assunto é um filtro próprio, sem transformá-lo em texto', async () => {
    await getDiscoveryData('me', 'tec');
    expect(api).toHaveBeenLastCalledWith('/explore?topic=tec', { auth: true });
    await searchDiscovery('me', 'Linux & ciência', 'posts', 'tec', 'cursor');
    const [path, options] = api.mock.calls[1];
    const params = new URLSearchParams(String(path).split('?')[1]);
    expect(params.get('q')).toBe('Linux & ciência');
    expect(params.get('topic')).toBe('tec');
    expect(params.get('type')).toBe('posts');
    expect(params.get('cursor')).toBe('cursor');
    expect(options).toEqual({ auth: true });
  });
  it('Tudo não pagina misturando cursores, e o filtro usa só seu cursor', async () => {
    expect((await searchDiscovery('me', 'ana', 'all')).nextCursor).toBeNull();
    expect((await searchDiscovery('me', 'ana', 'people')).nextCursor).toBe('next-person');
  });
  it('Eventos sem termo lista a categoria com cursor próprio', async () => {
    api.mockResolvedValue({ ...response, events: [event], next: { ...response.next, events: 'next-event' } });
    const page = await searchDiscovery('me', '', 'events');
    const [path, options] = api.mock.calls[0];
    const params = new URLSearchParams(String(path).split('?')[1]);
    expect(params.get('q')).toBe('');
    expect(params.get('type')).toBe('events');
    expect(params.get('limit')).toBe('20');
    expect(options).toEqual({ auth: true });
    expect(page.items).toEqual([{ id: 'ev1', kind: 'events', value: event }]);
    expect(page.nextCursor).toBe('next-event');
  });
  it('Eventos preserva o assunto da página de origem', async () => {
    api.mockResolvedValue({ ...response, events: [event], next: { ...response.next, events: null } });
    await searchDiscovery('me', '', 'events', 'tec');
    const params = new URLSearchParams(String(api.mock.calls[0][0]).split('?')[1]);
    expect(params.get('type')).toBe('events');
    expect(params.get('topic')).toBe('tec');
  });
  it('não substitui falha do servidor por mocks', async () => {
    api.mockRejectedValue(new Error('offline'));
    await expect(getDiscoveryData('me')).rejects.toThrow('offline');
    await expect(searchDiscovery('me', 'ana', 'people')).rejects.toThrow('offline');
    await expect(searchDiscovery('me', '', 'events')).rejects.toThrow('offline');
  });
});
