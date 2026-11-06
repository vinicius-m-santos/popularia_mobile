import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { getMyComunas } from '@/features/comunas/api';
import { getDocument } from '@/features/library/api';
import { returnAttachment } from '@/features/library/composer-attachment';
import { document } from '@/features/library/testing/fixtures';
import { createPost } from '@/features/posts/api';
import { pickPostImage, uploadPostMedia } from '@/features/posts/post-media';
import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';
import { NetworkError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';

import CreatePostScreen from '../create-post-screen';

const mockParams: { documentId?: string } = {};
type PreventRemoveEvent = { data: { action: unknown }; repeat: () => void };
let mockPreventRemove: ((event: PreventRemoveEvent) => void) | null = null;
jest.mock('@/features/library/api', () => ({ getDocument: jest.fn(), listDocuments: jest.fn(), listCollections: jest.fn() }));
jest.mock('@/features/onboarding/api', () => ({ getTopicGroups: () => Promise.resolve([{ title: 'Cultura e ideias', topics: [{ id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' }, { id: 'cult', label: 'Cultura popular', shortLabel: 'Cultura' }] }]) }));
jest.mock('@/constants/config', () => ({ DEMO_MODE: false, USE_MOCKS: true }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), dismissTo: jest.fn(), push: jest.fn() },
  usePreventRemove: (enabled: boolean, callback: (event: PreventRemoveEvent) => void) => {
    mockPreventRemove = enabled ? callback : null;
    return () => { mockPreventRemove = null; };
  },
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
jest.mock('@/features/comunas/api', () => ({ getMyComunas: jest.fn() }));
jest.mock('@/features/posts/api', () => ({ createPost: jest.fn() }));
jest.mock('@/features/posts/components/post-card', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PostCard: ({ item }: { item: { title: string | null; text: string } }) =>
      React.createElement(Text, { testID: 'post-card-preview' }, [item.title, item.text].filter(Boolean).join(' · ')),
  };
});
jest.mock('@/features/posts/components/post-attachment', () => ({ PostAttachment: () => null }));
jest.mock('@/features/posts/post-media', () => ({
  durationLabel: (value: number | null) => value ? '0:15' : '',
  pickPostImage: jest.fn(), pickPostVideo: jest.fn(), uploadPostMedia: jest.fn(),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/lib/haptics', () => ({ haptic: jest.fn() }));
// O mock global devolve o TextInput nativo; aqui marcamos o componente oficial da folha
// para garantir que a busca de destinos usa a integração de teclado do bottom sheet.
jest.mock('@/components/bottom-sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('@/components/bottom-sheet')>('@/components/bottom-sheet');
  return {
    ...actual,
    PopulariaBottomSheetTextInput: (props: object) => React.createElement(TextInput, { ...props, testID: 'bottom-sheet-text-input' }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.documentId;
  mockPreventRemove = null;
  jest.mocked(getMyComunas).mockResolvedValue([]);
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  resetPerformanceSession();
  jest.restoreAllMocks();
});

const multiComunas = [
  { id: 'a', serverId: 'srv-a', name: 'Comuna A', handle: 'a', initials: 'CA', tone: 'red', place: '', topics: [], memberCount: 2, visibility: 'public', status: 'active', viewerIsMember: true },
  { id: 'b', serverId: 'srv-b', name: 'Comuna B', handle: 'b', initials: 'CB', tone: 'black', place: '', topics: [], memberCount: 3, visibility: 'public', status: 'active', viewerIsMember: true },
  { id: 'c', serverId: 'srv-c', name: 'Comuna C', handle: 'c', initials: 'CC', tone: 'cream', place: '', topics: [], memberCount: 4, visibility: 'public', status: 'active', viewerIsMember: true },
  { id: 'd', serverId: 'srv-d', name: 'Comuna D', handle: 'd', initials: 'CD', tone: 'red', place: '', topics: [], memberCount: 5, visibility: 'public', status: 'active', viewerIsMember: true },
] as never;

describe('criação de publicação', () => {
  it('remove redundâncias e informa os limites das mídias', async () => {
    await render(<CreatePostScreen />);
    expect(screen.queryByText('Link')).toBeNull();
    expect(screen.getAllByText('Foto')).toHaveLength(1);
    expect(screen.getByText('Vídeo')).toBeTruthy();
    expect(screen.getByText(/100 MB/)).toBeTruthy();
  });

  it('filtra destinos com o campo integrado ao teclado do bottom sheet', async () => {
    jest.mocked(getMyComunas).mockResolvedValue(multiComunas);
    await render(<CreatePostScreen />);
    await fireEvent.press(await screen.findByLabelText(/Publicar em .*Trocar destino/));
    const input = await screen.findByTestId('bottom-sheet-text-input');
    expect(input.props.accessibilityLabel).toBe('Buscar comuna');
    await fireEvent.changeText(input, 'Comuna B');
    expect(screen.queryByLabelText(/^c\/ Comuna A\./)).toBeNull();
    expect(screen.getByLabelText(/^c\/ Comuna B\./)).toBeTruthy();
    expect(screen.getByLabelText(/^Meu perfil\./)).toBeTruthy();
  });

  it('publica uma cópia em cada comuna selecionada', async () => {
    jest.mocked(getMyComunas).mockResolvedValue(multiComunas);
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Olá, duas comunas');
    await fireEvent.press(screen.getByLabelText(/Publicar em .*Trocar destino/));
    await fireEvent.press(await screen.findByLabelText(/c\/ Comuna B\./));
    await fireEvent.press(screen.getByLabelText(/Confirmar publicação em/));
    await fireEvent.press(screen.getByLabelText('Publicar'));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(2));
    expect(createPost).toHaveBeenNthCalledWith(1, expect.objectContaining({ comunaServerId: 'srv-a', text: 'Olá, duas comunas' }));
    expect(createPost).toHaveBeenNthCalledWith(2, expect.objectContaining({ comunaServerId: 'srv-b', text: 'Olá, duas comunas' }));
    expect(haptic).toHaveBeenCalledWith('success');
  });

  it('limita a três locais por publicação', async () => {
    jest.mocked(getMyComunas).mockResolvedValue(multiComunas);
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Três locais');
    await fireEvent.press(screen.getByLabelText(/Publicar em .*Trocar destino/));
    await fireEvent.press(await screen.findByLabelText(/c\/ Comuna B\./));
    await fireEvent.press(screen.getByLabelText(/c\/ Comuna C\./));
    expect(screen.getByLabelText(/c\/ Comuna D\./).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText(/Confirmar publicação em/));
    await fireEvent.press(screen.getByLabelText('Publicar'));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(3));
    expect(jest.mocked(createPost).mock.calls.map(([input]) => input.comunaServerId)).toEqual(['srv-a', 'srv-b', 'srv-c']);
  });

  it('publica no próprio perfil junto de até três comunas', async () => {
    jest.mocked(getMyComunas).mockResolvedValue(multiComunas);
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Perfil e comunas');
    await fireEvent.press(screen.getByLabelText(/Publicar em .*Trocar destino/));
    await fireEvent.press(await screen.findByLabelText(/Meu perfil/));
    await fireEvent.press(screen.getByLabelText(/c\/ Comuna B\./));
    await fireEvent.press(screen.getByLabelText(/c\/ Comuna C\./));
    expect(screen.getByLabelText(/c\/ Comuna D\./).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText(/Confirmar publicação em/));
    await fireEvent.press(screen.getByLabelText('Publicar'));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(4));
    expect(jest.mocked(createPost).mock.calls.map(([input]) => input.comunaServerId)).toEqual([null, 'srv-a', 'srv-b', 'srv-c']);
  });

  it('publica somente imagem, enviando bytes uma vez e referenciando mediaId', async () => {
    jest.mocked(pickPostImage).mockResolvedValue({ clientId: 'client', kind: 'image', uri: 'file:///image.jpg', name: 'imagem.jpg', mimeType: 'image/jpeg', size: 100, width: 800, height: 600, durationMs: null });
    jest.mocked(uploadPostMedia).mockResolvedValue({ id: 'media-1', type: 'image', mimeType: 'image/jpeg', byteSize: 100, width: 800, height: 600, durationMs: null, url: null });
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.press(screen.getByText('Foto'));
    expect(screen.getByLabelText('Trocar foto')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(uploadPostMedia).toHaveBeenCalledTimes(1);
    expect(createPost).toHaveBeenCalledWith({ comunaServerId: null, text: '', mediaId: 'media-1' });
  });

  it('envia um assunto opcional na publicação de perfil', async () => {
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.press(await screen.findByText('Escolher assuntos'));
    await fireEvent.press(await screen.findByLabelText('Tecnologia e ciência'));
    await fireEvent.press(screen.getByText('Concluir'));
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Linux nas escolas');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).toHaveBeenCalledWith({ comunaServerId: null, text: 'Linux nas escolas', topic: 'tec' });
  });

  it('envia mais de um assunto na publicação de perfil', async () => {
    jest.mocked(createPost).mockResolvedValue({} as Awaited<ReturnType<typeof createPost>>);
    await render(<CreatePostScreen />);
    await fireEvent.press(await screen.findByText('Escolher assuntos'));
    await fireEvent.press(await screen.findByLabelText('Tecnologia e ciência'));
    await fireEvent.press(screen.getByLabelText('Esportes'));
    await fireEvent.press(screen.getByText('Concluir'));
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Dois assuntos');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(createPost).toHaveBeenCalledWith({ comunaServerId: null, text: 'Dois assuntos', topics: ['tec', 'esp'] });
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

  it('protege o rascunho sujo com confirmação antes de descartar', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Rascunho');
    expect(mockPreventRemove).not.toBeNull();

    const repeat = jest.fn();
    mockPreventRemove!({ data: { action: {} }, repeat });
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alert.mock.calls[0] as [string, string, { text?: string; onPress?: () => void }[]];
    expect(title).toBe('Descartar publicação?');
    expect(message).toContain('serão perdidos');
    expect(buttons.map((button) => button.text)).toEqual(['Continuar escrevendo', 'Descartar']);
    expect(repeat).not.toHaveBeenCalled();

    await act(async () => { buttons[1]?.onPress?.(); });
    expect(repeat).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it('falha conserva o rascunho para retry, e o sucesso navega uma única vez', async () => {
    jest.mocked(createPost).mockRejectedValueOnce(new NetworkError());
    const view = await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Mutirão');
    await fireEvent.press(screen.getByLabelText('Publicar'));
    expect(screen.getByLabelText('Texto da publicação').props.value).toBe('Mutirão');
    expect(router.replace).not.toHaveBeenCalled();
    jest.mocked(createPost).mockResolvedValueOnce({} as Awaited<ReturnType<typeof createPost>>);
    const submit = screen.getByLabelText('Publicar');
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    expect(createPost).toHaveBeenCalledTimes(2);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
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
    await fireEvent.press(screen.getByLabelText('Publicar enquete'));
    expect(createPost).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Pergunta da enquete'), 'Qual livro vamos ler?');
    await fireEvent.changeText(screen.getByLabelText('Opção A'), 'O cortiço');
    await fireEvent.changeText(screen.getByLabelText('Opção B'), 'O cortiço');
    await fireEvent.press(screen.getByLabelText('Publicar enquete'));
    expect(createPost).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Opção B'), 'Capitães da Areia');
    await fireEvent.press(screen.getByLabelText('Adicionar opção'));
    await fireEvent.changeText(screen.getByLabelText('Opção C'), 'Memórias póstumas');
    await fireEvent.press(screen.getByLabelText('Remover opção C'));
    expect(screen.queryByLabelText('Opção C')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Publicar enquete'));
    expect(createPost).toHaveBeenCalledWith({
      comunaServerId: null,
      text: '',
      poll: { question: 'Qual livro vamos ler?', options: [{ label: 'O cortiço' }, { label: 'Capitães da Areia' }], durationDays: 7 },
    });
  });
});

describe('digitação isolada e prévia sincronizada', () => {
  it('não reconcilia os painéis já montados a cada tecla', async () => {
    setPerformanceInstrumentationOverride(true);
    resetPerformanceSession();
    await render(<CreatePostScreen />);
    const input = screen.getByLabelText('Texto da publicação');

    // A primeira tecla muda "rascunho vazio" para "com conteúdo" e atualiza o botão publicar.
    await fireEvent.changeText(input, 'a');
    resetPerformanceSession();

    for (const value of ['ab', 'abc', 'abcd', 'abcde']) {
      await fireEvent.changeText(input, value);
    }

    const commits = getPerformanceSnapshot().commits;
    const editor = commits.find((commit) => commit.component === 'ComposerWriteEditor');
    expect(editor?.updateCommits).toBeGreaterThan(0);
    expect(commits.filter((commit) => commit.component === 'ComposerDestinationStep')).toHaveLength(0);
    expect(commits.filter((commit) => commit.component === 'ComposerPostTypeStep')).toHaveLength(0);
    expect(commits.filter((commit) => commit.component === 'ComposerWritePhotoFrame')).toHaveLength(0);
    expect(input.props.value).toBe('abcde');
  });

  it('prévia lê o texto e o título atuais da store', async () => {
    await render(<CreatePostScreen />);
    const input = screen.getByLabelText('Texto da publicação');
    await fireEvent.changeText(input, 'Primeiro rascunho');
    await fireEvent.press(screen.getByLabelText('Adicionar título'));
    await fireEvent.changeText(screen.getByLabelText('Título da publicação'), 'Ato na quinta');
    await fireEvent.changeText(input, 'Segundo rascunho');

    await fireEvent.press(screen.getByLabelText('Prévia da publicação'));
    expect(screen.getByTestId('post-card-preview', { includeHiddenElements: true }).props.children).toBe('Ato na quinta · Segundo rascunho');

    await fireEvent.press(screen.getByLabelText('Prévia da publicação'));
    const editorInput = screen.getByLabelText('Texto da publicação');
    await fireEvent.changeText(editorInput, 'Rascunho final');
    await fireEvent.press(screen.getByLabelText('Prévia da publicação'));
    expect(screen.getByTestId('post-card-preview', { includeHiddenElements: true }).props.children).toBe('Ato na quinta · Rascunho final');
  });

  it('mantém o rascunho ao alternar para enquete e voltar', async () => {
    await render(<CreatePostScreen />);
    await fireEvent.changeText(screen.getByLabelText('Texto da publicação'), 'Texto preservado');
    await fireEvent.press(screen.getByRole('tab', { name: 'Enquete' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Escrever' }));
    expect(screen.getByLabelText('Texto da publicação').props.value).toBe('Texto preservado');
  });
});
