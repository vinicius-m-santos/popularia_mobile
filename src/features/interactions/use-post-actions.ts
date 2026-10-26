import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount, useMe } from '@/features/account/account-context';
import { getFollowing, setFollowing } from '@/features/profiles/api';
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

export function useFollow(userId: string, initialFollowing?: boolean) {
  const { isOn, toggle, setOn } = useInteractions();
  const me = useMe();
  const { account } = useAccount();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const known = useRef(false);
  const generation = useRef(0);
  const canFollow = userId !== me.id && userId !== account?.id;
  const following = canFollow && isOn('followedUsers', userId);
  const followingNow = useRef(following);
  useEffect(() => { followingNow.current = following; }, [following]);

  useEffect(() => {
    const current = ++generation.current;
    known.current = false;
    if (DEMO_MODE || !canFollow) return;
    if (initialFollowing !== undefined) {
      known.current = true;
      setOn('followedUsers', [userId], initialFollowing);
      return () => { generation.current = current + 1; };
    }
    let cancelled = false;
    const before = followingNow.current;
    getFollowing(userId).then((value) => {
      if (cancelled || pending.current || current !== generation.current || followingNow.current !== before) return;
      known.current = true;
      setOn('followedUsers', [userId], value);
    }).catch(() => { /* A tap retries the lookup before changing the relation. */ });
    return () => { cancelled = true; generation.current = current + 1; };
  }, [userId, account?.id, canFollow, setOn, initialFollowing]);

  const toggleFollow = async () => {
    if (!canFollow || pending.current) return false;
    if (DEMO_MODE) { toggle('followedUsers', userId); return true; }
    pending.current = true;
    setBusy(true);
    const currentGeneration = generation.current;
    try {
      const current = known.current ? following : await getFollowing(userId);
      if (currentGeneration !== generation.current) return false;
      await setFollowing(userId, !current);
      if (currentGeneration !== generation.current) return false;
      known.current = true;
      setOn('followedUsers', [userId], !current);
      return true;
    } catch {
      if (currentGeneration === generation.current) toast.show('Não conseguimos atualizar quem você segue. Tente novamente.');
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { canFollow, following, busy, toggleFollow };
}
