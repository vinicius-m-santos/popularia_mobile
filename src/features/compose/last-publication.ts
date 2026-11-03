import type { FeedItem } from '@/types/models';

/** Última publicação da sessão, usada pela tela de finalização sem refazer a chamada. */
let last: FeedItem | null = null;

export function setLastPublication(post: FeedItem | null) { last = post; }
export function getLastPublication(): FeedItem | null { return last; }
