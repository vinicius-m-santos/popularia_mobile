import { useSyncExternalStore, useEffect, useRef } from 'react';

import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount, useMe } from '@/features/account/account-context';
import { getFollowing, setFollowing, type FollowState } from '@/features/profiles/api';
import { isFollowLocked, lockFollow, patchFollowCaches, readRequested, restoreFollowCaches, setRequestedFlag, snapshotFollowCaches, subscribeFollowStore, unlockFollow, followStoreVersion, type FollowFlags } from '@/features/profiles/follow-cache';
import type { CommunityEvent, Post } from '@/types/models';

import { useInteractions, withLocal } from './interactions-context';

/**
 * Estado e ações de uma publicação. Apoiar, ecoar e salvar ainda não existem na API:
 * os avisos deixam claro que são locais. A contagem de comentários vem do servidor
 * (na API) ou soma os comentários locais (no modo demonstração).
 */
export function usePostActions(post: Post) {
  const { isOn, toggle, localCommentsFor, commentCountOf } = useInteractions();
  const toast = useToast();

  const supported = isOn('supportedPosts', post.id);
  const echoed = isOn('echoedPosts', post.id);
  const saved = isOn('savedPosts', post.id);

  return {
    supported,
    echoed,
    saved,
    supportCount: withLocal(post.supportCount, supported),
    echoCount: withLocal(post.echoCount, echoed),
    commentCount: DEMO_MODE
      ? post.commentCount + localCommentsFor(post.id).length
      : commentCountOf(post.id, post.commentCount),
    toggleSupport: () => toggle('supportedPosts', post.id),
    toggleEcho: () => {
      if (toggle('echoedPosts', post.id)) toast.show('Eco marcado. No protótipo, nada é compartilhado.');
    },
    toggleSave: () => {
      if (toggle('savedPosts', post.id)) toast.show('Salvo neste aparelho até fechar o app.');
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
