import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
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

export function useFollow(userId: string) {
  const { isOn, toggle } = useInteractions();
  const following = isOn('followedUsers', userId);
  return { following, toggleFollow: () => toggle('followedUsers', userId) };
}
