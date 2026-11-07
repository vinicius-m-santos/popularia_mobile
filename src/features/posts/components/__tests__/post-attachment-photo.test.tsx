import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ImageRef } from 'expo-image';

import { PostAttachment } from '../post-attachment';
import type { PostMediaDto } from '../../post-media';

const mockLoadAsync = jest.fn<(source: unknown, options: unknown) => Promise<ImageRef | null>>();
jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Image = (props: Record<string, unknown>) => React.createElement(View, props);
  Image.loadAsync = (source: unknown, options: unknown) => mockLoadAsync(source, options);
  return { Image };
});

const mockPhotoViewer = jest.fn();
jest.mock('../photo-viewer', () => ({
  PhotoViewer: (props: Record<string, unknown>) => {
    mockPhotoViewer(props);
    return null;
  },
}));

const photo: PostMediaDto = {
  id: 'photo-1',
  type: 'image',
  url: 'https://example.test/foto.jpg',
  width: 400,
  height: 800,
  durationMs: null,
  mimeType: 'image/jpeg',
  byteSize: 1000,
};

function lastViewerProps(): Record<string, unknown> {
  return mockPhotoViewer.mock.calls[mockPhotoViewer.mock.calls.length - 1][0] as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadAsync.mockResolvedValue(null);
});

describe('PostAttachment · foto em tela cheia', () => {
  it('carrega uma variante no toque e a entrega ao visualizador', async () => {
    const preview = { width: 400, height: 800 } as unknown as ImageRef;
    mockLoadAsync.mockResolvedValue(preview);
    await render(<PostAttachment media={photo} />);

    // Um cartão da lista não retém bitmap extra só por estar visível.
    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(lastViewerProps()).toMatchObject({ visible: false, preview: null });
    await fireEvent(screen.getByTestId('post-photo-image'), 'load');

    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));
    await waitFor(() => expect(mockLoadAsync).toHaveBeenCalledWith(
      { uri: 'https://example.test/foto.jpg' },
      expect.objectContaining({ maxWidth: expect.any(Number), maxHeight: expect.any(Number) }),
    ));

    await waitFor(() => expect(lastViewerProps()).toMatchObject({
      visible: true,
      preview,
      mediaId: photo.id,
      uri: photo.url,
      width: 400,
      height: 800,
    }));
    // A abertura lê a variante uma única vez.
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
  });

  it('abre sem preview quando o bitmap ainda não está no cache', async () => {
    mockLoadAsync.mockResolvedValue(null);
    await render(<PostAttachment media={photo} />);
    await fireEvent(screen.getByTestId('post-photo-image'), 'load');

    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));

    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true, preview: null }));
  });

  it('não disputa rede com a original quando o feed ainda está carregando', async () => {
    const preview = { width: 400, height: 800 } as unknown as ImageRef;
    mockLoadAsync.mockResolvedValue(preview);
    await render(<PostAttachment media={photo} />);

    // A listra do feed ainda está no lugar: a tela cheia usa a listra e pede a original.
    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));

    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true, preview: null }));
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it('solta o preview ao fechar e não atualiza estado depois do unmount', async () => {
    const preview = { width: 400, height: 800 } as unknown as ImageRef;
    mockLoadAsync.mockResolvedValue(preview);
    const view = await render(<PostAttachment media={photo} />);
    await fireEvent(screen.getByTestId('post-photo-image'), 'load');

    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true, preview }));

    await act(async () => {
      (lastViewerProps().onClose as () => void)();
    });
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: false, preview: null }));

    await view.unmount();
  });
});
