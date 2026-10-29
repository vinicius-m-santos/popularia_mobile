import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getDocument } from '@/features/library/api';
import { returnAttachment } from '@/features/library/composer-attachment';
import { document } from '@/features/library/testing/fixtures';
import { createPost } from '@/features/posts/api';
import { pickPostImage, uploadPostMedia } from '@/features/posts/post-media';
import { NetworkError } from '@/lib/errors';

import CreatePostScreen from '../create-post-screen';

const mockParams: { documentId?: string } = {};
jest.mock('@/features/library/api', () => ({ getDocument: jest.fn(), listDocuments: jest.fn(), listCollections: jest.fn() }));
jest.mock('@/features/onboarding/api', () => ({ getTopicGroups: () => Promise.resolve([{ title: 'Cultura e ideias', topics: [{ id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' }] }]) }));
jest.mock('@/constants/config', () => ({ DEMO_MODE: false, USE_MOCKS: true }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), dismissTo: jest.fn(), push: jest.fn() },
  usePreventRemove: () => jest.fn(),
  useLocalSearchParams: () => mockParams,
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
jest.mock('@/features/posts/components/post-attachment', () => ({ PostAttachment: () => null }));
jest.mock('@/features/posts/post-media', () => ({
  durationLabel: (value: number | null) => value ? '0:15' : '',
  pickPostImage: jest.fn(), pickPostVideo: jest.fn(), uploadPostMedia: jest.fn(),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

beforeEach(() => { jest.clearAllMocks(); delete mockParams.documentId; });

describe('criação de publicação', () => {
  it('remove redundâncias e informa os limites das mídias', async () => {
    await render(<CreatePostScreen />);
    expect(screen.queryByText('Link')).toBeNull();
    expect(screen.getAllByText('Imagem')).toHaveLength(1);
    expect(screen.getByText('Até 100 MB · 30 s')).toBeTruthy();
  });

  it('publica somente imagem, enviando bytes uma vez e referenciando mediaId', async () => {
    jest.mocked(pickPostImage).mockResolvedValue({ clientId: 'client', kind: 'image', uri: 'file:///image.jpg', name: 'imagem.jpg', mimeType: 'image/jpeg', size: 100, width: 800, height: 600, durationMs: null });
    jest.mocked(uploadPostMedia).mockResolvedValue({ id: 'media-1', type: 'image', mimeType: 'image/jpeg', byteSize: 100, width: 800, height: 600, durationMs: null, url: null });
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.press(screen.getByText('Imagem'));
    expect(screen.getByText('Imagem anexada')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(uploadPostMedia).toHaveBeenCalledTimes(1);
    expect(createPost).toHaveBeenCalledWith({ comunaServerId: null, text: '', mediaId: 'media-1' });
  });

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


describe('PDF no composer', () => {
  it('referencia documento existente e alerta sem mudar permissão', async () => {
    mockParams.documentId = document.id;
    jest.mocked(getDocument).mockResolvedValue(document);
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await screen.findByText('Só você pode abrir este PDF.');
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Por que este documento importa');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).toHaveBeenCalledWith({ comunaServerId: null, text: 'Por que este documento importa', documentId: document.id });
    expect(getDocument).toHaveBeenCalledTimes(1);
  });
  it('enviar PDF novo retorna ao mesmo rascunho sem upload no publish', async () => {
    await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Rascunho preservado');
    await fireEvent.press(screen.getByText('PDF'));
    await fireEvent.press(screen.getByText('Enviar novo PDF'));
    const call = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as { params: { composerKey: string } };
    await act(async () => returnAttachment(call.params.composerKey, document));
    expect(screen.getByLabelText('Texto da publicação').props.value).toBe('Rascunho preservado');
    expect(screen.getByText('Só você pode abrir este PDF.')).toBeTruthy();
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).toHaveBeenCalledWith({ comunaServerId: null, text: 'Rascunho preservado', documentId: document.id });
  });
});

describe('enquete no compositor', () => {
  it('não publica enquete incompleta ou com opções repetidas, e publica a válida', async () => {
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Enquete' }));
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Pergunta'), 'Qual livro vamos ler?');
    await fireEvent.changeText(screen.getByLabelText('Opção 1'), 'O cortiço');
    await fireEvent.changeText(screen.getByLabelText('Opção 2'), 'O cortiço');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Opção 2'), 'Capitães da Areia');
    await fireEvent.press(screen.getByLabelText('Adicionar opção'));
    await fireEvent.changeText(screen.getByLabelText('Opção 3'), 'Memórias póstumas');
    await fireEvent.press(screen.getByLabelText('Remover opção 3'));
    expect(screen.queryByLabelText('Opção 3')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).toHaveBeenCalledWith({
      comunaServerId: null,
      text: '',
      poll: { question: 'Qual livro vamos ler?', options: [{ label: 'O cortiço' }, { label: 'Capitães da Areia' }] },
    });
  });
});
