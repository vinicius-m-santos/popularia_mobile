/**
 * POP-20: o cartão só monta o player quando a lista confirma que ele está na viewport.
 *
 * A lista de tópicos e a de salvos passam `mediaVisible` por `postId`; aqui medimos
 * o efeito no cartão real: nenhum player fora da viewport, no máximo um tocando e
 * o player desmontado ao rolar para fora.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useVideoPlayer } from 'expo-video';
import { AppState, ScrollView } from 'react-native';

import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';
import type { FeedItem } from '@/types/models';

import { PostCard } from '../post-card';

type MockPlayer = {
  status: string;
  playing: boolean;
  muted: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
  play: jest.Mock;
  pause: jest.Mock;
  generateThumbnailsAsync: jest.Mock;
  onPlayingChange?: (isPlaying: boolean) => void;
};

const store = globalThis as { __postCardPlayers?: MockPlayer[] };

jest.mock('expo-video', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    useVideoPlayer: jest.fn((_source: unknown, setup?: (player: MockPlayer) => void) => {
      const ref = React.useRef<MockPlayer | null>(null);
      if (!ref.current) {
        const player: MockPlayer = {
          status: 'ready',
          playing: false,
          muted: true,
          playbackRate: 1,
          currentTime: 0,
          duration: 15,
          play: jest.fn(),
          pause: jest.fn(),
          generateThumbnailsAsync: jest.fn(async () => []),
        };
        player.play.mockImplementation(() => {
          player.playing = true;
          player.onPlayingChange?.(true);
        });
        player.pause.mockImplementation(() => {
          player.playing = false;
          player.onPlayingChange?.(false);
        });
        ref.current = player;
        const globalStore = globalThis as { __postCardPlayers?: MockPlayer[] };
        if (!globalStore.__postCardPlayers) globalStore.__postCardPlayers = [];
        globalStore.__postCardPlayers.push(player);
        setup?.(player);
      }
      return ref.current;
    }),
    VideoView: View,
  };
});

jest.mock('expo', () => ({
  ...jest.requireActual<typeof import('expo')>('expo'),
  useEvent: () => ({ status: 'ready' }),
  useEventListener: (player: MockPlayer, event: string, callback: (payload: { isPlaying: boolean }) => void) => {
    if (event === 'playingChange') player.onPlayingChange = (isPlaying) => callback({ isPlaying });
  },
}));

jest.mock('../photo-viewer', () => ({ PhotoViewer: () => null }));
jest.mock('../video-viewer', () => ({ VideoViewer: () => null }));
jest.mock('@/features/interactions/use-post-actions', () => ({
  usePostActions: () => ({
    supportCount: 0,
    supported: false,
    commentCount: 0,
    echoCount: 0,
    echoed: false,
    saved: false,
    toggleSupport: jest.fn(),
    toggleEcho: jest.fn(),
    toggleSave: jest.fn(),
  }),
}));
jest.mock('@/features/interactions/interactions-context', () => ({
  useInteractions: () => ({ isOn: () => false }),
}));
jest.mock('@/features/moderation/actions-sheet', () => ({ useActionsSheet: () => ({ open: jest.fn() }) }));
jest.mock('@/lib/routes', () => ({
  useNav: () => ({
    openPost: jest.fn(),
    openProfile: jest.fn(),
    openComuna: jest.fn(),
    openHashtag: jest.fn(),
    openRelations: jest.fn(),
  }),
}));
jest.mock('@/features/posts/queries', () => ({ preparePost: jest.fn() }));
jest.mock('@/features/account/account-context', () => ({
  useMe: () => ({ id: 'me' }),
  useAccount: () => ({ account: { id: 'me' } }),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

function video(id: string, durationMs: number): FeedItem {
  return {
    id,
    authorId: 'ana',
    comunaId: null,
    createdAt: '2026-10-29T12:00:00Z',
    text: '',
    attachment: {
      id: `media-${id}`,
      type: 'video',
      mimeType: 'video/mp4',
      byteSize: 1_000,
      width: 720,
      height: 1280,
      durationMs,
      url: `https://example.test/${id}.mp4`,
    },
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, saved: false },
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comuna: null,
    event: null,
    topCommentAuthor: null,
  };
}

const VIDEOS = [video('v1', 15_000), video('v2', 16_000), video('v3', 17_000)];

function Harness({ visibleIds }: { visibleIds: ReadonlySet<string> }) {
  return (
    <ScrollView>
      {VIDEOS.map((item) => (
        <PostCard key={item.id} item={item} mediaVisible={visibleIds.has(item.id)} />
      ))}
    </ScrollView>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  store.__postCardPlayers = [];
  // O preset do React Native entrega `currentState` como mock de função; aqui ele
  // representa o app em primeiro plano, como no aparelho.
  AppState.currentState = 'active';
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
});

afterEach(() => {
  AppState.currentState = 'active';
  setPerformanceInstrumentationOverride(null);
});

describe('mídia do PostCard na viewport', () => {
  it('com mediaVisible falso mantém o pôster e não chama o player', async () => {
    await render(<PostCard item={VIDEOS[0]} mediaVisible={false} />);

    expect(useVideoPlayer).not.toHaveBeenCalled();
    expect(screen.getByText('0:15')).toBeTruthy();
    expect(getPerformanceSnapshot().video.mountedNow).toBe(0);
  });

  it('tem false como default seguro para cartões sem viewability', async () => {
    await render(<PostCard item={VIDEOS[0]} />);

    expect(useVideoPlayer).not.toHaveBeenCalled();
    expect(getPerformanceSnapshot().video.mountedNow).toBe(0);
  });

  it('monta um player por vez e desmonta ao rolar para fora', async () => {
    const view = await render(<Harness visibleIds={new Set()} />);
    expect(useVideoPlayer).not.toHaveBeenCalled();
    expect(getPerformanceSnapshot().video.mountedNow).toBe(0);

    await view.rerender(<Harness visibleIds={new Set(['v1'])} />);
    await waitFor(() => expect(store.__postCardPlayers).toHaveLength(1));
    expect(getPerformanceSnapshot().video.mountedNow).toBe(1);
    expect(getPerformanceSnapshot().video.playingNow).toBe(1);
    expect(screen.getByLabelText('Vídeo da publicação, 0:15')).toBeTruthy();

    await view.rerender(<Harness visibleIds={new Set(['v2'])} />);
    await waitFor(() => expect(store.__postCardPlayers).toHaveLength(2));
    expect(getPerformanceSnapshot().video.mountedNow).toBe(1);
    expect(getPerformanceSnapshot().video.playingNow).toBe(1);
    expect(screen.queryByLabelText('Vídeo da publicação, 0:15')).toBeNull();
    expect(screen.getByLabelText('Vídeo da publicação, 0:16')).toBeTruthy();
  });

  it.each(['background', 'inactive'] as const)('não reproduz com o app em %s', async (state) => {
    AppState.currentState = state;
    await render(<PostCard item={VIDEOS[0]} mediaVisible />);

    const players = store.__postCardPlayers ?? [];
    expect(players).toHaveLength(1);
    expect(players[0].play).not.toHaveBeenCalled();
  });

  it('com três vídeos na viewport mantém no máximo um reproduzindo', async () => {
    await render(<Harness visibleIds={new Set(VIDEOS.map((item) => item.id))} />);
    await waitFor(() => expect(store.__postCardPlayers).toHaveLength(3));

    const players = store.__postCardPlayers ?? [];
    expect(players).toHaveLength(3);
    expect(players.filter((player) => player.playing)).toHaveLength(1);
    expect(players[2].playing).toBe(true);
    expect(players[0].pause).toHaveBeenCalled();
    expect(players[1].pause).toHaveBeenCalled();
    expect(getPerformanceSnapshot().video.mountedNow).toBe(3);
    expect(getPerformanceSnapshot().video.playingNow).toBe(1);
  });
});
