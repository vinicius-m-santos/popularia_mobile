import { toUser } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import type { AuthorDto, PageDto } from '@/lib/api/dto';
import { ApiError, NotFoundError } from '@/lib/errors';
import type { Page } from '@/lib/pagination';

import type { AttendanceStatus, ComunaEvent, EventFormat, EventInput, EventLifecycle, EventWhen } from './types';

type EventDto = {
  id: string;
  title: string;
  description: string;
  format: EventFormat;
  status: EventLifecycle;
  timeZone: string;
  startsAt: string;
  endsAt: string | null;
  placeName: string | null;
  address: string | null;
  onlineUrl: string | null;
  comuna: { id: string; slug: string; name: string; visibility: string; status: string };
  organizer: AuthorDto | null;
  goingCount: number;
  maybeCount: number;
  viewerAttendance: AttendanceStatus | null;
  canManage: boolean;
  canRespond: boolean;
  past: boolean;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
};

function toEvent(dto: EventDto): ComunaEvent {
  return { ...dto, organizer: dto.organizer ? toUser(dto.organizer) : null };
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function getEvent(id: string, signal?: AbortSignal): Promise<ComunaEvent> {
  try {
    return toEvent(await apiRequest<EventDto>(`/events/${encodeURIComponent(id)}`, { auth: true, ...(signal ? { signal } : {}) }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new NotFoundError('Evento');
    throw error;
  }
}

export async function listEvents(slug: string, when: EventWhen, cursor: string | null, limit = 20, signal?: AbortSignal): Promise<Page<ComunaEvent>> {
  const page = await apiRequest<PageDto<EventDto>>(`/comunas/${encodeURIComponent(slug)}/events${query({ when, cursor, limit })}`, { auth: true, ...(signal ? { signal } : {}) });
  return { items: page.items.map(toEvent), nextCursor: page.nextCursor };
}

export async function createEvent(slug: string, input: EventInput): Promise<ComunaEvent> {
  return toEvent(await apiRequest<EventDto>(`/comunas/${encodeURIComponent(slug)}/events`, { method: 'POST', body: input, auth: true }));
}

export async function updateEvent(id: string, input: EventInput): Promise<ComunaEvent> {
  return toEvent(await apiRequest<EventDto>(`/events/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: input, auth: true, contentType: 'application/merge-patch+json',
  }));
}

export async function cancelEvent(id: string): Promise<ComunaEvent> {
  return toEvent(await apiRequest<EventDto>(`/events/${encodeURIComponent(id)}/cancel`, { method: 'POST', auth: true }));
}

export async function putAttendance(id: string, status: AttendanceStatus): Promise<ComunaEvent> {
  return toEvent(await apiRequest<EventDto>(`/events/${encodeURIComponent(id)}/attendance`, { method: 'PUT', body: { status }, auth: true }));
}

export async function listAttendees(id: string, status: 'going' | 'maybe', cursor: string | null, signal?: AbortSignal): Promise<Page<AuthorDto>> {
  try {
    return await apiRequest<PageDto<AuthorDto>>(`/events/${encodeURIComponent(id)}/attendees${query({ status, cursor, limit: 20 })}`, { auth: true, ...(signal ? { signal } : {}) });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new NotFoundError('Evento');
    throw error;
  }
}
