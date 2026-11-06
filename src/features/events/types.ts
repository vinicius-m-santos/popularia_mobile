import { queryKeys } from '@/lib/query/keys';
import type { EventCapacityMode, User } from '@/types/models';

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
  comuna: { id: string; slug: string; name: string; visibility: string; status: string } | null;
  organizer: User | null;
  goingCount: number;
  maybeCount: number;
  viewerAttendance: AttendanceStatus | null;
  /** "spots" (vagas) ou "goal" (meta mínima); nulo é entrada livre. */
  capacityMode?: EventCapacityMode | null;
  capacity?: number | null;
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
  capacityMode?: EventCapacityMode | null;
  capacity?: number | null;
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

export const eventQueryKey = (id: string) => queryKeys.event.detail(id);
export const comunaEventsKey = (slug: string, when: EventWhen | 'preview') => queryKeys.comuna.events(slug, when);
export const attendeesKey = (id: string, status: 'going' | 'maybe') => queryKeys.event.attendees(id, status);
