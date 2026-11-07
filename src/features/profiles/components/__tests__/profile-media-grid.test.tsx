import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { preparePost } from '@/features/posts/queries';
import type { FeedItem } from '@/types/models';

import { mediaGridData, ProfileMediaGrid } from '../profile-media-grid';

jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: View };
});
jest.mock('@/features/posts/queries', () => ({ preparePost: jest.fn() }));

function imagePost(): FeedItem {
  return {
    id: 'post-1',
    authorId: 'ana',
    comunaId: null,
    createdAt: '2026-10-29T12:00:00Z',
    text: 'Foto',
    attachment: {
      id: 'media-1',
      type: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1_000,
      width: 800,
      height: 800,
      durationMs: 0,
      url: 'https://example.test/foto.jpg',
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

function videoPost(): FeedItem {
  return {
    ...imagePost(),
    id: 'post-2',
    attachment: {
      id: 'media-2',
      type: 'video',
      mimeType: 'video/mp4',
      byteSize: 2_000,
      width: 720,
      height: 1280,
      durationMs: 3_000,
      url: 'https://example.test/video.mp4',
    },
  };
}

function textPost(): FeedItem {
  return { ...imagePost(), id: 'post-3', attachment: null };
}

beforeEach(() => { jest.clearAllMocks(); });

describe('dados da grade de mídia', () => {
  it('separa fotos e vídeos em uma passada e conta cada tipo', () => {
    const posts = [imagePost(), videoPost(), textPost()];
    const data = mediaGridData(posts);
    expect(data.posts.map((post) => post.id)).toEqual(['post-1', 'post-2']);
    expect(data.counts).toEqual({ total: 2, photos: 1, videos: 1 });
  });

  it('reaproveita o resultado para a mesma lista e não inventa contagens vazias', () => {
    const posts = [imagePost()];
    expect(mediaGridData(posts)).toBe(mediaGridData(posts));
    expect(mediaGridData([]).counts).toBeUndefined();
  });
});

describe('prefetch da grade de mídia', () => {
  it('antecipa no pressIn e não repete a preparação no press', async () => {
    const onOpen = jest.fn();
    await render(<ProfileMediaGrid posts={[imagePost()]} onOpen={onOpen} />);

    const tile = screen.getByLabelText('Abrir imagem');
    await fireEvent(tile, 'pressIn');
    expect(preparePost).toHaveBeenCalledTimes(1);

    await fireEvent.press(tile);
    expect(preparePost).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('post-1');
  });
});
