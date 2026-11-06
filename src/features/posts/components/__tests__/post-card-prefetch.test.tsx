/**
 * POP-40: o toque inicial aquece publicação, perfil e comuna; o toque final só
 * navega. Assim um toque cancelado/long press não repete o prefetch e a tela
 * de destino encontra o cache da mesma chave.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FeedItem, User } from '@/types/models';

import { PostCard } from '../post-card';

const mockOpenPost = jest.fn();
const mockOpenProfile = jest.fn();
const mockOpenComuna = jest.fn();
const mockPreparePost = jest.fn((_item: FeedItem) => undefined);
const mockPrepareProfile = jest.fn((_user: User, _isSelf?: boolean) => undefined);
const mockPrepareComuna = jest.fn((_input: unknown) => undefined);

jest.mock('@/features/posts/queries', () => ({ preparePost: (item: FeedItem) => mockPreparePost(item) }));
jest.mock('@/features/profiles/queries', () => ({ prepareProfileFromUser: (user: User, isSelf?: boolean) => mockPrepareProfile(user, isSelf) }));
jest.mock('@/features/comunas/queries', () => ({ prepareComuna: (input: unknown) => mockPrepareComuna(input) }));

jest.mock('@/features/interactions/use-post-actions', () => ({
  usePostActions: () => ({
    supportCount: 2,
    supported: false,
    commentCount: 3,
    echoCount: 1,
    echoed: false,
    saved: false,
    toggleSupport: jest.fn(),
    toggleEcho: jest.fn(),
    toggleSave: jest.fn(),
  }),
}));
jest.mock('@/features/interactions/interactions-context', () => ({ useInteractions: () => ({ isOn: () => false }) }));
jest.mock('@/features/moderation/actions-sheet', () => ({ useActionsSheet: () => ({ open: jest.fn() }) }));
jest.mock('@/lib/routes', () => ({
  useNav: () => ({
    openPost: mockOpenPost,
    openProfile: mockOpenProfile,
    openComuna: mockOpenComuna,
    openHashtag: jest.fn(),
    openRelations: jest.fn(),
  }),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

function post(): FeedItem {
  return {
    id: 'post-1',
    authorId: 'taina',
    comunaId: 'hortas',
    createdAt: '2026-11-06T12:00:00Z',
    text: 'Mutirão de sábado na horta.',
    supportCount: 2,
    commentCount: 3,
    echoCount: 1,
    viewer: { isAuthor: true, canComment: true, canDelete: false, saved: false },
    author: { id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red' },
    comuna: { id: 'hortas', name: 'Hortas', status: 'active' },
    event: null,
    topCommentAuthor: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('prefetch do PostCard antes da navegação', () => {
  it('aquece a publicação no pressIn e não repete no press', async () => {
    await render(<PostCard item={post()} />);

    const body = screen.getByHintText('Abre a discussão');
    await fireEvent(body, 'pressIn');
    expect(mockPreparePost).toHaveBeenCalledTimes(1);
    expect(mockPreparePost).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1' }));

    await fireEvent.press(body);
    expect(mockOpenPost).toHaveBeenCalledWith('post-1');
    expect(mockPreparePost).toHaveBeenCalledTimes(1);
  });

  it('aquece o perfil da autoria e a comuna pelos seus alvos de toque', async () => {
    await render(<PostCard item={post()} />);

    await fireEvent(screen.getByLabelText(/Camila Rocha, @camilarocha/), 'pressIn');
    expect(mockPrepareProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'me' }), true);

    await fireEvent(screen.getByLabelText('Comuna Hortas'), 'pressIn');
    expect(mockPrepareComuna).toHaveBeenCalledWith('hortas');
  });
});
