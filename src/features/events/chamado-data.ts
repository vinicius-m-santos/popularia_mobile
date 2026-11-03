import { findUsers } from '@/features/lookup';

import type { ChamadoCardData } from './chamado-card';
import { deviceTimeZone, splitCallDetails } from './format';

import type { FeedItem } from '@/types/models';

/**
 * Resolve o cartão de chamado de uma publicação, venha ele dos mocks (`event`)
 * ou da API (`linkedEvent`). A imagem anexada à publicação é a capa do chamado;
 * sem ela, vale a capa ilustrada do evento fictício.
 */
export function chamadoCardFor(item: FeedItem): ChamadoCardData | null {
  const mock = item.event;
  const linked = item.linkedEvent;
  if (!mock && !linked) return null;

  const legacy = splitCallDetails(item.text ?? '');
  const attachment = item.attachment?.type === 'image' ? item.attachment.url : null;
  const cover = attachment ? { uri: attachment } : mock?.cover ?? null;
  const viewerAttendance = linked?.viewerAttendance;

  return {
    id: mock?.id ?? linked!.id,
    title: mock?.title ?? linked!.title,
    description: legacy.text || mock?.description || '',
    startsAt: mock?.startsAt ?? linked!.startsAt,
    endsAt: linked?.endsAt ?? null,
    timeZone: mock?.timeZone ?? linked?.timeZone ?? deviceTimeZone() ?? 'America/Sao_Paulo',
    placeName: mock?.place ?? linked?.placeName ?? null,
    address: linked?.address ?? mock?.address ?? null,
    cover,
    coverFit: mock?.coverFit ?? 'cover',
    capacityMode: linked?.capacityMode ?? mock?.capacityMode ?? legacy.capacityMode,
    capacity: linked?.capacity ?? mock?.capacity ?? legacy.capacity,
    goingCount: mock?.attendeeCount ?? linked!.goingCount,
    maybeCount: mock?.maybeCount ?? linked?.maybeCount ?? 0,
    goingUsers: mock ? findUsers(mock.goingIds ?? []) : linked?.goingPreview ?? [],
    viewerAttendance: viewerAttendance === 'going' || viewerAttendance === 'maybe' ? viewerAttendance : null,
    past: linked?.past ?? false,
    cancelled: linked?.status === 'cancelled',
  };
}
