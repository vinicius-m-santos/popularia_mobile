import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { ComunaDetails } from '@/types/models';
import { publishMark } from '@/features/media/image-cache';
import { resetImageUploadLocks, tryLockImageUpload } from '@/features/media/image-lock';
import { uploadMark } from '@/features/media/upload-image';

import { useComunaMark } from '../components/use-comuna-mark';

const mockShow = jest.fn();

jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/features/media/upload-image', () => ({ uploadMark: jest.fn() }));
jest.mock('@/features/media/image-cache', () => ({ publishMark: jest.fn() }));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => true) } }));

const comuna = { id: 'comuna-1', markUrl: null } as unknown as ComunaDetails;
const image = { uri: 'file:///marca.jpg', name: 'marca.jpg', mimeType: 'image/jpeg' as const, size: 10 };

beforeEach(() => {
  jest.clearAllMocks();
  resetImageUploadLocks();
});

describe('marca da comuna', () => {
  it('publica a nova marca, recarrega a comuna e libera o lock', async () => {
    jest.mocked(uploadMark).mockResolvedValue('https://cdn.test/marca.jpg');
    const onChanged = jest.fn();
    const { result } = await renderHook(() => useComunaMark(comuna, onChanged));

    await act(async () => { await result.current.send(image); });

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(uploadMark).toHaveBeenCalledWith('comuna-1', image);
    expect(publishMark).toHaveBeenCalledWith(comuna, 'https://cdn.test/marca.jpg');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(result.current.shown).toBeNull();
    // O mesmo lock pode ser usado de novo depois do envio.
    expect(tryLockImageUpload('mark:comuna-1')).toBe(true);
  });

  it('mostra erro, limpa a prévia e libera o lock quando o upload falha', async () => {
    jest.mocked(uploadMark).mockRejectedValue(new Error('sem rede'));
    const { result } = await renderHook(() => useComunaMark(comuna));

    await act(async () => { await result.current.send(image); });

    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    expect(result.current.shown).toBeNull();
    expect(tryLockImageUpload('mark:comuna-1')).toBe(true);
  });

  it('não envia duas marcas da mesma comuna ao mesmo tempo', async () => {
    tryLockImageUpload('mark:comuna-1');
    const { result } = await renderHook(() => useComunaMark(comuna));

    await act(async () => { await result.current.send(image); });

    expect(uploadMark).not.toHaveBeenCalled();
  });
});
