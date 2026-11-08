import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { useEmailVerificationGuard } from '@/features/account/email-verification';
import { useInteractions } from '@/features/interactions/interactions-context';
import { putAttendance } from '@/features/events/api';

import type { ChamadoCardData } from './chamado-card';

/**
 * Presença do chamado no feed: local para tocar na hora, confirmada no servidor
 * quando há API. O estado local é alinhado ao resumo apenas quando o dado do
 * servidor muda, para um toque não desfazer o outro.
 */
export function useChamadoAttendance(data: ChamadoCardData) {
  const { isOn, setOn } = useInteractions();
  const verification = useEmailVerificationGuard();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const serverGoing = data.viewerAttendance === 'going';
  const serverMaybe = data.viewerAttendance === 'maybe';
  const going = isOn('goingEvents', data.id);
  const maybe = isOn('maybeEvents', data.id);
  const alive = useRef(true);

  // O efeito só deve alinhar o estado local quando o dado do servidor (ou o
  // chamado) muda. Lemos os valores atuais por ref para não reexecutá-lo a cada
  // toque: se `going` entrasse nas dependências, cancelar a presença seria
  // desfeito pelo próprio efeito ao ver `viewerAttendance` antigo.
  const goingNow = useRef(going);
  const maybeNow = useRef(maybe);
  useEffect(() => {
    goingNow.current = going;
    maybeNow.current = maybe;
  }, [going, maybe]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // O resumo do feed traz a resposta de quem vê: ela vira o estado local da sessão.
  useEffect(() => {
    if (!alive.current) return;
    if (serverGoing) {
      if (!goingNow.current) setOn('goingEvents', [data.id], true);
      if (maybeNow.current) setOn('maybeEvents', [data.id], false);
    } else if (serverMaybe) {
      if (!maybeNow.current) setOn('maybeEvents', [data.id], true);
      if (goingNow.current) setOn('goingEvents', [data.id], false);
    }
  }, [data.id, serverGoing, serverMaybe, setOn]);

  const setAttendance = async (next: 'going' | 'maybe' | null) => {
    if (busy) return;
    // Bloqueio já conhecido: nada de requisição ou atualização otimista. O cartão
    // mostra a causa e o caminho para confirmar o e-mail.
    if (verification.required) {
      verification.showPrompt();
      return;
    }
    // Se o aviso era de uma restrição já resolvida, a nova tentativa o recolhe.
    if (verification.prompt) verification.dismissPrompt();
    const previous = { going, maybe };
    const nextGoing = next === 'going';
    const nextMaybe = next === 'maybe';
    if (going !== nextGoing) setOn('goingEvents', [data.id], nextGoing);
    if (maybe !== nextMaybe) setOn('maybeEvents', [data.id], nextMaybe);
    if (DEMO_MODE) {
      if (next) toast.show('Presença marcada neste aparelho até fechar o app.');
      return;
    }
    setBusy(true);
    try {
      await putAttendance(data.id, next ?? 'not_going');
    } catch (error) {
      setOn('goingEvents', [data.id], previous.going);
      setOn('maybeEvents', [data.id], previous.maybe);
      // A conta em memória podia estar desatualizada. O guard registra a recusa da
      // API e recarrega a conta para os próximos toques já conhecerem a restrição.
      if (verification.handleError(error)) return;
      toast.show('Não foi possível atualizar sua presença. Tente de novo.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return {
    going,
    maybe,
    busy,
    verificationRequired: verification.required,
    verificationPrompt: verification.prompt,
    dismissVerificationPrompt: verification.dismissPrompt,
    // A contagem do servidor já inclui a própria pessoa quando ela confirmou lá.
    goingCount: Math.max(0, data.goingCount + (going ? 1 : 0) - (serverGoing ? 1 : 0)),
    maybeCount: Math.max(0, data.maybeCount + (maybe ? 1 : 0) - (serverMaybe ? 1 : 0)),
    setAttendance,
  };
}
