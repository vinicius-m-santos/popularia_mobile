/**
 * Assinaturas por publicação para as stores de reação e salvamento.
 *
 * Cada cartão observa só o `postId` que renderiza. Uma alteração em `p1` acorda
 * apenas os listeners de `p1`; os outros cartões continuam com o snapshot
 * anterior e o `memo` do PostCard volta a evitar renders desnecessários.
 *
 * O unsubscribe é idempotente e remove o conjunto vazio do mapa, para uma troca
 * de `postId` ou a desmontagem do cartão não deixar listeners acumulados.
 */
type Listener = () => void;

export type PostSubscription = {
  subscribe: (postId: string, listener: Listener) => () => void;
  notify: (postId: string) => void;
  /** Usado no reset da sessão, quando todos os snapshots podem mudar. */
  notifyAll: () => void;
};

export function createPostSubscription(): PostSubscription {
  const listenersByPost = new Map<string, Set<Listener>>();

  function subscribe(postId: string, listener: Listener) {
    let listeners = listenersByPost.get(postId);
    if (!listeners) {
      listeners = new Set();
      listenersByPost.set(postId, listeners);
    }
    const target = listeners;
    target.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      target.delete(listener);
      if (target.size === 0 && listenersByPost.get(postId) === target) listenersByPost.delete(postId);
    };
  }

  function notify(postId: string) {
    const listeners = listenersByPost.get(postId);
    if (!listeners || listeners.size === 0) return;
    // Copia antes de notificar: um listener pode cancelar a própria assinatura.
    for (const listener of [...listeners]) listener();
  }

  function notifyAll() {
    // Copia as chaves: notify pode remover conjuntos vazios do mapa.
    for (const postId of [...listenersByPost.keys()]) notify(postId);
  }

  return { subscribe, notify, notifyAll };
}
