import { useRef, useState } from 'react';

import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { acknowledgeGamification } from '@/features/gamification/feedback';
import { useInteractions } from '@/features/interactions/interactions-context';
import { ApiError, describeError } from '@/lib/errors';
import type { Comuna } from '@/types/models';

import { joinComuna, leaveComuna } from './api';

/** Mensagens para as recusas conhecidas de PUT/DELETE /comunas/{slug}/membership. */
function membershipErrorMessage(error: unknown, joining: boolean): string {
  if (error instanceof ApiError) {
    if (error.type === '/errors/comuna-requires-approval') return 'Esta comuna é privada: abra a comuna e peça para entrar.';
    if (error.type === '/errors/founder-cannot-leave') return 'Quem é proprietário não sai da comuna: transfira-a ou arquive-a na gestão.';
    if (error.type === '/errors/comuna-archived') return 'Esta comuna está arquivada e não aceita novos membros.';
  }
  const action = joining ? 'entrar na comuna' : 'sair da comuna';
  return `Não foi possível ${action}. ${describeError(error)}`;
}

/**
 * Participar de uma comuna (cartões, listas e a página da comuna).
 *
 * Na API, o estado inicial é o `viewer.isMember` que o servidor mandou com a comuna; depois de
 * entrar ou sair, vale a resposta da API (guardada no contexto, para as outras telas verem).
 * Não há atualização otimista: o botão mostra que está processando até o servidor responder.
 * No modo demonstração, continua sendo uma simulação local.
 */
export function useComunaMembership(comuna: Pick<Comuna, 'id' | 'name' | 'viewerIsMember'>) {
  const { membershipOf, toggle, setOn } = useInteractions();
  const { account } = useAccount();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const joined = membershipOf(comuna.id) ?? comuna.viewerIsMember ?? false;

  const toggleJoin = async () => {
    if (DEMO_MODE) {
      if (toggle('joinedComunas', comuna.id)) toast.show(`Você entrou em ${comuna.name} (simulação local).`);
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    const joining = !joined;
    setPending(true);
    try {
      if (joining) {
        await joinComuna(comuna.id);
        acknowledgeGamification(account?.id, toast.show);
      } else await leaveComuna(comuna.id);
      setOn('joinedComunas', [comuna.id], joining);
      toast.show(joining ? `Você entrou em ${comuna.name}.` : `Você saiu de ${comuna.name}.`);
    } catch (error) {
      toast.show(membershipErrorMessage(error, joining));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return { joined, pending, toggleJoin };
}
