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

/** Sugestões do modo demonstração, no mesmo espírito do gerador do servidor. */
const DEMO_HANDLES = ['quietotter', 'bravefalcon', 'sleepyjellyfish', 'sunnywillow', 'cleverkoala', 'gentlebadger'];

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


/** Nome legível e livre para a etapa de perfil. No modo demonstração, escolhe localmente. */
export async function suggestHandle(): Promise<string> {
  if (DEMO_MODE) return mockDelay(DEMO_HANDLES[Math.floor(Math.random() * DEMO_HANDLES.length)]!);
  const result = await apiRequest<{ handle: string }>('/handles/suggestion');
  return result.handle;
}
