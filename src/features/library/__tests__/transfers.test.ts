import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as FileSystem from 'expo-file-system/legacy';
import { ApiError } from '@/lib/errors';
import { downloadPdf } from '../api';
import { openPdf, pickPdf } from '../transfers';

const mockShare = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
const mockChoose = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...args: unknown[]) => mockChoose(...args) }), { virtual: true });
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => Promise.resolve(true), shareAsync: (...args: unknown[]) => mockShare(...args) }), { virtual: true });
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', createDownloadResumable: jest.fn(), deleteAsync: jest.fn() }));
jest.mock('../api', () => ({ downloadPdf: jest.fn() }));
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }) },
  Platform: { OS: 'ios', select: (spec: Record<string, unknown>) => spec['ios'] ?? spec['default'] },
}));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined); });
describe('arquivos do aparelho', () => {
  it('seleciona PDF e respeita cancelamento', async () => {
    mockChoose.mockResolvedValueOnce({ canceled: true, assets: null }); expect(await pickPdf()).toBeNull();
    mockChoose.mockResolvedValueOnce({ canceled: false, assets: [{ name: 'cartilha.pdf', uri: 'file:///cartilha.pdf', size: 1024 }] });
    expect((await pickPdf())?.name).toBe('cartilha.pdf');
    expect(mockChoose).toHaveBeenCalledWith({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  });
  it('recusa formato ou tamanho inválido antes do envio', async () => {
    mockChoose.mockResolvedValueOnce({ canceled: false, assets: [{ name: 'planilha.xlsx', uri: '', size: 1 }] }); await expect(pickPdf()).rejects.toThrow('PDF');
    mockChoose.mockResolvedValueOnce({ canceled: false, assets: [{ name: 'grande.pdf', uri: '', size: 26 * 1024 * 1024 }] }); await expect(pickPdf()).rejects.toThrow('25 MB');
  });
  it('recusa do backend nunca abre cópia anterior e limpa temporário', async () => {
    jest.mocked(downloadPdf).mockRejectedValue(new ApiError(404, '/errors/not-found', 'Indisponível'));
    await expect(openPdf('doc', new AbortController().signal)).rejects.toThrow();
    expect(mockShare).not.toHaveBeenCalled(); expect(FileSystem.deleteAsync).toHaveBeenCalledWith(expect.stringContaining('file:///cache/'), { idempotent: true });
  });
  it('download autenticado abre o sistema e descarta arquivo ao terminar', async () => {
    jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({ downloadAsync: () => Promise.resolve({ status: 200, headers: {}, uri: 'file:///cache/file.pdf' }), pauseAsync: () => Promise.resolve() } as unknown as ReturnType<typeof FileSystem.createDownloadResumable>);
    jest.mocked(downloadPdf).mockImplementation(async (_id, options) => {
      await options!.transfer!('https://api.test/file', { Authorization: 'Bearer opaque' }, new AbortController().signal);
      return {} as Response;
    });
    await openPdf('doc', new AbortController().signal);
    expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith('https://api.test/file', expect.stringContaining('file:///cache/'), { headers: { Authorization: 'Bearer opaque' } });
    expect(mockShare).toHaveBeenCalledTimes(1); expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  });
});
