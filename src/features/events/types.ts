import type { User } from '@/types/models';

export type EventFormat = 'in_person' | 'online' | 'hybrid';
export type EventLifecycle = 'scheduled' | 'cancelled';
export type AttendanceStatus = 'going' | 'maybe' | 'not_going';
export type EventWhen = 'upcoming' | 'past';

export type ComunaEvent = {
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
  organizer: User | null;
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

export type EventInput = {
  title: string;
  description: string;
  format: EventFormat;
  placeName: string | null;
  address: string | null;
  onlineUrl: string | null;
  timeZone: string;
  startsAt: string;
  endsAt: string | null;
};

export type EventDraft = {
  title: string;
  description: string;
  format: EventFormat;
  placeName: string;
  address: string;
  onlineUrl: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  timeZone: string;
};

export const eventQueryKey = (id: string) => ['event', id] as const;
export const comunaEventsKey = (slug: string, when: EventWhen | 'preview') => ['comuna-events', slug, when] as const;
export const attendeesKey = (id: string, status: 'going' | 'maybe') => ['event-attendees', id, status] as const;
