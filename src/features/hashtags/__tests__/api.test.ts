import { describe, expect, it, jest } from '@jest/globals';
import { apiRequest } from '@/lib/api/client';
import { getTopicInfo, listTopicPosts } from '../api';

jest.mock('@/constants/config', () => ({ DEMO_MODE: true, API_BASE_URL: 'https://example.test/api/v1' }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

describe('tópicos no modo demonstração', () => {
  it('deriva a lista dos posts locais e conserva a primeira grafia', async () => {
    const info = await getTopicInfo('hortasurbanas');
    const page = await listTopicPosts('hortasurbanas', null);
    expect(info).toEqual({ slug: 'hortasurbanas', displayName: 'HortasUrbanas' });
    expect(page.items.map((post) => post.id)).toEqual(['horta', 'troca']);
    expect(page.nextCursor).toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
