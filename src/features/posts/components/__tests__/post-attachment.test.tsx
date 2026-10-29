import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useVideoPlayer } from 'expo-video';
import { PostAttachment } from '../post-attachment';
import type { PostMediaDto } from '../../post-media';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
jest.mock('expo', () => ({ ...jest.requireActual<typeof import('expo')>('expo'), useEvent: () => ({ status: 'ready' }), useEventListener: () => {} }));
const mockPause = jest.fn();
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => ({ status: 'ready', pause: mockPause })),
  VideoView: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const video: PostMediaDto = { id: 'v1', type: 'video', url: 'https://example.test/v.mp4', width: 720, height: 1280, durationMs: 15000, mimeType: 'video/mp4', byteSize: 1000 };
beforeEach(() => { jest.clearAllMocks(); });

describe('vídeo em listas', () => {
  it('não inicializa player até a intenção de reprodução', async () => {
    await render(<PostAttachment media={video} />);
    expect(useVideoPlayer).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button'));
    expect(useVideoPlayer).toHaveBeenCalledTimes(1);
  });
  it('remove player fora da viewport e não reutiliza intenção para outro vídeo', async () => {
    const view = await render(<PostAttachment media={video} />);
    await fireEvent.press(screen.getByRole('button'));
    await view.rerender(<PostAttachment media={video} visible={false} />);
    expect(screen.queryByLabelText('Vídeo da publicação, 0:15')).toBeNull();
    expect(screen.getByRole('button')).toBeTruthy();
    jest.mocked(useVideoPlayer).mockClear();
    await view.rerender(<PostAttachment media={{ ...video, id: 'v2', url: 'https://example.test/other.mp4' }} />);
    expect(useVideoPlayer).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
