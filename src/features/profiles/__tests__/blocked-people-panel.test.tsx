import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { apiRequest } from '@/lib/api/client';

import { BlockedPeoplePanel } from '../blocked-people-panel';

const mockSetOn = jest.fn();
const mockReload = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('@/hooks/use-async-data', () => ({
  useAsyncData: () => ({
    status: 'success',
    data: [{ handle: 'julia', displayName: 'Júlia Wauters' }],
    reload: mockReload,
  }),
}));
jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({ setOn: mockSetOn }),
}));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn(async () => undefined) }));
jest.mock('@/lib/query/client', () => ({
  queryClient: { invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args) },
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/components/avatar', () => ({ Avatar: () => null }));

describe('pessoas bloqueadas', () => {
  it('ao desbloquear, libera o filtro local e invalida o feed', async () => {
    await render(<BlockedPeoplePanel />);

    await fireEvent.press(screen.getByLabelText('Desbloquear @julia'));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/me/blocks/julia', { auth: true, method: 'DELETE' }));
    expect(mockSetOn).toHaveBeenCalledWith('mutedUsers', ['julia'], false);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['feed'] });
    expect(mockReload).toHaveBeenCalled();
  });
});
