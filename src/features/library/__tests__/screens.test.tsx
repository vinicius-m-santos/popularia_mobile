import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError } from '@/lib/errors';
import { getMyComunas } from '@/features/comunas/api';
import type { Comuna } from '@/types/models';
import { listCollections, listDocuments, uploadDocument, saveDocument, getDocument, editDocument } from '../api';
import { subscribeAttachment } from '../composer-attachment';
import { DocumentCard } from '../document-card';
import { LibraryPane } from '../library-screen';
import UploadScreen, { titleFromFilename } from '../upload-screen';
import { pickPdf } from '../transfers';
import { collection, document } from '../testing/fixtures';

const params: { composerKey?: string; edit?: string } = {};
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => params, useFocusEffect: () => {}, usePreventRemove: () => jest.fn() }));
jest.mock('react-native-safe-area-context', () => { const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }; });
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me', name: 'Camila' }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/comunas/api', () => ({ getComuna: jest.fn(), getMyComunas: jest.fn() }));
jest.mock('@/features/onboarding/api', () => ({ getTopicGroups: () => Promise.resolve([{ title: 'Política', topics: [{ id: 'trab', label: 'Trabalho e direitos trabalhistas', shortLabel: 'Trabalho' }] }]) }));
jest.mock('../api', () => ({ listDocuments: jest.fn(), listCollections: jest.fn(), uploadDocument: jest.fn(), saveDocument: jest.fn(), createCollection: jest.fn(), getDocument: jest.fn(), editDocument: jest.fn() }));
jest.mock('../transfers', () => ({ pickPdf: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks(); delete params.composerKey; delete params.edit;
  jest.mocked(listDocuments).mockResolvedValue({ items: [], nextCursor: null });
  jest.mocked(listCollections).mockResolvedValue({ items: [collection], nextCursor: null });
  jest.mocked(getMyComunas).mockResolvedValue([]);
  jest.mocked(pickPdf).mockResolvedValue({ name: 'cartilha.pdf', uri: 'file:///cartilha.pdf', size: 1024 });
});
describe('bibliotecas reais', () => {
  it('separa vazio, busca, filtros oficiais e paginação no servidor', async () => {
    jest.mocked(listDocuments).mockResolvedValue({ items: [document], nextCursor: null });
    await render(<LibraryPane scope="public" canAdd />);
    await screen.findByText(document.title!);
    expect(screen.getByText('Autoria: Coletivo Tarifa Zero')).toBeTruthy();
    expect(screen.queryByLabelText('Mais ações da biblioteca')).toBeNull();
    expect(screen.getByText('Criar coleção')).toBeTruthy();
    expect(screen.getByPlaceholderText('Título, autoria, coleção ou assunto')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'De pessoas' }));
    await waitFor(() => expect(listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ origin: 'people', scope: 'public' }), null));
    await fireEvent.changeText(screen.getByLabelText('Buscar na biblioteca'), 'organização');
    await waitFor(() => expect(listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'organização' }), null));
    await fireEvent.press(screen.getByLabelText('Assunto: Escolher assunto'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Trabalho e direitos trabalhistas' }));
    await waitFor(() => expect(listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ topic: 'trab' }), null));
  });
  it('apresenta a coleção com identidade, ações e filtros próprios', async () => {
    const onEdit = jest.fn();
    jest.mocked(listDocuments).mockResolvedValue({ items: [{ ...document, isPublic: true }], nextCursor: null });
    await render(<LibraryPane scope="public" collection={collection.id} collectionData={collection} canAdd onEditCollection={onEdit} />);
    await screen.findByText(document.title!);
    expect(screen.getByText(collection.name)).toBeTruthy();
    expect(screen.getByText(collection.origin.name)).toBeTruthy();
    expect(screen.getByLabelText('Buscar nesta coleção')).toBeTruthy();
    expect(screen.getAllByText('Público').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText('Editar coleção'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Adicionar PDF'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/biblioteca/enviar', params: { collection: collection.id } });
    await fireEvent.changeText(screen.getByLabelText('Buscar nesta coleção'), 'tarifa');
    await waitFor(() => expect(listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ collection: collection.id, q: 'tarifa' }), null));
  });
  it('minha biblioteca vazia oferece adicionar e criar coleção', async () => {
    await render(<LibraryPane scope="personal" owner="me" canAdd />);
    await screen.findByText('Poxa, não achamos nada por aqui');
    await fireEvent.press(screen.getByText('Adicionar um documento'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/biblioteca/enviar', params: {} });
    expect(screen.queryByText('Criar coleção')).toBeNull();
    expect(screen.queryByLabelText('Buscar na biblioteca')).toBeNull();
  });
  it('carrega página seguinte sem repetir a primeira', async () => {
    jest.mocked(listDocuments).mockImplementation(async (_filters, cursor) => cursor ? { items: [{ ...document, id: 'doc-2', title: 'Ata' }], nextCursor: null } : { items: [document], nextCursor: 'next' });
    await render(<LibraryPane scope="public" />);
    await screen.findByText(document.title!); await fireEvent.press(screen.getByText('Mais documentos'));
    await screen.findByText('Ata'); expect(screen.getAllByText(document.title!)).toHaveLength(1);
    expect(listDocuments).toHaveBeenLastCalledWith(expect.anything(), 'next');
  });
  it('um bookmark indisponível permite remoção sem pedir arquivo', async () => {
    jest.mocked(listDocuments).mockResolvedValue({ items: [{ ...document, state: 'unavailable', title: null, description: null, author: null, responsible: null, origin: null, collection: null, pageCount: null, byteSize: null }], nextCursor: null });
    jest.mocked(saveDocument).mockResolvedValue(undefined);
    await render(<LibraryPane scope="saved" />);
    await fireEvent.press(await screen.findByText('Remover dos salvos'));
    expect(saveDocument).toHaveBeenCalledWith(document.id, false);
    await waitFor(() => expect(screen.queryByText('Este documento não está mais disponível para você.')).toBeNull());
  });
  it('card bloqueado não renderiza descrição, autoria, coleção nem páginas', async () => {
    await render(<DocumentCard document={{ ...document, state: 'locked', title: null }} />);
    expect(screen.queryByText(document.description!)).toBeNull(); expect(screen.queryByText(collection.name)).toBeNull();
    expect(screen.queryByText('16 págs')).toBeNull(); expect(screen.queryByText('Biblioteca de Camila')).toBeNull();
    expect(screen.getByText('Ver uma publicação com este PDF não dá acesso ao arquivo.')).toBeTruthy();
  });
});
describe('envio PDF em quatro etapas', () => {
  async function chooseTopic() {
    await fireEvent.press(screen.getByLabelText('Assunto: Escolher assunto'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Trabalho e direitos trabalhistas' }));
  }
  async function review() {
    await fireEvent.press(await screen.findByText('Selecionar arquivo'));
    await fireEvent.changeText(screen.getByLabelText('Nome do documento'), 'Cartilha da tarifa zero');
    await fireEvent.press(screen.getByText('Continuar'));
    await chooseTopic();
    await fireEvent.press(await screen.findByRole('radio', { name: collection.name }));
    await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(screen.getByLabelText('Biblioteca Pública'));
    await fireEvent.press(screen.getByText('Continuar'));
  }
  it('separa arquivo e informações básicas dos detalhes', async () => {
    await render(<UploadScreen />);
    expect(screen.getByText('Arquivo e informações')).toBeTruthy();
    expect(screen.queryByLabelText('Descrição curta')).toBeNull();
    await fireEvent.press(screen.getByText('Selecionar arquivo'));
    await fireEvent.press(screen.getByText('Continuar'));
    expect(screen.getByText('Detalhes')).toBeTruthy();
    expect(screen.getByLabelText('Descrição curta')).toBeTruthy();
    expect(screen.getByLabelText('Assunto: Escolher assunto')).toBeTruthy();
    expect(screen.queryByText('Assunto · opcional')).toBeNull();
    expect(screen.getByText(collection.name)).toBeTruthy();
  });
  it('abre nova coleção com formulário editorial e placeholders de exemplo', async () => {
    await render(<UploadScreen />);
    await fireEvent.press(await screen.findByText('Selecionar arquivo'));
    await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(screen.getByText('Criar nova coleção'));
    expect(screen.getByText('Nova coleção')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex.: Formação popular')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex.: Cartilhas, estudos e materiais de referência')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar e selecionar' })).toBeTruthy();
  });
  it('assunto e coleção são obrigatórios e não existe documento antes de confirmar', async () => {
    await render(<UploadScreen />);
    await fireEvent.press(await screen.findByText('Selecionar arquivo'));
    await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(screen.getByText('Continuar'));
    expect(screen.getAllByText('Escolha um assunto para o documento.').length).toBeGreaterThan(0);
    await chooseTopic();
    await fireEvent.press(screen.getByText('Continuar'));
    expect(screen.getByText('A coleção é obrigatória. Escolha uma ou crie agora.')).toBeTruthy(); expect(uploadDocument).not.toHaveBeenCalled();
  });
  it('mantém o nome do documento em uma linha também depois do blur', async () => {
    await render(<UploadScreen />);
    const title = screen.getByLabelText('Nome do documento');
    const longTitle = 'Um nome de documento muito comprido que não deve aumentar a altura do campo';
    await fireEvent.changeText(title, longTitle);
    expect(screen.getByLabelText('Nome do documento').props.numberOfLines).toBeUndefined();
    await fireEvent(title, 'blur');
    expect(screen.getByLabelText('Nome do documento').props.numberOfLines).toBeUndefined();
    expect(screen.getByLabelText('Nome do documento').props.multiline).toBe(false);
    expect(screen.getByLabelText('Nome do documento').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: 48, maxHeight: 48, overflow: 'hidden' })]));
    expect(screen.getByText(longTitle).props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' });
    await fireEvent.press(screen.getByText(longTitle));
    expect(screen.queryByText(longTitle)).toBeNull();
  });
  it('envia autoria opcional e preserva a atribuição no envio', async () => {
    jest.mocked(uploadDocument).mockResolvedValue(document);
    await render(<UploadScreen />);
    await fireEvent.press(await screen.findByText('Selecionar arquivo'));
    await fireEvent.changeText(screen.getByLabelText('Nome do documento'), 'Cartilha');
    await fireEvent.changeText(screen.getByLabelText('Autoria'), 'Coletivo Tarifa Zero');
    await fireEvent.press(screen.getByText('Continuar'));
    await chooseTopic();
    await fireEvent.press(await screen.findByRole('radio', { name: collection.name }));
    await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(screen.getByText('Continuar'));
    expect(screen.getByText('Coletivo Tarifa Zero')).toBeTruthy();
    await fireEvent.press(screen.getByText('Enviar arquivo'));
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ author: 'Coletivo Tarifa Zero' }), expect.anything(), expect.anything()));
  });
  it('progresso, falha e retry mantêm identidade e retornam ao composer sem duplicar', async () => {
    params.composerKey = 'draft-1';
    const receive = jest.fn(); const unsubscribe = subscribeAttachment('draft-1', receive);
    jest.mocked(uploadDocument).mockRejectedValueOnce(new ApiError(503, '/errors/service-unavailable', 'Falhou'));
    await render(<UploadScreen />); await review();
    await fireEvent.press(screen.getByText('Enviar arquivo'));
    expect(screen.getByText('O servidor teve um problema. Tente de novo em instantes.')).toBeTruthy();
    let finish: ((value: typeof document) => void) | undefined;
    jest.mocked(uploadDocument).mockImplementationOnce((_file, _metadata, progress) => { progress(50); return new Promise((resolve) => { finish = resolve; }); });
    await fireEvent.press(screen.getByText('Tentar enviar novamente'));
    expect(screen.getByText('Enviando PDF · 50%')).toBeTruthy();
    await waitFor(async () => { finish?.(document); });
    await screen.findByText('PDF na biblioteca');
    expect(jest.mocked(uploadDocument).mock.calls[0][1].clientId).toBe(jest.mocked(uploadDocument).mock.calls[1][1].clientId);
    expect(jest.mocked(uploadDocument).mock.calls[1][1]).toMatchObject({ title: document.title, collectionId: collection.id, access: 'private', isPublic: true });
    await fireEvent.press(screen.getByText('Voltar para a publicação'));
    expect(receive).toHaveBeenCalledWith(document); expect(router.back).toHaveBeenCalledTimes(1); expect(uploadDocument).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it('compartilhar com comuna é escolha explícita no mesmo upload', async () => {
    jest.mocked(getMyComunas).mockResolvedValue([{ id: 'tarifa-zero', name: 'Tarifa Zero', status: 'active', visibility: 'private' } as Comuna]);
    jest.mocked(uploadDocument).mockResolvedValue(document);
    await render(<UploadScreen />);
    await fireEvent.press(await screen.findByText('Selecionar arquivo')); await fireEvent.press(screen.getByText('Continuar'));
    await chooseTopic(); await fireEvent.press(await screen.findByRole('radio', { name: collection.name })); await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(await screen.findByLabelText('c/ Tarifa Zero')); await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(screen.getByText('Enviar arquivo'));
    expect(uploadDocument).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sharedWith: ['tarifa-zero'], isPublic: false }), expect.anything(), expect.anything());
  });
});

it('sugere título legível sem manter separadores do nome do arquivo', () => {
  expect(titleFromFilename('o_guia-do-mochileiro das galáxias.pdf')).toBe('O Guia Do Mochileiro Das Galáxias');
});


it('editar muda metadados e coleção sem reenviar nem substituir arquivo', async () => {
  params.edit = document.id;
  const updated = { ...document, title: 'Título atualizado' };
  jest.mocked(getDocument).mockResolvedValueOnce(document).mockResolvedValue(updated);
  jest.mocked(editDocument).mockResolvedValue(updated);
  await render(<UploadScreen />);
  await waitFor(() => expect(screen.getByLabelText('Nome do documento').props.value).toBe(document.title));
  await fireEvent.changeText(screen.getByLabelText('Nome do documento'), updated.title);
  await fireEvent.press(screen.getByText('Continuar')); await fireEvent.press(screen.getByText('Continuar')); await fireEvent.press(screen.getByText('Continuar'));
  await fireEvent.press(screen.getByText('Salvar alterações'));
  await screen.findByText('Documento atualizado');
  expect(uploadDocument).not.toHaveBeenCalled(); expect(pickPdf).not.toHaveBeenCalled();
  expect(editDocument).toHaveBeenCalledWith(document.id, expect.objectContaining({ title: updated.title, author: document.author, collectionId: collection.id, isPublic: false }));
});

it('editar remove autoria somente com o sinalizador clearAuthor', async () => {
  params.edit = document.id;
  jest.mocked(getDocument).mockResolvedValue(document);
  jest.mocked(editDocument).mockResolvedValue({ ...document, author: null });
  await render(<UploadScreen />);
  await waitFor(() => expect(screen.getByLabelText('Autoria').props.value).toBe(document.author));
  await fireEvent.changeText(screen.getByLabelText('Autoria'), '');
  await fireEvent.press(screen.getByText('Continuar')); await fireEvent.press(screen.getByText('Continuar')); await fireEvent.press(screen.getByText('Continuar'));
  await fireEvent.press(screen.getByText('Salvar alterações'));
  await screen.findByText('Documento atualizado');
  expect(editDocument).toHaveBeenCalledWith(document.id, expect.objectContaining({ clearAuthor: true }));
});
