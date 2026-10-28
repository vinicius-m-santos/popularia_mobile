import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError } from '@/lib/errors';
import { getDocument, saveDocument } from '../api';
import DocumentScreen from '../document-screen';
import { openPdf } from '../transfers';
import { document } from '../testing/fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useLocalSearchParams: () => ({ id: 'doc-1' }), useFocusEffect: () => {} }));
jest.mock('react-native-safe-area-context', () => { const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }; });
jest.mock('@/lib/routes', () => ({ goBack: jest.fn(), useNav: () => ({ openComuna: jest.fn() }) }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/comunas/api', () => ({ getComuna: jest.fn() }));
jest.mock('@/features/onboarding/api', () => ({ getTopicGroups: () => Promise.resolve([{ title: 'Política', topics: [{ id: 'trab', label: 'Trabalho e direitos trabalhistas' }] }]) }));
jest.mock('../api', () => ({ getDocument: jest.fn(), saveDocument: jest.fn(), deleteDocument: jest.fn(), reportDocument: jest.fn(), removeDocument: jest.fn() }));
jest.mock('../transfers', () => ({ openPdf: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getDocument).mockResolvedValue(document); jest.mocked(openPdf).mockResolvedValue(undefined); jest.mocked(saveDocument).mockResolvedValue(undefined); });
describe('detalhe de PDF', () => {
  it('abre arquivo autorizado, salva sem refetch completo e publica a referência', async () => {
    await render(<DocumentScreen />);
    await fireEvent.press(await screen.findByText('Abrir PDF'));
    expect(screen.getAllByText(document.title!)).toHaveLength(1);
    expect(screen.getByText('Autoria: Coletivo Tarifa Zero')).toBeTruthy();
    expect(openPdf).toHaveBeenCalledWith(document.id, expect.anything());
    await fireEvent.press(screen.getByLabelText('Salvar documento'));
    expect(saveDocument).toHaveBeenCalledWith(document.id, true); expect(getDocument).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Publicar no feed'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/criar', params: { documentId: document.id } });
    expect(screen.getByText('Assunto: Trabalho e direitos trabalhistas')).toBeTruthy();
  });
  it('revogação no abrir remove os metadados e nunca usa um arquivo antigo', async () => {
    jest.mocked(getDocument).mockResolvedValueOnce(document).mockRejectedValue(new ApiError(404, '/errors/not-found', 'Indisponível'));
    jest.mocked(openPdf).mockRejectedValue(new ApiError(404, '/errors/not-found', 'Indisponível'));
    await render(<DocumentScreen />);
    await fireEvent.press(await screen.findByText('Abrir PDF'));
    await screen.findByText('Acesso restrito');
    await waitFor(() => expect(screen.queryByText(document.description!)).toBeNull());
    expect(screen.queryByText('Abrir PDF')).toBeNull();
    await fireEvent.press(screen.getByText('Remover dos salvos')); expect(saveDocument).toHaveBeenCalledWith(document.id, false);
  });
  it('visitante não vê editar, excluir ou distribuições privadas', async () => {
    jest.mocked(getDocument).mockResolvedValue({ ...document, viewer: {}, distributions: null });
    await render(<DocumentScreen />); await screen.findByText('Abrir PDF');
    expect(screen.queryByText('Editar documento e acesso')).toBeNull(); expect(screen.queryByText('Excluir documento')).toBeNull();
    expect(screen.queryByText('Biblioteca Pública · Fora')).toBeNull();
  });
});
