import { AVATAR_QUERY_ROOT, avatarQueryKey, queryClient } from '@/lib/query/client';

type AvatarListener = () => void;

/**
 * Teto do overlay em memória. O caso real é uma foto trocada pela própria
 * pessoa por sessão; o limite só impede que uma sequência artificial de
 * publicações (ou um cache restaurado) cresça sem fim. A URL antiga continua
 * disponível nos dados de perfil/feed, então a evicção não apaga a imagem.
 */
export const AVATAR_CACHE_LIMIT = 200;

const avatarUrls = new Map<string, string>();
const listeners = new Map<string, Set<AvatarListener>>();

let queryBridgeAttached = false;

/**
 * Uma única ponte com o QueryCache mantém a compatibilidade de quem grava
 * `['user-avatar', id]` diretamente (importação/teste), sem um observer por
 * avatar. É ligada na primeira assinatura, não no import: testes que substituem
 * o cliente por um mock parcial continuam podendo importar o módulo.
 */
function attachQueryBridge(): void {
  if (queryBridgeAttached || typeof queryClient?.getQueryCache !== 'function') return;
  queryBridgeAttached = true;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    const [root, userId] = event.query.queryKey;
    if (root !== AVATAR_QUERY_ROOT || typeof userId !== 'string') return;
    const next = event.query.state.data;
    if (typeof next === 'string' && next.length > 0) rememberAvatarUrl(userId, next);
  });
}

function notify(userId: string): void {
  const bucket = listeners.get(userId);
  if (!bucket) return;
  // Copia a lista: um listener pode cancelar a assinatura durante a notificação.
  for (const listener of [...bucket]) listener();
}

/**
 * URL publicada para esta pessoa. Sem uma troca nesta sessão, o avatar cai no
 * `imageUrl` que já veio no perfil/feed; a leitura não abre query nem observer
 * do TanStack Query.
 */
export function readAvatarUrl(userId: string): string | null {
  const published = avatarUrls.get(userId);
  if (published !== undefined) return published;
  // Compatibilidade com um valor colocado direto no cache (importação ou teste).
  if (typeof queryClient?.getQueryData !== 'function') return null;
  const cached = queryClient.getQueryData<string>(avatarQueryKey(userId));
  return typeof cached === 'string' && cached.length > 0 ? cached : null;
}

/** Assina só esta pessoa; trocar a foto de outra não re-renderiza o avatar. */
export function subscribeAvatarUrl(userId: string, listener: AvatarListener): () => void {
  attachQueryBridge();
  const bucket = listeners.get(userId) ?? new Set<AvatarListener>();
  if (!listeners.has(userId)) listeners.set(userId, bucket);
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
    if (bucket.size === 0) listeners.delete(userId);
  };
}

/** Compartilha a foto nova com todos os avatares montados desta pessoa. */
export function rememberAvatarUrl(userId: string, avatarUrl: string): void {
  if (avatarUrls.get(userId) === avatarUrl) return;
  // Reinserir move a entrada para o fim da ordem de uso.
  avatarUrls.delete(userId);
  avatarUrls.set(userId, avatarUrl);
  while (avatarUrls.size > AVATAR_CACHE_LIMIT) {
    const oldest = avatarUrls.keys().next().value;
    if (oldest === undefined) break;
    avatarUrls.delete(oldest);
  }
  notify(userId);
}

/** Logout/troca de conta: nenhuma foto da sessão anterior passa para a próxima. */
export function clearAvatarCache(): void {
  avatarUrls.clear();
  if (typeof queryClient?.removeQueries === 'function') {
    queryClient.removeQueries({ queryKey: [AVATAR_QUERY_ROOT] });
  }
  for (const userId of [...listeners.keys()]) notify(userId);
}
