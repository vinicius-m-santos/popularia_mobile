import { queryClient } from '@/lib/query/client';

import { putAttendance } from './api';
import { attendeesKey, eventQueryKey } from './types';
import type { AttendanceStatus, ComunaEvent } from './types';

const locks = new Set<string>();

/** Um toque por evento até a resposta voltar. A segunda chamada é ignorada, então não há resposta fora de ordem. */
export function resetAttendanceSession() {
  locks.clear();
}

export function applyAttendance(event: ComunaEvent, status: AttendanceStatus): ComunaEvent {
  let going = event.goingCount;
  let maybe = event.maybeCount;
  if (event.viewerAttendance === 'going') going -= 1;
  if (event.viewerAttendance === 'maybe') maybe -= 1;
  if (status === 'going') going += 1;
  if (status === 'maybe') maybe += 1;
  return { ...event, viewerAttendance: status, goingCount: Math.max(0, going), maybeCount: Math.max(0, maybe) };
}

function replaceEvent(data: unknown, next: ComunaEvent): unknown {
  if (!data || typeof data !== 'object') return data;
  if ('pages' in data && Array.isArray(data.pages)) {
    let changed = false;
    const pages = data.pages.map((page: { items?: ComunaEvent[] }) => {
      if (!page?.items) return page;
      let pageChanged = false;
      const items = page.items.map((item) => {
        if (item?.id !== next.id) return item;
        pageChanged = true;
        return next;
      });
      if (!pageChanged) return page;
      changed = true;
      return { ...page, items };
    });
    return changed ? { ...data, pages } : data;
  }
  if ('items' in data && Array.isArray(data.items)) {
    let changed = false;
    const items = data.items.map((item: ComunaEvent) => {
      if (item?.id !== next.id) return item;
      changed = true;
      return next;
    });
    return changed ? { ...data, items } : data;
  }
  return data;
}

export function writeEvent(next: ComunaEvent) {
  queryClient.setQueryData(eventQueryKey(next.id), next);
  queryClient.setQueriesData({ queryKey: ['comuna-events'] }, (data) => replaceEvent(data, next));
}

/** Criar, editar ou cancelar: o detalhe muda na hora e as listas da comuna são recarregadas. */
export function storeEvent(event: ComunaEvent) {
  writeEvent(event);
  void queryClient.invalidateQueries({ queryKey: ['comuna-events', event.comuna.slug] });
}

export async function setAttendance(event: ComunaEvent, status: AttendanceStatus): Promise<'applied' | 'ignored'> {
  if (locks.has(event.id) || event.viewerAttendance === status || !event.canRespond) return 'ignored';
  locks.add(event.id);
  writeEvent(applyAttendance(event, status));
  try {
    const saved = await putAttendance(event.id, status);
    writeEvent(saved);
    void queryClient.invalidateQueries({ queryKey: attendeesKey(event.id, 'going') });
    void queryClient.invalidateQueries({ queryKey: attendeesKey(event.id, 'maybe') });
    return 'applied';
  } catch (error) {
    writeEvent(event);
    throw error;
  } finally {
    locks.delete(event.id);
  }
}
