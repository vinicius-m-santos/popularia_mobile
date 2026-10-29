import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';

import { pickPostImage, pickPostVideo } from '../post-media';

const mockSaveAsync = jest.fn<(options?: unknown) => Promise<{ uri: string; width: number; height: number }>>();
const mockRenderAsync = jest.fn(() => Promise.resolve({ saveAsync: mockSaveAsync }));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'client-id' }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ File: class { size = 1024; } }));
jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

describe('seleção de mídia da publicação', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveAsync.mockResolvedValue({ uri: 'file:///normalized.jpg', width: 1600, height: 900 });
    jest.mocked(ImageManipulator.manipulate).mockReturnValue({ renderAsync: mockRenderAsync } as never);
  });

  it('normaliza imagem grande para JPEG sem base64', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ assetId: null, uri: 'file:///photo.heic', width: 4000, height: 3000, type: 'image', fileSize: 8_000_000, fileName: 'photo.heic', mimeType: 'image/heic' }] });
    const media = await pickPostImage();
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///photo.heic', { maxWidth: 2048, maxHeight: 2048 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.82, format: 'jpeg' });
    expect(media).toMatchObject({ kind: 'image', mimeType: 'image/jpeg', uri: 'file:///normalized.jpg', clientId: 'client-id' });
  });

  it('aceita 30 segundos e recusa acima do limite', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ assetId: null, uri: 'file:///video.mp4', width: 720, height: 1280, type: 'video', duration: 30_000, fileSize: 1000, fileName: 'video.mp4', mimeType: 'video/mp4' }] });
    await expect(pickPostVideo()).resolves.toMatchObject({ durationMs: 30_000 });
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ assetId: null, uri: 'file:///video.mp4', width: 720, height: 1280, type: 'video', duration: 30_001, fileSize: 1000, fileName: 'video.mp4', mimeType: 'video/mp4' }] });
    await expect(pickPostVideo()).rejects.toThrow('30 segundos');
  });

  it('recusa vídeo acima de 100 MB', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ assetId: null, uri: 'file:///video.mp4', width: 720, height: 1280, type: 'video', duration: 10_000, fileSize: 100 * 1024 * 1024 + 1, fileName: 'video.mp4', mimeType: 'video/mp4' }] });
    await expect(pickPostVideo()).rejects.toThrow('100 MB');
  });
});
