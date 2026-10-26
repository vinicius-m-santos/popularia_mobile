import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createPost } from '@/features/posts/api';
import { NetworkError } from '@/lib/errors';

import CreatePostScreen from '../create-post-screen';

jest.mock('@/features/onboarding/api', () => ({ getTopicGroups: () => Promise.resolve([{ title: 'Cultura e ideias', topics: [{ id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' }] }]) }));
jest.mock('@/constants/config', () => ({ DEMO_MODE: false, USE_MOCKS: true }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), dismissTo: jest.fn(), push: jest.fn() },
  usePreventRemove: () => jest.fn(),
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
  useInteractions: () => ({ membershipOf: () => undefined, notifyPostCreated: jest.fn() }),
}));
jest.mock('@/features/comunas/api', () => ({ getMyComunas: () => Promise.resolve([]) }));
jest.mock('@/features/posts/api', () => ({ createPost: jest.fn() }));
jest.mock('@/features/posts/components/post-card', () => ({ PostCard: () => null }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

beforeEach(() => { jest.clearAllMocks(); });

describe('criação de publicação', () => {
  it('envia um assunto opcional na publicação de perfil', async () => {
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.press(await screen.findByLabelText('Assunto: Escolher assunto'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tecnologia e ciência' }));
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Linux nas escolas');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).toHaveBeenCalledWith({ comunaServerId: null, text: 'Linux nas escolas', topic: 'tec' });
  });

  it('cancelar volta sem publicar; reabrir começa com rascunho vazio', async () => {
    const view = await render(<CreatePostScreen />);
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(createPost).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Rascunho');
    await view.unmount();
    await render(<CreatePostScreen />);
    expect(screen.getByLabelText('Texto da publicação').props.value).toBe('');
  });

  it('falha conserva o rascunho para retry, e o sucesso navega uma única vez', async () => {
    jest.mocked(createPost).mockRejectedValueOnce(new NetworkError());
    const view = await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Mutirão');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(screen.getByLabelText('Texto da publicação').props.value).toBe('Mutirão');
    expect(router.dismissTo).not.toHaveBeenCalled();
    jest.mocked(createPost).mockResolvedValueOnce({} as Awaited<ReturnType<typeof createPost>>);
    const submit = screen.getByLabelText('Publicar');
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    expect(createPost).toHaveBeenCalledTimes(2);
    expect(router.dismissTo).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    await view.unmount();
  });
});
