import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { VideoThumbnail } from 'expo-video';
import type { ComponentProps } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { resetReducedMotionCache } from '@/hooks/use-reduced-motion';
import { VIDEO_VIEWER_RETURN_TIMING, VideoViewer } from '../video-viewer';
import { VIDEO_SURFACE_COVER_TIMEOUT_MS } from '../video-surface';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const View = jest.requireActual<typeof import('react-native')>('react-native').View;
  return {
    Image: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const View = jest.requireActual<typeof import('react-native')>('react-native').View;
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: View,
    usePanGesture: () => ({ type: 'pan' }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const poster = { uri: 'poster' } as unknown as VideoThumbnail;
const player = {} as ComponentProps<typeof VideoViewer>['player'];

function FakeVideoView({ onFirstFrameRender, ...props }: ComponentProps<typeof View> & { onFirstFrameRender?: () => void }) {
  return <View testID="video-surface" onLayout={onFirstFrameRender} {...props} />;
}

function renderViewer(overrides: Partial<ComponentProps<typeof VideoViewer>> = {}) {
  return render(
    <VideoViewer
      visible
      surfaceKey={0}
      player={player}
      VideoView={FakeVideoView as unknown as ComponentProps<typeof VideoViewer>['VideoView']}
      label="Vídeo da publicação"
      remaining="0:15"
      playing
      ended={false}
      muted
      holding={false}
      poster={poster}
      onClose={() => {}}
      onTogglePlay={() => {}}
      onToggleMute={() => {}}
      onHoldStart={() => {}}
      onHoldEnd={() => {}}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  resetReducedMotionCache();
  jest.restoreAllMocks();
});

describe('VideoViewer · acessibilidade e movimento', () => {
  it('consulta o Reduce Motion no retorno do arrasto e desliga o fade do modal', async () => {
    expect(VIDEO_VIEWER_RETURN_TIMING).toEqual({ duration: 180, reduceMotion: 'system' });
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderViewer();

    await waitFor(() => expect(screen.getByTestId('video-viewer-modal').props.animationType).toBe('none'));
    expect(screen.getByTestId('video-viewer-root').props.accessibilityViewIsModal).toBe(true);
  });
});

describe('VideoViewer · segurar para 2×', () => {
  it('ativa e desativa o 2× no long press voluntário', async () => {
    const onHoldStart = jest.fn();
    const onHoldEnd = jest.fn();
    await renderViewer({ onHoldStart, onHoldEnd });
    const target = screen.getByLabelText('Vídeo da publicação. Pausar');

    await fireEvent(target, 'pressIn', { nativeEvent: { pageX: 10, pageY: 10 } });
    await fireEvent(target, 'longPress');

    expect(onHoldStart).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Reprodução em 2×')).toBeTruthy();

    await fireEvent(target, 'pressOut');

    expect(onHoldEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Reprodução em 2×')).toBeNull();
  });

  it('não ativa o 2× quando o toque vira arrasto lento', async () => {
    const onHoldStart = jest.fn();
    await renderViewer({ onHoldStart });
    const target = screen.getByLabelText('Vídeo da publicação. Pausar');

    await fireEvent(target, 'pressIn', { nativeEvent: { pageX: 10, pageY: 10 } });
    await fireEvent(target, 'touchMove', { nativeEvent: { pageX: 10, pageY: 40 } });
    await fireEvent(target, 'longPress');

    expect(onHoldStart).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Reprodução em 2×')).toBeNull();
  });

  it('encerra o 2× se o arrasto começar depois do long press', async () => {
    const onHoldEnd = jest.fn();
    await renderViewer({ onHoldEnd });
    const target = screen.getByLabelText('Vídeo da publicação. Pausar');

    await fireEvent(target, 'pressIn', { nativeEvent: { pageX: 10, pageY: 10 } });
    await fireEvent(target, 'longPress');
    expect(screen.getByLabelText('Reprodução em 2×')).toBeTruthy();

    await fireEvent(target, 'pressMove', { nativeEvent: { pageX: 10, pageY: 50 } });

    expect(onHoldEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Reprodução em 2×')).toBeNull();
  });

  it('mantém o toque de pausar e os controles', async () => {
    const onTogglePlay = jest.fn();
    const onToggleMute = jest.fn();
    const onClose = jest.fn();
    await renderViewer({ onTogglePlay, onToggleMute, onClose });

    await fireEvent.press(screen.getByLabelText('Vídeo da publicação. Pausar'));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Ativar som'));
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Fechar vídeo'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('VideoViewer · troca de surface', () => {
  it('cobre a nova surface com o pôster até o primeiro quadro chegar', async () => {
    const onSurfaceFirstFrame = jest.fn();
    await renderViewer({ onSurfaceFirstFrame });

    expect(screen.getByTestId('video-fullscreen-cover')).toBeTruthy();
    await fireEvent(screen.getByTestId('video-surface'), 'layout', { nativeEvent: { layout: { width: 1, height: 1 } } });

    expect(screen.queryByTestId('video-fullscreen-cover')).toBeNull();
    expect(onSurfaceFirstFrame).toHaveBeenCalledTimes(1);
  });

  it('recobre a surface quando o visualizador é reaberto', async () => {
    const view = await renderViewer();
    await fireEvent(screen.getByTestId('video-surface'), 'layout', { nativeEvent: { layout: { width: 1, height: 1 } } });
    expect(screen.queryByTestId('video-fullscreen-cover')).toBeNull();

    await view.rerender(
      <VideoViewer
        visible={false}
        surfaceKey={0}
        player={player}
        VideoView={FakeVideoView as unknown as ComponentProps<typeof VideoViewer>['VideoView']}
        label="Vídeo da publicação"
        remaining="0:15"
        playing
        ended={false}
        muted
        holding={false}
        poster={poster}
        onClose={() => {}}
        onTogglePlay={() => {}}
        onToggleMute={() => {}}
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    await view.rerender(
      <VideoViewer
        visible
        surfaceKey={1}
        player={player}
        VideoView={FakeVideoView as unknown as ComponentProps<typeof VideoViewer>['VideoView']}
        label="Vídeo da publicação"
        remaining="0:15"
        playing
        ended={false}
        muted
        holding={false}
        poster={poster}
        onClose={() => {}}
        onTogglePlay={() => {}}
        onToggleMute={() => {}}
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );

    expect(screen.getByTestId('video-fullscreen-cover')).toBeTruthy();
  });

  it('solta a cobertura pelo limite quando a plataforma não emite o primeiro quadro', async () => {
    jest.useFakeTimers();
    await renderViewer();

    expect(screen.getByTestId('video-fullscreen-cover')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(VIDEO_SURFACE_COVER_TIMEOUT_MS);
    });

    expect(screen.queryByTestId('video-fullscreen-cover')).toBeNull();
  });

  it('não cobre quando ainda não há pôster conhecido', async () => {
    await renderViewer({ poster: null });
    expect(screen.queryByTestId('video-fullscreen-cover')).toBeNull();
  });
});
