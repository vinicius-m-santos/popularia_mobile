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
import UploadScreen from '../upload-screen';
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
    await render(<LibraryPane scope="public" />);
    await screen.findByText('Nada disponível para você');
    await fireEvent.press(screen.getByRole('radio', { name: 'De pessoas' }));
    await waitFor(() => expect(listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ origin: 'people', scope: 'public' }), null));
    await fireEvent.changeText(screen.getByLabelText('Buscar na biblioteca'), 'organização');
    await waitFor(() => expect(listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'organização' }), null));
    await fireEvent.press(screen.getByLabelText('Assunto: Escolher assunto'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Trabalho e direitos trabalhistas' }));
    await waitFor(() => expect(listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ topic: 'trab' }), null));
  });
  it('minha biblioteca vazia oferece adicionar e criar coleção', async () => {
    await render(<LibraryPane scope="personal" owner="me" canAdd />);
    await screen.findByText('Sua biblioteca está vazia');
    await fireEvent.press(screen.getByText('Adicionar PDF'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/biblioteca/enviar', params: {} });
    expect(screen.getByText('Criar coleção')).toBeTruthy();
  });
  it('carrega página seguinte sem repetir a primeira', async () => {
    jest.mocked(listDocuments).mockImplementation(async (_filters, cursor) => cursor ? { items: [{ ...document, id: 'doc-2', title: 'Ata' }], nextCursor: null } : { items: [document], nextCursor: 'next' });
    await render(<LibraryPane scope="public" />);
    await screen.findByText(document.title!); await fireEvent.press(screen.getByText('Mais documentos'));
    await screen.findByText('Ata'); expect(screen.getAllByText(document.title!)).toHaveLength(1);
    expect(listDocuments).toHaveBeenLastCalledWith(expect.anything(), 'next');
  });
  it('um bookmark indisponível permite remoção sem pedir arquivo', async () => {
    jest.mocked(listDocuments).mockResolvedValue({ items: [{ ...document, state: 'unavailable', title: null, description: null, responsible: null, origin: null, collection: null, pageCount: null, byteSize: null }], nextCursor: null });
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
  async function review() {
    await fireEvent.press(await screen.findByText('Escolher PDF do aparelho'));
    await fireEvent.changeText(screen.getByLabelText('Nome do documento'), 'Cartilha da tarifa zero');
    await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(await screen.findByText(collection.name));
    await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(screen.getByText('Disponibilizar para qualquer pessoa na Popularia'));
    await fireEvent.press(screen.getByText('Continuar'));
  }
  it('coleção é obrigatória e não existe documento antes de confirmar', async () => {
    await render(<UploadScreen />);
    await fireEvent.press(await screen.findByText('Escolher PDF do aparelho'));
    await fireEvent.press(screen.getByText('Continuar')); await fireEvent.press(screen.getByText('Continuar'));
    expect(screen.getByText('A coleção é obrigatória. Escolha uma ou crie agora.')).toBeTruthy(); expect(uploadDocument).not.toHaveBeenCalled();
  });
  it('progresso, falha e retry mantêm identidade e retornam ao composer sem duplicar', async () => {
    params.composerKey = 'draft-1';
    const receive = jest.fn(); const unsubscribe = subscribeAttachment('draft-1', receive);
    jest.mocked(uploadDocument).mockRejectedValueOnce(new ApiError(503, '/errors/service-unavailable', 'Falhou'));
    await render(<UploadScreen />); await review();
    await fireEvent.press(screen.getByText('Enviar PDF'));
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
    await fireEvent.press(await screen.findByText('Escolher PDF do aparelho')); await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(await screen.findByText(collection.name)); await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(await screen.findByText('c/ Tarifa Zero')); await fireEvent.press(screen.getByText('Continuar'));
    await fireEvent.press(screen.getByText('Enviar PDF'));
    expect(uploadDocument).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sharedWith: ['tarifa-zero'], isPublic: false }), expect.anything(), expect.anything());
  });
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
  expect(editDocument).toHaveBeenCalledWith(document.id, expect.objectContaining({ title: updated.title, collectionId: collection.id, isPublic: false }));
});
