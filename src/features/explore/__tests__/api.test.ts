import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import { getDiscoveryData, searchDiscovery } from '../api';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false, USE_MOCKS: true }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));
const api = jest.mocked(apiRequest);
const response = { topics: [{ id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' }], comunas: [], people: [{ id: 'ana', handle: 'ana', displayName: 'Ana', following: false }], posts: [], recentPosts: [], next: { comunas: null, people: 'next-person', posts: null } };

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
  it('não substitui falha do servidor por mocks', async () => {
    api.mockRejectedValue(new Error('offline'));
    await expect(getDiscoveryData('me')).rejects.toThrow('offline');
    await expect(searchDiscovery('me', 'ana', 'people')).rejects.toThrow('offline');
  });
});
