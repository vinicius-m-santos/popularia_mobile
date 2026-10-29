import { resetSavedSession } from '@/features/posts/save';
import { resetFollowSession } from '@/features/profiles/follow-cache';
import { queryClient } from '@/lib/query/client';
/**
 * Estado local das interações da pessoa (apoiar, ecoar, salvar, participar…).
 *
 * Fica só em memória neste aparelho e some ao fechar o app; nada é gravado em disco.
 * Apoiar, ecoar e silenciar ainda são só locais. Salvar publicação persiste na conta
 * quando a API está configurada. Algumas partes viram cache do que o servidor
 * respondeu nesta sessão:
 * - `joinedComunas`: participação confirmada pela API depois de entrar ou sair de uma comuna;
 * - `commentCounts`: maior contagem de comentários conhecida por publicação;
 * - `postsVersion`: muda quando a pessoa publica, para as listas recarregarem.
 * `resetAll` limpa tudo ao entrar ou sair da conta.
 */
import { createContext, use, useCallback, useMemo, useReducer, type ReactNode } from 'react';

import { DEMO_MODE } from '@/constants/config';
import { currentUser } from '@/mocks/users';
import type { Comment, Post } from '@/types/models';

/** Conjuntos de IDs marcados pela pessoa. */
export type ToggleKind =
  | 'supportedPosts'
  | 'echoedPosts'
  | 'savedPosts'
  | 'goingEvents'
  | 'followedUsers'
  | 'supportedComments'
  | 'joinedComunas'
  | 'notifyComunas'
  | 'readNotifications'
  /** Pessoas silenciadas ou bloqueadas: as publicações delas somem do feed. */
  | 'mutedUsers';

type State = Record<ToggleKind, Record<string, boolean>> & {
  /** Comentários escritos nesta sessão (não enviados a lugar nenhum). */
  localComments: Comment[];
  /** Publicações criadas nesta sessão, da mais nova para a mais antiga (só no modo demonstração). */
  localPosts: Post[];
  /** Na API: maior contagem de comentários vista por publicação (inclui os enviados agora). */
  commentCounts: Record<string, number>;
  postsVersion: number;
};

type Action =
  | { type: 'toggle'; kind: ToggleKind; id: string }
  | { type: 'set'; kind: ToggleKind; ids: string[]; value: boolean }
  | { type: 'replace'; kind: ToggleKind; ids: string[] }
  | { type: 'addComment'; comment: Comment }
  | { type: 'addPost'; post: Post }
  | { type: 'commentCount'; postId: string; count: number }
  | { type: 'postCreated' }
  | { type: 'reset' };

function toRecord(ids: string[]): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, true]));
}

function initialState(): State {
  return {
    supportedPosts: {},
    echoedPosts: {},
    savedPosts: {},
    goingEvents: {},
    followedUsers: {},
    supportedComments: {},
    // Na API, a participação vem do servidor; os mocks já começam em algumas comunas.
    joinedComunas: DEMO_MODE ? toRecord(currentUser.joinedComunaIds) : {},
    notifyComunas: {},
    readNotifications: {},
    mutedUsers: {},
    localComments: [],
    localPosts: [],
    commentCounts: {},
    postsVersion: 0,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'toggle': {
      const current = state[action.kind];
      return { ...state, [action.kind]: { ...current, [action.id]: !current[action.id] } };
    }
    case 'set': {
      const next = { ...state[action.kind] };
      for (const id of action.ids) next[id] = action.value;
      return { ...state, [action.kind]: next };
    }
    case 'replace':
      return { ...state, [action.kind]: toRecord(action.ids) };
    case 'addComment':
      return { ...state, localComments: [...state.localComments, action.comment] };
    case 'addPost':
      return { ...state, localPosts: [action.post, ...state.localPosts] };
    case 'commentCount': {
      const known = state.commentCounts[action.postId] ?? 0;
      if (action.count <= known) return state;
      return { ...state, commentCounts: { ...state.commentCounts, [action.postId]: action.count } };
    }
    case 'postCreated':
      return { ...state, postsVersion: state.postsVersion + 1 };
    case 'reset':
      return initialState();
  }
}

type InteractionsValue = {
  isOn: (kind: ToggleKind, id: string) => boolean;
  /** Inverte a marcação e devolve o novo valor. */
  toggle: (kind: ToggleKind, id: string) => boolean;
  /** Marca (ou desmarca) vários IDs de uma vez, como "Marcar como lidas". */
  setOn: (kind: ToggleKind, ids: string[], value: boolean) => void;
  /** Substitui o conjunto inteiro, como as comunas de quem começa o cadastro do zero. */
  replaceAll: (kind: ToggleKind, ids: string[]) => void;
  /** Participação conhecida nesta sessão; `undefined` quando ainda não houve ação (use o dado do servidor). */
  membershipOf: (comunaId: string) => boolean | undefined;
  joinedComunaIds: string[];
  followedUserIds: string[];
  localCommentsFor: (postId: string) => Comment[];
  addComment: (input: { postId: string; parentId: string | null; text: string }) => Comment;
  localPosts: Post[];
  addPost: (input: { comunaId: string | null; text: string; poll?: Post['poll'] }) => Post;
  /** Na API: contagem exibida = a maior entre a do servidor e a última conhecida nesta sessão. */
  commentCountOf: (postId: string, serverCount: number) => number;
  /** Registra uma contagem vista no servidor ou atualizada depois de comentar (nunca diminui). */
  noteCommentCount: (postId: string, count: number) => void;
  /** Muda quando a pessoa publica na API: as listas de publicações recarregam. */
  postsVersion: number;
  notifyPostCreated: () => void;
  /** Esquece tudo (entrar ou sair da conta): nada de uma pessoa vaza para a próxima. */
  resetAll: () => void;
};

const InteractionsContext = createContext<InteractionsValue | null>(null);

let localIdCounter = 0;

export function InteractionsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const isOn = useCallback((kind: ToggleKind, id: string) => !!state[kind][id], [state]);

  const toggle = useCallback(
    (kind: ToggleKind, id: string) => {
      dispatch({ type: 'toggle', kind, id });
      return !state[kind][id];
    },
    [state],
  );

  const setOn = useCallback(
    (kind: ToggleKind, ids: string[], value: boolean) => dispatch({ type: 'set', kind, ids, value }),
    [],
  );

  const replaceAll = useCallback(
    (kind: ToggleKind, ids: string[]) => dispatch({ type: 'replace', kind, ids }),
    [],
  );

  const membershipOf = useCallback((comunaId: string) => state.joinedComunas[comunaId], [state.joinedComunas]);

  const joinedComunaIds = useMemo(
    () => Object.keys(state.joinedComunas).filter((id) => state.joinedComunas[id]),
    [state.joinedComunas],
  );
  const followedUserIds = useMemo(
    () => Object.keys(state.followedUsers).filter((id) => state.followedUsers[id]),
    [state.followedUsers],
  );

  const localCommentsFor = useCallback(
    (postId: string) => state.localComments.filter((c) => c.postId === postId),
    [state.localComments],
  );

  const addComment = useCallback<InteractionsValue['addComment']>(({ postId, parentId, text }) => {
    localIdCounter += 1;
    const comment: Comment = {
      id: `local-${localIdCounter}`,
      postId,
      parentId,
      authorId: currentUser.id,
      createdAt: new Date().toISOString(),
      text,
      supportCount: 0,
    };
    dispatch({ type: 'addComment', comment });
    return comment;
  }, []);

  const addPost = useCallback<InteractionsValue['addPost']>(({ comunaId, text, poll }) => {
    localIdCounter += 1;
    const post: Post = {
      id: `local-post-${localIdCounter}`,
      authorId: currentUser.id,
      comunaId,
      createdAt: new Date().toISOString(),
      text,
      supportCount: 0,
      commentCount: 0,
      echoCount: 0,
      ...(poll ? { poll } : {}),
    };
    dispatch({ type: 'addPost', post });
    return post;
  }, []);

  const commentCountOf = useCallback(
    (postId: string, serverCount: number) => Math.max(serverCount, state.commentCounts[postId] ?? 0),
    [state.commentCounts],
  );
  const noteCommentCount = useCallback(
    (postId: string, count: number) => dispatch({ type: 'commentCount', postId, count }),
    [],
  );
  const notifyPostCreated = useCallback(() => {
    dispatch({ type: 'postCreated' });
    // Invalida também listas desmontadas, que podem continuar no cache.
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
    void queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
  }, []);
  const resetAll = useCallback(() => { resetFollowSession(); resetSavedSession(); dispatch({ type: 'reset' }); }, []);

  const value = useMemo(
    () => ({
      isOn,
      toggle,
      setOn,
      replaceAll,
      membershipOf,
      joinedComunaIds,
      followedUserIds,
      localCommentsFor,
      addComment,
      localPosts: state.localPosts,
      addPost,
      commentCountOf,
      noteCommentCount,
      postsVersion: state.postsVersion,
      notifyPostCreated,
      resetAll,
    }),
    [
      isOn,
      toggle,
      setOn,
      replaceAll,
      membershipOf,
      joinedComunaIds,
      followedUserIds,
      localCommentsFor,
      addComment,
      state.localPosts,
      addPost,
      commentCountOf,
      noteCommentCount,
      state.postsVersion,
      notifyPostCreated,
      resetAll,
    ],
  );

  return <InteractionsContext value={value}>{children}</InteractionsContext>;
}

export function useInteractions(): InteractionsValue {
  const ctx = use(InteractionsContext);
  if (!ctx) throw new Error('useInteractions precisa estar dentro de <InteractionsProvider>.');
  return ctx;
}

/** Contagem exibida: base do servidor (mock) + 1 se a pessoa marcou localmente. */
export function withLocal(base: number, on: boolean): number {
  return base + (on ? 1 : 0);
}
