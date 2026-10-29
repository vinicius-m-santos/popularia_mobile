import type { MessagePage, Square, SquareMessage, Sticker } from '../api';
export const sticker: Sticker = { id: 'st1', packId: 'pack1', label: 'BORA!', symbol: '📢', tone: 'red' };
export const author = { id: 'user1', handle: 'marina', displayName: 'Marina' };
export function square(patch: Partial<Square> = {}): Square {
  return { id: 'square1', title: 'Trabalhadores de TI', comuna: { id: 'c1', slug: 'ti', name: 'Trabalhadores de TI', tone: 'red', visibility: 'public', topics: ['tec', 'trab'] }, status: 'active', closedAt: null, version: 1, presence: 2, unread: 1, lastReadId: null, lastMessage: null, viewer: { canRead: true, isMember: true, canWrite: true, canManage: false, joinRequest: null }, ...patch };
}
export function message(id = 'm002', patch: Partial<SquareMessage> = {}): SquareMessage {
  return { id, squareId: 'square1', status: 'published', body: 'Vamos conversar', author, sticker: null, replyTo: null, reactions: [], createdAt: '2026-10-26T14:00:00Z', editedAt: null, revision: 1, clientId: null, viewer: { isAuthor: false, canDelete: false, canRemove: false, canReport: true, canReact: true, canReply: true }, ...patch };
}
export function page(items = [message()], patch: Partial<MessagePage> = {}): MessagePage {
  return { items, nextCursor: null, changeCursor: 1, hasMoreChanges: false, refreshed: [], square: square(), ...patch };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
