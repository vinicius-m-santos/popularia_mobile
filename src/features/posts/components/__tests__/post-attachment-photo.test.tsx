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
const mockViewerLifecycle = { mounts: 0, unmounts: 0 };
jest.mock('../photo-viewer', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    PhotoViewer: (props: Record<string, unknown>) => {
      mockPhotoViewer(props);
      React.useEffect(() => {
        mockViewerLifecycle.mounts += 1;
        return () => { mockViewerLifecycle.unmounts += 1; };
      }, []);
      return null;
    },
  };
});

const mockMeasuredOrigin = { x: 12, y: 34, width: 120, height: 160 };
jest.mock('../photo-viewer-transition', () => ({
  ...jest.requireActual<typeof import('../photo-viewer-transition')>('../photo-viewer-transition'),
  measurePhotoOrigin: (
    _view: unknown,
    _windowWidth: number,
    _windowHeight: number,
    onMeasured: (origin: unknown) => void,
  ) => onMeasured(mockMeasuredOrigin),
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
  mockViewerLifecycle.mounts = 0;
  mockViewerLifecycle.unmounts = 0;
});

describe('PostAttachment · foto em tela cheia', () => {
  it('não monta nenhum visualizador para cartões fechados', async () => {
    const photos: PostMediaDto[] = Array.from({ length: 100 }, (_, index) => ({
      ...photo,
      id: `photo-${index}`,
      url: `https://example.test/foto-${index}.jpg`,
    }));

    await render(<>{photos.map((media) => <PostAttachment key={media.id} media={media} />)}</>);

    // O custo por célula fica no cartão; o PhotoViewer só existe depois do toque.
    expect(mockPhotoViewer).not.toHaveBeenCalled();
    expect(mockViewerLifecycle.mounts).toBe(0);
    expect(screen.getAllByLabelText('Abrir foto em tela cheia')).toHaveLength(100);
  });

  it('carrega uma variante no toque e a entrega ao visualizador', async () => {
    const preview = { width: 400, height: 800 } as unknown as ImageRef;
    mockLoadAsync.mockResolvedValue(preview);
    await render(<PostAttachment media={photo} />);

    // Um cartão da lista não retém bitmap extra nem monta o viewer só por estar visível.
    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(mockPhotoViewer).not.toHaveBeenCalled();
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
    expect(mockViewerLifecycle.mounts).toBe(1);
  });

  it('mede o thumbnail no pressIn e entrega a origem ao visualizador', async () => {
    await render(<PostAttachment media={photo} />);
    await fireEvent(screen.getByTestId('post-photo-image'), 'load');

    const button = screen.getByLabelText('Abrir foto em tela cheia');
    await fireEvent(button, 'pressIn');
    await fireEvent.press(button);

    await waitFor(() => expect(lastViewerProps()).toMatchObject({
      visible: true,
      origin: mockMeasuredOrigin,
    }));
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

    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true, preview: null, origin: null }));
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it('solta o preview ao fechar, mantém o fade e libera o visualizador depois', async () => {
    const preview = { width: 400, height: 800 } as unknown as ImageRef;
    mockLoadAsync.mockResolvedValue(preview);
    const view = await render(<PostAttachment media={photo} />);
    await fireEvent(screen.getByTestId('post-photo-image'), 'load');

    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true, preview }));

    await act(async () => {
      (lastViewerProps().onClose as () => void)();
    });
    // O Modal nativo ainda está no fade de saída: o viewer continua montado,
    // mas já sem a variante reduzida e sem a origem do thumbnail.
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: false, preview: null, origin: null }));
    expect(mockViewerLifecycle.unmounts).toBe(0);

    await waitFor(() => expect(mockViewerLifecycle.unmounts).toBe(1));
    await view.unmount();
  });

  it('reabre durante o fade sem remontar hooks nem perder a transição', async () => {
    await render(<PostAttachment media={photo} />);
    await fireEvent(screen.getByTestId('post-photo-image'), 'load');

    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true }));

    await act(async () => {
      (lastViewerProps().onClose as () => void)();
    });
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: false }));

    // O toque seguinte acontece antes de o timer de 300 ms liberar a montagem.
    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true }));

    expect(mockViewerLifecycle.mounts).toBe(1);
    expect(mockViewerLifecycle.unmounts).toBe(0);
  });

  it('não herda o visualizador aberto quando a célula é reciclada', async () => {
    const view = await render(<PostAttachment media={photo} />);
    await fireEvent(screen.getByTestId('post-photo-image'), 'load');
    await fireEvent.press(screen.getByLabelText('Abrir foto em tela cheia'));
    await waitFor(() => expect(lastViewerProps()).toMatchObject({ visible: true }));

    mockPhotoViewer.mockClear();
    const other: PostMediaDto = {
      ...photo,
      id: 'photo-2',
      url: 'https://example.test/outra.jpg',
    };
    await view.rerender(<PostAttachment media={other} />);

    // A nova mídia começa fechada; a montagem da anterior foi liberada.
    expect(mockPhotoViewer).not.toHaveBeenCalled();
    expect(mockViewerLifecycle.unmounts).toBe(1);
  });
});
