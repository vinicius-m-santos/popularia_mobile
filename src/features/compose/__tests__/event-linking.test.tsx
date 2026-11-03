import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { getMyComunas } from '@/features/comunas/api';
import { listEvents } from '@/features/events/api';
import type { Comuna } from '@/types/models';

import CreatePostScreen from '../create-post-screen';

jest.mock('@/features/comunas/api', () => ({ getMyComunas: jest.fn() }));
jest.mock('@/features/events/api', () => ({ listEvents: jest.fn() }));
jest.mock('@/features/onboarding/api', () => ({ getTopicGroups: () => Promise.resolve([]) }));
jest.mock('@/constants/config', () => ({ DEMO_MODE: false, USE_MOCKS: true }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), dismissTo: jest.fn(), push: jest.fn() },
  usePreventRemove: () => jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/features/account/account-context', () => ({
  useMe: () => ({ id: 'me', name: 'Você', initials: 'VO', tone: 'red' }),
  useAccount: () => ({ account: { emailVerified: true }, reloadAccount: jest.fn() }),
}));
jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({ membershipOf: () => true, notifyPostCreated: jest.fn() }),
}));
jest.mock('@/features/library/api', () => ({ getDocument: jest.fn(), listDocuments: jest.fn(), listCollections: jest.fn() }));
jest.mock('@/features/posts/api', () => ({ createPost: jest.fn() }));
jest.mock('@/features/posts/components/post-card', () => ({ PostCard: () => null }));
jest.mock('@/features/posts/components/post-attachment', () => ({ PostAttachment: () => null }));
jest.mock('@/features/posts/post-media', () => ({
  durationLabel: () => '',
  pickPostImage: jest.fn(), pickPostVideo: jest.fn(), uploadPostMedia: jest.fn(),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

const commune = {
  id: 'londrina', serverId: 'srv-uuid-londrina', name: 'Londrina', handle: 'londrina', initials: 'LO',
  tone: 'red' as const, place: 'Londrina, PR', foundedYear: '2025', description: '', memberCount: 100,
  coverAlt: '', topics: [] as Comuna['topics'], stats: [], rules: [], moderationNote: '', pinned: null,
  moderatorIds: [], founderRole: '', featuredMemberIds: [], status: 'active' as const, viewerIsMember: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getMyComunas).mockResolvedValue([commune]);
  jest.mocked(listEvents).mockResolvedValue({ items: [], nextCursor: null });
});

describe('seletor de anexos', () => {
  it('não oferece o vínculo de evento abaixo do assunto', async () => {
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    expect(screen.queryByText('Evento')).toBeNull();
    expect(screen.queryByText('Foto')).toBeTruthy();
    expect(screen.queryByText('Vídeo')).toBeTruthy();
    expect(screen.queryByText('PDF')).toBeTruthy();
  });

  it('no chamado só aceita capa, sem vídeo nem PDF', async () => {
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Chamado'));
    expect(await screen.findByText('Capa')).toBeTruthy();
    expect(screen.queryByText('Vídeo')).toBeNull();
    expect(screen.queryByText('PDF')).toBeNull();
    expect(screen.getByText('Capa até 10 MB. O chamado não aceita vídeo.')).toBeTruthy();
  });
});
