import { useSyncExternalStore, useCallback, useEffect, useRef } from 'react';

import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount, useMe } from '@/features/account/account-context';
import { getFollowing, setFollowing, type FollowState } from '@/features/profiles/api';
import { isFollowLocked, lockFollow, patchFollowCaches, readRequested, restoreFollowCaches, setRequestedFlag, snapshotFollowCaches, subscribeFollowStore, unlockFollow, followStoreVersion, type FollowFlags } from '@/features/profiles/follow-cache';
import { lockReaction, patchReactionCaches, readReaction, readReactionSnapshot, restoreReactionCaches, snapshotReactionCaches, subscribePostReactions, unlockReaction, writeReaction, type Reaction, type ReactionKind } from '@/features/posts/reactions';
import { setPostEcho, setPostSupport } from '@/features/posts/api';
import { readSaved, readSavedSnapshot, rememberPost, subscribeSavedPost, toggleSavedPost } from '@/features/posts/save';
import type { CommunityEvent, FeedItem } from '@/types/models';

import { useInteractions, withLocal } from './interactions-context';

/**
 * Estado e ações de uma publicação. Apoiar e ecoar ainda são locais.
 * Salvar persiste na conta quando a API está configurada; no modo demonstração
 * fica só neste aparelho. A contagem de comentários vem do servidor (na API)
 * ou soma os comentários locais (no modo demonstração).
 */
export function usePostActions(post: FeedItem) {
  const { isOn, toggle, localCommentsFor, commentCountOf } = useInteractions();
  const { account } = useAccount();
  const toast = useToast();
  rememberPost(post);
  // Assinatura por ID: uma reação ou salvamento em outro cartão não re-renderiza este.
  // O snapshot é primitivo (salvar) ou um objeto estável (reações); quando não muda,
  // useSyncExternalStore descarta a notificação.
  const subscribeSaved = useCallback((listener: () => void) => subscribeSavedPost(post.id, listener), [post.id]);
  const savedSnapshot = useCallback(() => readSavedSnapshot(post.id), [post.id]);
  useSyncExternalStore(subscribeSaved, savedSnapshot, savedSnapshot);

  const subscribeReactions = useCallback((listener: () => void) => subscribePostReactions(post.id, listener), [post.id]);
  const reactionsSnapshot = useCallback(() => readReactionSnapshot(post.id), [post.id]);
  useSyncExternalStore(subscribeReactions, reactionsSnapshot, reactionsSnapshot);

  const localSupport = isOn('supportedPosts', post.id);
  const localEcho = isOn('echoedPosts', post.id);
  const serverSupport: Reaction = { count: post.supportCount, mine: !!post.viewer?.supported };
  const serverEcho: Reaction = { count: post.echoCount, mine: !!post.viewer?.echoed };
  // No modo demonstração não existe servidor: a contagem nasce do estado local.
  const support: Reaction = DEMO_MODE ? { count: withLocal(post.supportCount, localSupport), mine: localSupport } : readReaction(post.id, 'support', serverSupport);
  const echo: Reaction = DEMO_MODE ? { count: withLocal(post.echoCount, localEcho), mine: localEcho } : readReaction(post.id, 'echo', serverEcho);
  const saved = DEMO_MODE ? isOn('savedPosts', post.id) : readSaved(post.id, post.viewer?.saved);

  /** Otimista, com trava: o toque pinta na hora e o servidor confirma logo depois. */
  const flip = async (kind: ReactionKind, current: Reaction) => {
    if (!lockReaction(post.id, kind)) return;
    const next: Reaction = { count: Math.max(0, current.count + (current.mine ? -1 : 1)), mine: !current.mine };
    const snapshots = snapshotReactionCaches(post.id);
    writeReaction(post.id, kind, next);
    patchReactionCaches(post.id, kind, next);
    try {
      const item = kind === 'support' ? await setPostSupport(post.id, next.mine) : await setPostEcho(post.id, next.mine);
      const confirmed: Reaction = kind === 'support'
        ? { count: item.supportCount, mine: !!item.viewer?.supported }
        : { count: item.echoCount, mine: !!item.viewer?.echoed };
      writeReaction(post.id, kind, confirmed);
      patchReactionCaches(post.id, kind, confirmed);
    } catch {
      // Sem rede, a tela volta ao que era e a pessoa pode tentar de novo.
      restoreReactionCaches(snapshots);
      writeReaction(post.id, kind, current);
      toast.show(kind === 'support' ? 'Não conseguimos registrar seu apoio. Tente de novo.' : 'Não conseguimos ecoar. Tente de novo.');
    } finally {
      unlockReaction(post.id, kind);
    }
  };

  return {
    supported: support.mine,
    echoed: echo.mine,
    saved,
    supportCount: support.count,
    echoCount: echo.count,
    commentCount: DEMO_MODE
      ? post.commentCount + localCommentsFor(post.id).length
      : commentCountOf(post.id, post.commentCount),
    toggleSupport: () => {
      if (DEMO_MODE) { toggle('supportedPosts', post.id); return Promise.resolve(); }
      return flip('support', support);
    },
    toggleEcho: () => {
      if (DEMO_MODE) {
        if (toggle('echoedPosts', post.id)) toast.show('Eco marcado neste aparelho até fechar o app.');
        return Promise.resolve();
      }
      return flip('echo', echo);
    },
    toggleSave: () => {
      if (DEMO_MODE) {
        if (toggle('savedPosts', post.id)) toast.show('Salvo neste aparelho até fechar o app.');
        return Promise.resolve(false);
      }
      return toggleSavedPost(post, toast.show, account?.id);
    },
  };
}

export function useEventAttendance(event: CommunityEvent) {
  const { isOn, toggle } = useInteractions();
  const toast = useToast();
  const going = isOn('goingEvents', event.id);
  return {
    going,
    attendeeCount: withLocal(event.attendeeCount, going),
    toggleGoing: () => {
      if (toggle('goingEvents', event.id)) {
        toast.show('Presença marcada no protótipo. Nenhum aviso será enviado.');
      }
    },
  };
}

export function useFollow(userId: string, initialFollowing?: boolean, hint?: { requested?: boolean; isPrivate?: boolean }) {
  useSyncExternalStore(subscribeFollowStore, followStoreVersion, followStoreVersion);
  const { isOn, toggle, setOn } = useInteractions();
  const me = useMe();
  const { account } = useAccount();
  const toast = useToast();
  const known = useRef(false);
  const generation = useRef(0);
  const requestedHint = hint?.requested;
  const canFollow = userId !== me.id && userId !== account?.id;
  const following = canFollow && isOn('followedUsers', userId);
  const requested = canFollow && readRequested(userId);
  const followingNow = useRef(following);
  useEffect(() => { followingNow.current = following; }, [following]);

  useEffect(() => {
    const current = ++generation.current;
    known.current = false;
    if (DEMO_MODE || !canFollow) return;
    if (initialFollowing !== undefined) {
      if (isFollowLocked(userId)) return () => { generation.current = current + 1; };
      known.current = true;
      setOn('followedUsers', [userId], initialFollowing);
      setRequestedFlag(userId, requestedHint ?? false);
      return () => { generation.current = current + 1; };
    }
    let cancelled = false;
    const before = followingNow.current;
    getFollowing(userId, (state) => { if (!cancelled && !isFollowLocked(userId) && current === generation.current) setRequestedFlag(userId, state.requested ?? false); }).then((value) => {
      if (cancelled || isFollowLocked(userId) || current !== generation.current || followingNow.current !== before) return;
      known.current = true;
      setOn('followedUsers', [userId], value);
    }).catch(() => { /* A tap retries the lookup before changing the relation. */ });
    return () => { cancelled = true; generation.current = current + 1; };
  }, [userId, account?.id, canFollow, setOn, initialFollowing, requestedHint]);

  const toggleFollow = async () => {
    if (!canFollow || isFollowLocked(userId)) return false;
    if (DEMO_MODE) { toggle('followedUsers', userId); return true; }
    if (!lockFollow(userId)) return false;
    const currentGeneration = generation.current;
    const viewerId = account?.id ?? me.id;
    let applied = false;
    let previous: FollowFlags = { following, requested };
    let snapshots = snapshotFollowCaches();
    try {
      let wasFollowing = following;
      let wasRequested = requested;
      if (!known.current) {
        wasFollowing = await getFollowing(userId, (state) => { wasRequested = state.requested ?? false; });
        if (currentGeneration !== generation.current) return false;
      }
      previous = { following: wasFollowing, requested: wasRequested };
      const next: FollowFlags = wasFollowing || wasRequested
        ? { following: false, requested: false }
        : hint?.isPrivate ? { following: false, requested: true } : { following: true, requested: false };
      snapshots = snapshotFollowCaches();
      setOn('followedUsers', [userId], next.following);
      setRequestedFlag(userId, next.requested);
      patchFollowCaches({ targetId: userId, viewerId, previous, next });
      applied = true;
      const state = await setFollowing(userId, !(wasFollowing || wasRequested));
      // A trava impede outra mutação até aqui. A resposta deste pedido vale mesmo se a
      // tela saiu ou o efeito re-rodou: ela é a única em voo e corrige o palpite otimista.
      known.current = true;
      const confirmed = confirmedFlags(state, next);
      if (confirmed.following !== next.following || confirmed.requested !== next.requested) {
        setOn('followedUsers', [userId], confirmed.following);
        setRequestedFlag(userId, confirmed.requested);
        patchFollowCaches({ targetId: userId, viewerId, previous: next, next: confirmed });
      }
      return currentGeneration === generation.current;
    } catch {
      if (applied) {
        restoreFollowCaches(snapshots);
        setOn('followedUsers', [userId], previous.following);
        setRequestedFlag(userId, previous.requested);
      }
      if (currentGeneration === generation.current) toast.show('Não conseguimos atualizar quem você segue. Tente novamente.');
      return false;
    } finally {
      unlockFollow(userId);
    }
  };
  return { canFollow, following, requested, busy: isFollowLocked(userId), toggleFollow };
}

function confirmedFlags(state: FollowState | void, optimistic: FollowFlags): FollowFlags {
  if (!state || typeof state !== 'object') return optimistic;
  return { following: Boolean(state.following), requested: Boolean(state.requested) };
}
