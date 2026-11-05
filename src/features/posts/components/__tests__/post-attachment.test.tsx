import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useVideoPlayer, type VideoThumbnail } from 'expo-video';
import { PostAttachment } from '../post-attachment';
import type { PostMediaDto } from '../../post-media';
import { posterCache } from '../../poster-cache';

// O visualizador de foto carrega reanimated: fora do escopo deste teste, que é só vídeo.
jest.mock('../photo-viewer', () => ({ PhotoViewer: () => null }));
jest.mock('../video-viewer', () => ({ VideoViewer: () => null }));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
jest.mock('expo', () => ({ ...jest.requireActual<typeof import('expo')>('expo'), useEvent: () => ({ status: 'ready' }), useEventListener: () => {} }));
const mockPause = jest.fn();
const mockPlay = jest.fn();
const mockGenerateThumbnails = jest.fn<() => Promise<VideoThumbnail[]>>(async () => []);
const mockPlayer = {
  status: 'ready', playing: false, muted: true, playbackRate: 1, currentTime: 0,
  pause: mockPause, play: mockPlay, generateThumbnailsAsync: mockGenerateThumbnails,
};
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => mockPlayer),
  VideoView: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const video: PostMediaDto = { id: 'v1', type: 'video', url: 'https://example.test/v.mp4', width: 720, height: 1280, durationMs: 15000, mimeType: 'video/mp4', byteSize: 1000 };
function thumbnail(id: string): VideoThumbnail {
  return { id, width: 320, height: 568, requestedTime: 0, actualTime: 0 } as unknown as VideoThumbnail;
}
beforeEach(() => {
  jest.clearAllMocks();
  posterCache.clear();
  mockGenerateThumbnails.mockResolvedValue([]);
  jest.mocked(AppState.addEventListener).mockImplementation(() => ({ remove: jest.fn() }));
});

describe('vídeo em listas', () => {
  it('toca ao entrar na viewport, muta por padrão e pausa em background', async () => {
    const listener = jest.mocked(AppState.addEventListener);
    const view = await render(<PostAttachment media={video} />);
    expect(useVideoPlayer).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalled();
    expect(screen.getByLabelText('Vídeo da publicação, 0:15')).toBeTruthy();
    expect(screen.getByLabelText('Ativar som')).toBeTruthy();
    const index = listener.mock.calls.findIndex(([event]) => event === 'change');
    const subscription = listener.mock.results[index].value as ReturnType<typeof AppState.addEventListener>;
    const remove = jest.spyOn(subscription, 'remove');
    await act(() => listener.mock.calls[index][1]('background'));
    expect(mockPause).toHaveBeenCalled();
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('libera o player fora da viewport', async () => {
    const view = await render(<PostAttachment media={video} />);
    jest.mocked(useVideoPlayer).mockClear();
    await view.rerender(<PostAttachment media={video} visible={false} />);
    expect(screen.queryByLabelText('Vídeo da publicação, 0:15')).toBeNull();
    expect(useVideoPlayer).not.toHaveBeenCalled();
  });

  it('alterna o som pelo botão sobre o vídeo', async () => {
    await render(<PostAttachment media={video} />);
    await fireEvent.press(screen.getByLabelText('Ativar som'));
    expect(screen.getByLabelText('Silenciar vídeo')).toBeTruthy();
    expect(mockPlayer.muted).toBe(false);
    await fireEvent.press(screen.getByLabelText('Silenciar vídeo'));
    expect(screen.getByLabelText('Ativar som')).toBeTruthy();
    expect(mockPlayer.muted).toBe(true);
  });

  it('usa o pôster em cache sem gerar de novo e o mantém fora da viewport', async () => {
    const poster = thumbnail('p1');
    posterCache.set(video.id, poster);

    const view = await render(<PostAttachment media={video} />);
    expect(mockGenerateThumbnails).not.toHaveBeenCalled();
    expect(posterCache.stats().hits).toBeGreaterThanOrEqual(1);

    await view.rerender(<PostAttachment media={video} visible={false} />);
    expect(screen.queryByLabelText('Foto: Vídeo da publicação')).toBeNull();
  });

  it('não herda o pôster da mídia anterior quando a célula é reciclada', async () => {
    posterCache.set(video.id, thumbnail('p1'));
    const view = await render(<PostAttachment media={video} visible={false} />);
    expect(screen.queryByLabelText('Foto: Vídeo da publicação')).toBeNull();

    const other: PostMediaDto = { ...video, id: 'v2', url: 'https://example.test/v2.mp4' };
    await view.rerender(<PostAttachment media={other} visible={false} />);
    expect(screen.getByLabelText('Foto: Vídeo da publicação')).toBeTruthy();
  });

  it('mantém o vídeo disponível quando a geração do pôster falha', async () => {
    mockGenerateThumbnails.mockRejectedValueOnce(new Error('sem quadro'));
    await render(<PostAttachment media={video} />);

    await waitFor(() => expect(posterCache.stats().generationFailures).toBeGreaterThanOrEqual(1));
    expect(screen.getByLabelText('Vídeo da publicação, 0:15')).toBeTruthy();
    expect(posterCache.stats().size).toBe(0);
  });

  it('tenta uma vez de novo quando a geração compartilhada falha', async () => {
    mockGenerateThumbnails
      .mockRejectedValueOnce(new Error('player liberado'))
      .mockResolvedValueOnce([thumbnail('retry')]);
    const before = posterCache.stats();
    const view = await render(<>
      <PostAttachment media={video} />
      <PostAttachment media={video} />
    </>);

    await waitFor(() => expect(mockGenerateThumbnails).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(posterCache.stats().size).toBe(1));
    const after = posterCache.stats();
    expect(after.generationRequests - before.generationRequests).toBe(2);
    expect(after.generationFailures - before.generationFailures).toBe(1);
    expect(after.dedupedGenerations - before.dedupedGenerations).toBe(1);
    expect(after.stores - before.stores).toBe(1);

    // A tentativa extra não abre um ciclo: nenhuma terceira chamada.
    await act(async () => { await Promise.resolve(); });
    expect(mockGenerateThumbnails).toHaveBeenCalledTimes(2);
    await view.unmount();
  });

  it('não repete a geração compartilhada mais de uma vez', async () => {
    mockGenerateThumbnails
      .mockRejectedValueOnce(new Error('primeira falha'))
      .mockRejectedValueOnce(new Error('segunda falha'));
    const view = await render(<>
      <PostAttachment media={video} />
      <PostAttachment media={video} />
    </>);

    await waitFor(() => expect(mockGenerateThumbnails).toHaveBeenCalledTimes(2));
    await act(async () => { await Promise.resolve(); });
    expect(mockGenerateThumbnails).toHaveBeenCalledTimes(2);
    expect(posterCache.stats().size).toBe(0);
    await view.unmount();
  });

  it('compartilha uma geração concorrente entre duas instâncias da mesma mídia', async () => {
    let resolve!: (thumbnails: VideoThumbnail[]) => void;
    mockGenerateThumbnails.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const view = await render(<>
      <PostAttachment media={video} />
      <PostAttachment media={video} />
    </>);

    await waitFor(() => expect(mockGenerateThumbnails).toHaveBeenCalledTimes(1));
    await act(async () => { resolve([thumbnail('p2')]); });
    await waitFor(() => expect(posterCache.stats().stores).toBeGreaterThanOrEqual(1));
    expect(posterCache.stats().dedupedGenerations).toBeGreaterThanOrEqual(1);
    await view.unmount();
  });
});
