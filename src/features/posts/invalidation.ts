import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

type CreatedPostSurfaces = {
  /** Handle de quem publicou; quando ausente, invalida os perfis como antes. */
  author?: string | null;
  /** Slugs das comunas em que a publicação apareceu. */
  comunaIds?: (string | null | undefined)[];
};

function uniqueComunas(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => !!id))];
}

function invalidateProfilePosts(author?: string | null) {
  void queryClient.invalidateQueries({ queryKey: author ? queryKeys.profile.posts(author) : queryKeys.profile.postsAll });
}

/**
 * Publicar muda feed, perfil de quem publicou, listas da(s) comuna(s) e
 * descoberta/busca. As queries de outras pessoas e de outras comunas não são
 * tocadas.
 */
export function invalidateAfterPostCreated({ author, comunaIds = [] }: CreatedPostSurfaces = {}): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
  invalidateProfilePosts(author);
  for (const slug of uniqueComunas(comunaIds)) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.posts(slug) });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.searchAll });
}

type DeletedPostSurfaces = {
  postId: string;
  author?: string | null;
  comunaId?: string | null;
};

/**
 * Excluir remove o detalhe/preview da publicação e invalida somente as listas
 * que poderiam mostrá-la. É o substituto da invalidação global usada antes.
 */
export function invalidateAfterPostDeleted({ postId, author, comunaId }: DeletedPostSurfaces): void {
  queryClient.removeQueries({ queryKey: queryKeys.post.detail(postId), exact: true });
  queryClient.removeQueries({ queryKey: queryKeys.post.preview(postId), exact: true });
  void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
  invalidateProfilePosts(author);
  if (comunaId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.posts(comunaId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.comuna.pins(comunaId) });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.topic.postsAll });
  void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.searchAll });
}
