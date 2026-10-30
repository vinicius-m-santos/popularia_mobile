import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import { settleQueryClient } from '../query-test-utils';

import { queryClient } from '@/lib/query/client';

import { createEvent } from '../api';
import EventFormScreen from '../event-form-screen';

const mockToast = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ slug: 'londrina' }), router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => { const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }; });
jest.mock('@/lib/routes', () => ({ goBack: jest.fn() }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockToast }) }));
jest.mock('../api', () => ({ createEvent: jest.fn(), updateEvent: jest.fn(), getEvent: jest.fn() }));

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

beforeEach(async () => {
  settleQueryClient();
  await queryClient.cancelQueries();
  queryClient.clear();
  jest.clearAllMocks();
});

describe('formulário', () => {
  it('não envia um evento sem título', async () => {
    await render(<EventFormScreen />);
    await fireEvent.press(screen.getByText('Marcar evento'));
    expect(screen.getByText(/título/)).toBeTruthy();
    expect(createEvent).not.toHaveBeenCalled();
  });
});
