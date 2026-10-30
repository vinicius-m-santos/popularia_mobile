import { DEMO_MODE } from '@/constants/config';
import { toFeedItems } from '@/features/lookup';
import { tokenizePostText } from '@/features/hashtags/text';
import { toFeedItem } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import type { PageDto, PostDto } from '@/lib/api/dto';
import type { Page } from '@/lib/pagination';
import { posts } from '@/mocks/posts';
import type { FeedItem } from '@/types/models';

export type TopicInfo = { slug: string; displayName: string };

function demoMatches(slug: string): FeedItem[] {
  return toFeedItems(posts).filter((post) => tokenizePostText(post.text, post.mentions).some((token) => token.hashtag === slug));
}

export async function getTopicInfo(slug: string, signal?: AbortSignal): Promise<TopicInfo> {
  if (DEMO_MODE) {
    const first = demoMatches(slug)[0];
    const token = first && tokenizePostText(first.text, first.mentions).find((item) => item.hashtag === slug);
    return { slug, displayName: token?.label.slice(1) ?? slug };
  }
  return apiRequest<TopicInfo>(`/topics/${encodeURIComponent(slug)}`, { auth: true, ...(signal ? { signal } : {}) });
}

export async function listTopicPosts(slug: string, cursor: string | null, signal?: AbortSignal): Promise<Page<FeedItem>> {
  if (DEMO_MODE) {
    const start = cursor ? Number(cursor) : 0;
    const items = demoMatches(slug);
    return { items: items.slice(start, start + 20), nextCursor: start + 20 < items.length ? String(start + 20) : null };
  }
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const page = await apiRequest<PageDto<PostDto>>(`/topics/${encodeURIComponent(slug)}/posts${params.size ? `?${params}` : ''}`, { auth: true, ...(signal ? { signal } : {}) });
  return { items: page.items.map(toFeedItem), nextCursor: page.nextCursor };
}
