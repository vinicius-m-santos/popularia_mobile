import { DEMO_MODE } from '@/constants/config';
import { getSearchablePeople } from '@/features/profiles/api';
import { apiRequest } from '@/lib/api/client';
import type { AuthorDto } from '@/lib/api/dto';

export type MentionCandidate = {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
};

type PeopleSearch = { people: (AuthorDto & { avatarUrl?: string | null })[] };

const RESULT_LIMIT = 5;

function candidate(person: { id: string; handle: string; displayName?: string; name?: string; avatarUrl?: string | null }): MentionCandidate {
  return {
    userId: person.id,
    handle: person.handle,
    displayName: person.displayName ?? person.name ?? person.handle,
    avatarUrl: person.avatarUrl ?? null,
  };
}

/** A mesma busca de pessoas do Explorar, com limite curto. Não lista contas que a busca esconde. */
export async function searchMentionPeople(query: string, signal?: AbortSignal): Promise<MentionCandidate[]> {
  const term = query.replace(/^@/, '').trim();
  if (DEMO_MODE) {
    const needle = term.toLocaleLowerCase();
    const people = await getSearchablePeople('me');
    return people
      .map((profile) => profile.user)
      .filter((user) => user.handle.toLocaleLowerCase().includes(needle) || user.name.toLocaleLowerCase().includes(needle))
      .slice(0, RESULT_LIMIT)
      .map((user) => candidate({ ...user, displayName: user.name }));
  }
  const params = new URLSearchParams({ q: term, type: 'people', limit: String(RESULT_LIMIT) });
  const data = await apiRequest<PeopleSearch>(`/search?${params}`, { auth: true, signal });
  return data.people.slice(0, RESULT_LIMIT).map(candidate);
}
