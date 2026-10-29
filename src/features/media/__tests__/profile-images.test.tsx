import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';

import { ApiError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';
import type { User } from '@/types/models';

import { ComunaCover } from '@/features/comunas/components/comuna-cover';
import { ProfilePhoto } from '@/features/profiles/profile-photo';

import { resetImageUploadLocks } from '../image-lock';
import { uploadAvatar, uploadCover } from '../upload-image';

const mockShow = jest.fn();
const mockSaveAsync = jest.fn<(options?: unknown) => Promise<{ uri: string; width: number; height: number }>>();
const mockRenderAsync = jest.fn(() => Promise.resolve({ saveAsync: mockSaveAsync }));

jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/components/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text } = require('react-native');
  return { BottomSheet: ({ visible, title, children }: { visible: boolean; title?: string; children: React.ReactNode }) => visible ? React.createElement(View, null, title ? React.createElement(Text, null, title) : null, children) : null };
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ File: class { size = 1024; } }));
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const Image = ({ source, ...props }: { source?: { uri?: string } }) => React.createElement(View, { ...props, testID: source?.uri ? `image:${source.uri}` : 'image' });
  Image.prefetch = jest.fn(() => Promise.resolve(true));
  return { Image };
});
jest.mock('../upload-image', () => ({ uploadAvatar: jest.fn(), uploadCover: jest.fn() }));

const me: User = { id: 'me', name: 'Camila', handle: 'camila', initials: 'CA', tone: 'red', avatarUrl: 'https://cdn/old.jpg' };
const other: User = { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'black', avatarUrl: null };
const asset = { canceled: false as const, assets: [{ uri: 'file:///photo.jpg', width: 800, height: 800, assetId: null, type: 'image' as const }] };

function comuna(canEdit: boolean) {
  return render(<ComunaCover comuna={{ id: 'hortas', serverId: 'uuid-1', name: 'Hortas', coverAlt: 'hortas', coverUrl: 'https://cdn/old-cover.jpg' }} canEdit={canEdit} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  resetImageUploadLocks();
  mockSaveAsync.mockResolvedValue({ uri: 'file:///normalized.jpg', width: 800, height: 800 });
  jest.mocked(ImageManipulator.manipulate).mockReturnValue({ renderAsync: mockRenderAsync } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(asset);
});

describe('foto de perfil', () => {
  it('a própria pessoa inicia a troca e outro perfil não oferece edição', async () => {
    await render(<><ProfilePhoto user={me} editable onUploaded={jest.fn()} /><ProfilePhoto user={other} editable={false} onUploaded={jest.fn()} /></>);
    expect(screen.getByLabelText('Alterar foto de perfil')).toBeTruthy();
    expect(screen.queryByLabelText('Alterar foto de Ana')).toBeNull();
    expect(screen.queryAllByLabelText('Alterar foto de perfil')).toHaveLength(1);
  });

  it('publica a foto nova e atualiza a query da pessoa', async () => {
    jest.mocked(uploadAvatar).mockResolvedValue('https://cdn/new.jpg');
    const onUploaded = jest.fn();
    await render(<ProfilePhoto user={me} editable onUploaded={onUploaded} />);
    await fireEvent.press(screen.getByLabelText('Alterar foto de perfil'));
    await fireEvent.press(screen.getByLabelText('Escolher da galeria'));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith('https://cdn/new.jpg'));
    expect(uploadAvatar).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['user-avatar', 'me'])).toBe('https://cdn/new.jpg');
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1], base64: false }));
  });

  it('restaura a foto anterior quando o envio falha', async () => {
    jest.mocked(uploadAvatar).mockRejectedValue(new ApiError(422, '/errors/post-media-format', 'Use uma imagem JPEG, PNG ou WebP.'));
    const onUploaded = jest.fn();
    await render(<ProfilePhoto user={me} editable onUploaded={onUploaded} />);
    await fireEvent.press(screen.getByLabelText('Alterar foto de perfil'));
    await fireEvent.press(screen.getByLabelText('Escolher da galeria'));
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith('Use uma imagem JPEG, PNG ou WebP.'));
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByTestId('image:https://cdn/old.jpg', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('image:file:///normalized.jpg', { includeHiddenElements: true })).toBeNull();
  });

  it('não dispara um segundo envio enquanto o primeiro está em andamento', async () => {
    let releasePick: (result: typeof asset) => void = () => undefined;
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockImplementation(() => new Promise((resolve) => { releasePick = resolve; }));
    let releaseUpload: (url: string) => void = () => undefined;
    jest.mocked(uploadAvatar).mockImplementation(() => new Promise((resolve) => { releaseUpload = resolve; }));
    await render(<ProfilePhoto user={me} editable onUploaded={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Alterar foto de perfil'));
    await fireEvent.press(screen.getByLabelText('Escolher da galeria'));
    await fireEvent.press(screen.getByLabelText('Escolher da galeria'));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    await act(async () => { releasePick(asset); });
    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByLabelText('Enviando foto de perfil'));
    expect(uploadAvatar).toHaveBeenCalledTimes(1);
    await act(async () => { releaseUpload('https://cdn/new.jpg'); });
  });
});

describe('capa da comuna', () => {
  it('quem administra pode iniciar a troca e quem não pode só vê a capa', async () => {
    const view = await comuna(true);
    expect(screen.getByLabelText('Alterar capa da comuna')).toBeTruthy();
    await view.unmount();
    await comuna(false);
    expect(screen.queryByLabelText('Alterar capa da comuna')).toBeNull();
    expect(screen.getByLabelText('Capa: hortas')).toBeTruthy();
  });

  it('confirma a capa horizontal, publica e atualiza o cache', async () => {
    jest.mocked(uploadCover).mockResolvedValue('https://cdn/new-cover.jpg');
    await comuna(true);
    await fireEvent.press(screen.getByLabelText('Alterar capa da comuna'));
    await fireEvent.press(screen.getByLabelText('Escolher da galeria'));
    expect(await screen.findByLabelText('Pré-visualização da capa')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Usar esta capa'));
    await waitFor(() => expect(uploadCover).toHaveBeenCalledWith('hortas', expect.objectContaining({ uri: 'file:///normalized.jpg' })));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
    expect(queryClient.getQueryData(['comuna-cover', 'hortas'])).toBe('https://cdn/new-cover.jpg');
    expect(screen.getByTestId('image:https://cdn/new-cover.jpg')).toBeTruthy();
  });

  it('mantém a capa anterior quando o envio falha', async () => {
    jest.mocked(uploadCover).mockRejectedValue(new ApiError(403, '/errors/not-comuna-owner', 'Só quem é proprietário da comuna pode fazer isso.'));
    await comuna(true);
    await fireEvent.press(screen.getByLabelText('Alterar capa da comuna'));
    await fireEvent.press(screen.getByLabelText('Escolher da galeria'));
    await fireEvent.press(await screen.findByLabelText('Usar esta capa'));
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith('Só quem é proprietário da comuna pode fazer isso.'));
    expect(screen.getByTestId('image:https://cdn/old-cover.jpg')).toBeTruthy();
    expect(screen.queryByTestId('image:file:///normalized.jpg')).toBeNull();
  });

  it('ignora um segundo envio enquanto o primeiro está em andamento', async () => {
    let release: (url: string) => void = () => undefined;
    jest.mocked(uploadCover).mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await comuna(true);
    await fireEvent.press(screen.getByLabelText('Alterar capa da comuna'));
    await fireEvent.press(screen.getByLabelText('Escolher da galeria'));
    await fireEvent.press(await screen.findByLabelText('Usar esta capa'));
    await fireEvent.press(screen.getByLabelText('Enviando capa da comuna'));
    await waitFor(() => expect(uploadCover).toHaveBeenCalledTimes(1));
    await act(async () => { release('https://cdn/new-cover.jpg'); });
  });
});
