import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import { PostAttachment } from '../post-attachment';
import type { PostMediaDto } from '../../post-media';

// O visualizador de foto carrega reanimated: fora do escopo deste teste, que é só vídeo.
jest.mock('../photo-viewer', () => ({ PhotoViewer: () => null }));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
jest.mock('expo', () => ({ ...jest.requireActual<typeof import('expo')>('expo'), useEvent: () => ({ status: 'ready' }), useEventListener: () => {} }));
const mockPause = jest.fn();
const mockPlay = jest.fn();
const mockPlayer = {
  status: 'ready', playing: false, muted: true, playbackRate: 1, currentTime: 0,
  pause: mockPause, play: mockPlay, generateThumbnailsAsync: async () => [],
};
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => mockPlayer),
  VideoView: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const video: PostMediaDto = { id: 'v1', type: 'video', url: 'https://example.test/v.mp4', width: 720, height: 1280, durationMs: 15000, mimeType: 'video/mp4', byteSize: 1000 };
beforeEach(() => {
  jest.clearAllMocks();
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
});
