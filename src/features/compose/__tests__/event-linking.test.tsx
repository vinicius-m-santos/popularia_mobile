import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { getMyComunas } from '@/features/comunas/api';
import { listEvents } from '@/features/events/api';
import { createPost } from '@/features/posts/api';
import { ApiError } from '@/lib/errors';
import type { Comuna } from '@/types/models';

import CreatePostScreen from '../create-post-screen';

// --- mocks ---

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

// --- fixtures ---

const commune = {
  id: 'londrina',
  serverId: 'srv-uuid-londrina',
  name: 'Londrina',
  handle: 'londrina',
  initials: 'LO',
  tone: 'red' as const,
  place: 'Londrina, PR',
  foundedYear: '2025',
  description: '',
  memberCount: 100,
  coverAlt: '',
  topics: [] as Comuna['topics'],
  stats: [],
  rules: [],
  moderationNote: '',
  pinned: null,
  moderatorIds: [],
  founderRole: '',
  featuredMemberIds: [],
  status: 'active' as const,
  viewerIsMember: true,
};

const event1 = {
  id: 'evt-uuid-1',
  title: 'Assembleia da Comuna',
  description: '',
  format: 'in_person' as const,
  status: 'scheduled' as const,
  timeZone: 'America/Sao_Paulo',
  startsAt: '2026-11-12T19:00:00-03:00',
  endsAt: null,
  placeName: 'Sindicato dos Bancários',
  address: null,
  onlineUrl: null,
  comuna: { id: 'c', slug: 'londrina', name: 'Londrina', visibility: 'public', status: 'active' },
  organizer: null,
  goingCount: 5, maybeCount: 2, viewerAttendance: null, canManage: false, canRespond: true, past: false,
  createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z', cancelledAt: null,
};

const event2 = {
  ...event1,
  id: 'evt-uuid-2',
  title: 'Clube do Livro',
  startsAt: '2026-11-16T18:00:00-03:00',
  placeName: 'Biblioteca Central',
};

const cancelledEvent = {
  ...event1,
  id: 'evt-uuid-3',
  title: 'Evento Cancelado',
  status: 'cancelled' as const,
  cancelledAt: '2026-11-10T12:00:00Z',
};

// --- setup ---

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getMyComunas).mockResolvedValue([commune]);
  jest.mocked(listEvents).mockResolvedValue({ items: [event1, event2], nextCursor: null });
});

// --- tests ---

describe('event button visibilidade', () => {
  it('mostra o botão Evento quando o destino é uma comuna', async () => {
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    expect(screen.queryByText('Evento')).toBeTruthy();
  });

  it('não mostra o botão Evento no perfil pessoal', async () => {
    jest.mocked(getMyComunas).mockResolvedValue([]);
    await render(<CreatePostScreen />);
    await act(async () => {});
    expect(screen.queryByText('Evento')).toBeNull();
  });
});

describe('seleção de evento', () => {
  it('abre o seletor ao tocar em Evento, lista apenas eventos scheduled', async () => {
    jest.mocked(listEvents).mockResolvedValue({ items: [event1, event2, cancelledEvent], nextCursor: null });
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Evento'));
    await screen.findByText('Assembleia da Comuna');
    expect(screen.queryByText('Clube do Livro')).toBeTruthy();
    expect(screen.queryByText('Evento Cancelado')).toBeNull();
  });

  it('seleciona um evento e o mostra no compositor', async () => {
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Evento'));
    await screen.findByText('Assembleia da Comuna');
    await fireEvent.press(screen.getByText('Assembleia da Comuna'));
    await screen.findByText('Evento vinculado');
    expect(screen.getByText('Assembleia da Comuna')).toBeTruthy();
  });

  it('remove o evento da publicação', async () => {
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Evento'));
    await screen.findByText('Assembleia da Comuna');
    await fireEvent.press(screen.getByText('Assembleia da Comuna'));
    await screen.findByText('Evento vinculado');
    await fireEvent.press(screen.getByText('Remover evento da publicação'));
    expect(screen.queryByText('Evento vinculado')).toBeNull();
  });

  it('troca de evento ao pressionar Trocar', async () => {
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Evento'));
    await screen.findByText('Assembleia da Comuna');
    await fireEvent.press(screen.getByText('Assembleia da Comuna'));
    await screen.findByText('Evento vinculado');
    await fireEvent.press(screen.getByText('Trocar evento'));
    await screen.findByText('Clube do Livro');
    await fireEvent.press(screen.getByText('Clube do Livro'));
    await screen.findByText('Clube do Livro');
    expect(screen.queryByText('Sindicato dos Bancários')).toBeNull();
  });

  it('estado vazio quando não há eventos', async () => {
    jest.mocked(listEvents).mockResolvedValue({ items: [], nextCursor: null });
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Evento'));
    await screen.findByText('Nenhum evento disponível para vincular.');
  });
});

describe('payload com evento', () => {
  it('inclui eventId ao publicar com evento selecionado', async () => {
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Evento'));
    await screen.findByText('Assembleia da Comuna');
    await fireEvent.press(screen.getByText('Assembleia da Comuna'));
    await screen.findByText('Evento vinculado');
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Nos vemos lá!');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    await waitFor(() => expect(createPost).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-uuid-1', comunaServerId: 'srv-uuid-londrina' }),
    ));
  });

  it('publica sem eventId quando nenhum evento selecionado', async () => {
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Texto simples');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    await waitFor(() => expect(createPost).toHaveBeenCalledWith(
      expect.not.objectContaining({ eventId: expect.anything() }),
    ));
  });

  it('erro de event-link não apaga o texto do composer', async () => {
    jest.mocked(createPost).mockRejectedValueOnce(new ApiError(400, '/errors/event-link', 'Este evento foi cancelado.'));
    await render(<CreatePostScreen />);
    await screen.findByText('c/ Londrina');
    await fireEvent.press(screen.getByText('Evento'));
    await screen.findByText('Assembleia da Comuna');
    await fireEvent.press(screen.getByText('Assembleia da Comuna'));
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Texto preservado');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Texto da publicação').props.value).toBe('Texto preservado');
  });
});
