import { describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import { suggestHandle } from '../api';

jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

describe('sugestão de @ no cadastro', () => {
  it('pede ao servidor um nome legível e disponível', async () => {
    jest.mocked(apiRequest).mockResolvedValue({ handle: 'quietotter' });

    await expect(suggestHandle()).resolves.toBe('quietotter');
    expect(apiRequest).toHaveBeenCalledWith('/handles/suggestion');
  });
});
