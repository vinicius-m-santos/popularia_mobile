import { useRef, useState } from 'react';

import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useAccount } from '@/features/account/account-context';
import { joinComuna, leaveComuna } from '@/features/comunas/api';
import { acknowledgeGamification } from '@/features/gamification/feedback';
import { useInteractions } from '@/features/interactions/interactions-context';
import type { Comuna } from '@/types/models';

/**
 * Participar direto do cartão do Explorar: o estado muda na hora e volta
 * sozinho se a API recusar. É separado do `useComunaMembership` porque as
 * páginas de comuna mostram "Entrando…" e não fazem atualização otimista.
 */
export function useExploreMembership(comuna: Pick<Comuna, 'id' | 'name' | 'viewerIsMember'>) {
  const { membershipOf, setOn } = useInteractions();
  const { account } = useAccount();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const joined = membershipOf(comuna.id) ?? comuna.viewerIsMember ?? false;

  const toggleJoin = async () => {
    if (pendingRef.current) return;
    if (DEMO_MODE) {
      setOn('joinedComunas', [comuna.id], !joined);
      return;
    }

    const joining = !joined;
    pendingRef.current = true;
    setPending(true);
    // Atualização otimista: o cartão responde antes da API e continua na lista.
    setOn('joinedComunas', [comuna.id], joining);
    try {
      if (joining) {
        await joinComuna(comuna.id);
        acknowledgeGamification(account?.id, toast.show);
      } else await leaveComuna(comuna.id);
    } catch {
      setOn('joinedComunas', [comuna.id], !joining);
      toast.show(joining ? 'Não deu pra entrar agora.' : 'Não deu pra sair agora.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return { joined, pending, toggleJoin };
}
