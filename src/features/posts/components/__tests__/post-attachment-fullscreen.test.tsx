import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { VideoThumbnail } from 'expo-video';
import { AppState } from 'react-native';

import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';

import { PostAttachment } from '../post-attachment';
import type { PostMediaDto } from '../../post-media';
import { posterCache } from '../../poster-cache';
import { VIDEO_SURFACE_COVER_TIMEOUT_MS } from '../video-surface';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
jest.mock('expo', () => ({ ...jest.requireActual<typeof import('expo')>('expo'), useEvent: () => ({ status: 'ready' }), useEventListener: () => {} }));
jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const View = jest.requireActual<typeof import('react-native')>('react-native').View;
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});
jest.mock('../photo-viewer', () => ({ PhotoViewer: () => null }));
jest.mock('../video-viewer', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    VideoViewer: (props: {
      visible: boolean;
      poster?: unknown;
      onSurfaceFirstFrame?: () => void;
      onClose: () => void;
    }) => {
      if (!props.visible) return null;
      return React.createElement(View, null,
        props.poster ? React.createElement(View, { testID: 'fullscreen-poster' }) : null,
        React.createElement(Pressable, { testID: 'fullscreen-surface-first-frame', onPress: props.onSurfaceFirstFrame }),
        React.createElement(Pressable, { testID: 'fullscreen-close', onPress: props.onClose }));
    },
  };
});
jest.mock('@/lib/haptics', () => ({ haptic: jest.fn() }));

const mockPause = jest.fn();
const mockPlay = jest.fn();
const mockPlayer = {
  status: 'ready', playing: true, muted: true, playbackRate: 1, currentTime: 0, duration: 15,
  pause: mockPause, play: mockPlay, generateThumbnailsAsync: jest.fn(async () => []),
};
jest.mock('expo-video', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useVideoPlayer: jest.fn(() => mockPlayer),
    VideoView: (props: { onFirstFrameRender?: () => void; accessibilityLabel?: string }) =>
      React.createElement(Pressable, { testID: 'feed-video-surface', onPress: props.onFirstFrameRender, accessibilityLabel: props.accessibilityLabel }),
  };
});

const video: PostMediaDto = {
  id: 'v1',
  type: 'video',
  url: 'https://example.test/v.mp4',
  width: 720,
  height: 1280,
  durationMs: 15000,
  mimeType: 'video/mp4',
  byteSize: 1000,
};

function thumbnail(id: string): VideoThumbnail {
  return { id, width: 320, height: 568, requestedTime: 0, actualTime: 0 } as unknown as VideoThumbnail;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.playing = true;
  posterCache.clear();
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
  jest.mocked(AppState.addEventListener).mockImplementation(() => ({ remove: jest.fn() }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PostAttachment · transição de tela cheia', () => {
  it('mantém o mesmo player e registra entrada, primeiro quadro, saída e volta', async () => {
    posterCache.set(video.id, thumbnail('poster'));
    const view = await render(<PostAttachment media={video} />);

    expect(screen.queryByTestId('video-feed-transition-cover')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Vídeo da publicação, 0:15. Reproduzir'));

    expect(screen.getByTestId('fullscreen-poster')).toBeTruthy();
    expect(screen.queryByTestId('feed-video-surface')).toBeNull();
    expect(getPerformanceSnapshot().video.events.map((event) => event.event)).toContain('fullscreen-enter');

    await fireEvent.press(screen.getByTestId('fullscreen-surface-first-frame'));
    expect(getPerformanceSnapshot().video.events).toContainEqual(
      expect.objectContaining({ event: 'surface-first-frame', surface: 'fullscreen', mediaId: video.id }),
    );

    await fireEvent.press(screen.getByTestId('fullscreen-close'));
    expect(screen.getByTestId('video-feed-transition-cover')).toBeTruthy();
    expect(getPerformanceSnapshot().video.events.map((event) => event.event)).toContain('fullscreen-exit');

    await fireEvent.press(screen.getByTestId('feed-video-surface'));
    expect(screen.queryByTestId('video-feed-transition-cover')).toBeNull();
    expect(getPerformanceSnapshot().video.events).toContainEqual(
      expect.objectContaining({ event: 'surface-first-frame', surface: 'feed', mediaId: video.id }),
    );

    // O mesmo player criado no feed abriu a tela cheia: uma montagem, sem áudio paralelo.
    expect(getPerformanceSnapshot().counters.videoMounts).toBe(1);
    await view.unmount();
  });

  it('solta a cobertura da volta pelo limite quando o feed não emite primeiro quadro', async () => {
    jest.useFakeTimers();
    posterCache.set(video.id, thumbnail('poster'));
    const view = await render(<PostAttachment media={video} />);
    await fireEvent.press(screen.getByLabelText('Vídeo da publicação, 0:15. Reproduzir'));
    await fireEvent.press(screen.getByTestId('fullscreen-close'));

    expect(screen.getByTestId('video-feed-transition-cover')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(VIDEO_SURFACE_COVER_TIMEOUT_MS);
    });

    expect(screen.queryByTestId('video-feed-transition-cover')).toBeNull();
    await view.unmount();
  });

  it('não registra transição quando o vídeo ainda não está tocando', async () => {
    mockPlayer.playing = false;
    const view = await render(<PostAttachment media={video} />);
    await fireEvent.press(screen.getByLabelText('Vídeo da publicação, 0:15. Reproduzir'));

    expect(screen.queryByTestId('fullscreen-surface-first-frame')).toBeNull();
    expect(getPerformanceSnapshot().video.events.map((event) => event.event)).not.toContain('fullscreen-enter');
    await view.unmount();
    mockPlayer.playing = true;
  });
});
