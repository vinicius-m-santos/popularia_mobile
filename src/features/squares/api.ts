import { apiRequest } from '@/lib/api/client';
import type { AuthorDto, PageDto } from '@/lib/api/dto';

export type Sticker = { id: string; packId: string; label: string; symbol: string; tone: 'red' | 'black' | 'cream' };
export type StickerPack = { id: string; name: string; scope: 'popularia' | 'comuna'; stickers: Sticker[] };
export type Reaction = { emoji: string; count: number; mine: boolean };
export type SquareMessage = {
  id: string; squareId: string; status: 'published' | 'deleted' | 'removed' | 'hidden';
  body: string | null; author: AuthorDto | null; sticker: Sticker | null;
  replyTo: { id: string; author: AuthorDto | null; body: string | null; status: string } | null;
  reactions: Reaction[]; createdAt: string; editedAt: string | null; revision: number; clientId: string | null;
  viewer: { isAuthor: boolean; canDelete: boolean; canRemove: boolean; canReport: boolean; canReact: boolean; canReply: boolean };
  pending?: boolean;
};
export type Square = {
  id: string; title: string;
  comuna: { id: string; slug: string; name: string; tone: 'red' | 'black' | 'cream'; visibility: 'public' | 'private' } | null;
  status: 'active' | 'closed' | null; closedAt: string | null; version: number | null;
  presence: number | null; unread: number | null; lastReadId: string | null; lastMessage: SquareMessage | null;
  viewer: { canRead: boolean; isMember: boolean; canWrite: boolean; canManage: boolean; joinRequest: 'pending' | null };
};
export type MessagePage = PageDto<SquareMessage> & { changeCursor: number; hasMoreChanges: boolean; refreshed: SquareMessage[]; square: Square };
export type NewMessage = { body?: string; stickerId?: string; replyToId?: string; clientId: string };
export type SquareReport = { id: string; reason: string; createdAt: string; message: SquareMessage | null };
const path = (id: string) => `/squares/${encodeURIComponent(id)}`;
const messagePath = (id: string, messageId: string) => `${path(id)}/messages/${encodeURIComponent(messageId)}`;

export function listSquares(section: 'mine' | 'discover', cursor: string | null = null) {
  return apiRequest<PageDto<Square>>(`/squares?section=${section}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { auth: true });
}
export function getSquare(id: string) { return apiRequest<Square>(path(id), { auth: true }); }
export function getComunaSquare(slug: string) { return apiRequest<Square>(`/comunas/${encodeURIComponent(slug)}/square`, { auth: true }); }
export function getMessages(id: string, options: { cursor?: string | null; after?: number; refreshIds?: string[] } = {}) {
  const query = [`limit=30`];
  if (options.cursor) query.push(`cursor=${encodeURIComponent(options.cursor)}`);
  if (options.after !== undefined) query.push(`after=${options.after}`);
  if (options.refreshIds?.length) query.push(`refreshIds=${options.refreshIds.map(encodeURIComponent).join(',')}`);
  return apiRequest<MessagePage>(`${path(id)}/messages?${query.join('&')}`, { auth: true });
}
export function sendMessage(id: string, body: NewMessage) { return apiRequest<SquareMessage>(`${path(id)}/messages`, { method: 'POST', body, auth: true }); }
export function deleteMessage(id: string, messageId: string) { return apiRequest(messagePath(id, messageId), { method: 'DELETE', auth: true }); }
export function removeMessage(id: string, messageId: string, reason: string) { return apiRequest(`${messagePath(id, messageId)}/removal`, { method: 'POST', body: { reason }, auth: true }); }
export function reportMessage(id: string, messageId: string, reason: string) { return apiRequest(`${messagePath(id, messageId)}/reports`, { method: 'POST', body: { reason }, auth: true }); }
export function setReaction(id: string, messageId: string, emoji: string, active: boolean) {
  return apiRequest<SquareMessage>(`${messagePath(id, messageId)}/reactions/${encodeURIComponent(emoji)}`, { method: active ? 'PUT' : 'DELETE', auth: true });
}
export function heartbeat(id: string) { return apiRequest<{ count: number; people: AuthorDto[] }>(`${path(id)}/presence`, { method: 'PUT', auth: true }); }
export function getPresence(id: string) { return apiRequest<{ count: number; people: AuthorDto[] }>(`${path(id)}/presence`, { auth: true }); }
export function markRead(id: string, messageId: string) { return apiRequest(`${path(id)}/read`, { method: 'PUT', body: { messageId }, auth: true }); }
export async function getStickerPacks(id: string) { return (await apiRequest<{ items: StickerPack[] }>(`${path(id)}/sticker-packs`, { auth: true })).items; }
export async function addSticker(id: string, body: { label: string; symbol: string; tone: string }) { return (await apiRequest<{ items: StickerPack[] }>(`${path(id)}/stickers`, { method: 'POST', body, auth: true })).items; }
export function deleteSticker(id: string, stickerId: string) { return apiRequest(`${path(id)}/stickers/${encodeURIComponent(stickerId)}`, { method: 'DELETE', auth: true }); }
export function getSquareReports(slug: string, cursor: string | null = null) { return apiRequest<PageDto<SquareReport>>(`/comunas/${encodeURIComponent(slug)}/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { auth: true }); }
export function resolveSquareReport(slug: string, reportId: string, status: 'dismissed' | 'removed') { return apiRequest(`/comunas/${encodeURIComponent(slug)}/reports/${encodeURIComponent(reportId)}`, { method: 'PATCH', body: { status }, auth: true }); }
