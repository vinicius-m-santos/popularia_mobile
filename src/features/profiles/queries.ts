import { infiniteQueryOptions, queryOptions, type QueryKey } from '@tanstack/react-query';

import { DEMO_MODE } from '@/constants/config';
import { contentPolicy, prefetchInfiniteQueryOnce, prefetchQueryOnce, queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile, User } from '@/types/models';

import { getProfile, getUserPostsPage } from './api';

/** Chaves canônicas do perfil e da lista de publicações da pessoa. */
export const profileKeys = {
  detail: (id: string): QueryKey => queryKeys.profile.detail(id),
  summary: (id: string): QueryKey => queryKeys.profile.summary(id),
  posts: (author: string): QueryKey => queryKeys.profile.posts(author),
};

/**
 * Resumo mínimo para o primeiro quadro de um perfil de terceiros. Vem da
 * identidade que já estava visível no cartão/lista e nunca inclui contagens,
 * bio ou relação que ainda não foram confirmadas pelo servidor.
 */
export function toProfileSummary(user: User): Profile {
  return {
    user,
    isPrivate: user.isPrivate,
    bio: '',
    meta: '',
    summary: '',
    stats: [],
    comunaIds: [],
    creator: null,
  };
}

export function rememberProfileSummary(user: User): void {
  queryClient.setQueryData(profileKeys.summary(user.id), toProfileSummary(user));
}

export function readProfileSummary(id: string): Profile | undefined {
  return queryClient.getQueryData<Profile>(profileKeys.summary(id));
}

export const profileOptions = (id: string) => queryOptions<Profile>({
  queryKey: profileKeys.detail(id),
  queryFn: ({ signal }) => getProfile(id, signal),
  ...contentPolicy.profile,
  // Abrir por um cartão/pessoa já mostra nome, @ e foto enquanto o detalhe chega.
  placeholderData: () => readProfileSummary(id),
});

export const profilePostsOptions = (author: string) => infiniteQueryOptions({
  queryKey: profileKeys.posts(author),
  queryFn: ({ pageParam, signal }) => getUserPostsPage(author, pageParam, signal),
  initialPageParam: null as string | null,
  getNextPageParam: (page) => page.nextCursor ?? undefined,
  ...contentPolicy.profile,
});

/**
 * Aquece o perfil e a primeira página de publicações com as mesmas chaves que
 * a tela usa. Se o prefetch falhar ou não concluir antes da navegação, a tela
 * monta e busca normalmente (fallback). Listas já carregadas não são refeitas
 * aqui: o destino revalida com o staleTime do domínio.
 */
export function prepareProfile(id: string, postsAuthor = id, options: { includePosts?: boolean } = {}): Promise<void> {
  const tasks = [prefetchQueryOnce(profileOptions(id))];
  if (options.includePosts !== false && postsAuthor) {
    tasks.push(prefetchInfiniteQueryOnce(profilePostsOptions(postsAuthor)));
  }
  return Promise.all(tasks).then(() => undefined);
}

/**
 * Aquecimento a partir da identidade já visível no cartão/lista. O próprio
 * perfil usa a chave `me`; na API, as publicações dele são lidas pelo handle.
 */
export function prepareProfileFromUser(user: User, isSelf = user.id === 'me'): Promise<void> {
  const id = isSelf ? 'me' : user.id;
  const postsAuthor = isSelf && !DEMO_MODE ? user.handle : id;
  // A identidade já visível pinta o primeiro quadro do destino; o detalhe
  // revalida por cima sem esconder nome, @ e foto.
  rememberProfileSummary({ ...user, id });
  // Perfil privado que a pessoa ainda não segue não expõe publicações; deixar a
  // tela decidir evita um 403 de prefetch e uma repetição logo depois.
  const includePosts = isSelf || !user.isPrivate || !!user.viewerFollowing;
  return prepareProfile(id, postsAuthor, { includePosts });
}
