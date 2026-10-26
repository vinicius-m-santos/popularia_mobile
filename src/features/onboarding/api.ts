/** Dados do cadastro inicial: assuntos e checagem de nome de usuário. */
import { DEMO_MODE } from '@/constants/config';
import { isHandleAvailable } from '@/features/account/api';
import { apiRequest } from '@/lib/api/client';
import { mockDelay } from '@/lib/mock-delay';
import { topicGroups } from '@/mocks/topics';
import { users } from '@/mocks/users';
import type { TopicGroup, TopicId } from '@/types/models';

/** Nomes que o sistema reserva no modo demonstração (o servidor tem a própria lista). */
const RESERVED_HANDLES = ['popularia', 'admin', 'moderacao'];

type TopicDto = { id: TopicId; label: string; shortLabel: string; group: string };

/** Assuntos agrupados como nas telas. Com a API, vêm de GET /topics (mesmos códigos). */
export async function getTopicGroups(): Promise<TopicGroup[]> {
  if (DEMO_MODE) return mockDelay(topicGroups);

  const topics = await apiRequest<TopicDto[]>('/topics');
  const groups: TopicGroup[] = [];
  for (const t of topics) {
    let group = groups.find((g) => g.title === t.group);
    if (!group) {
      group = { title: t.group, topics: [] };
      groups.push(group);
    }
    group.topics.push({ id: t.id, label: t.label, shortLabel: t.shortLabel });
  }
  return groups;
}

/** Se o @ pode ser usado. No modo demonstração compara só com as pessoas fictícias. */
export async function checkHandleAvailable(handle: string): Promise<boolean> {
  if (DEMO_MODE) return !RESERVED_HANDLES.includes(handle) && !users.some((u) => u.handle === handle && u.id !== 'me');
  return isHandleAvailable(handle);
}
