import { useEffect, useRef, useState } from 'react';

import { DEMO_MODE } from '@/constants/config';
import { isEmailNotVerifiedError } from '@/lib/errors';

import { useAccount } from './account-context';

export type EmailVerificationGuard = {
  /** A restrição já é conhecida: não faça requisição nem atualização otimista. */
  required: boolean;
  /** Mostra o aviso no cartão, mesmo que a conta ainda diga "verificada". */
  prompt: boolean;
  showPrompt: () => void;
  dismissPrompt: () => void;
  /**
   * Reconhece a recusa específica da API. Retorna `true` quando o erro virou
   * aviso de confirmação, para o chamador não mostrar o erro genérico.
   */
  handleError: (error: unknown) => boolean;
};

/**
 * Mesmo guard para todas as ações que exigem e-mail confirmado.
 *
 * A conta em memória pode estar desatualizada. Quando a API recusa com
 * `/errors/email-not-verified`, o estado conhecido é atualizado na hora: o aviso
 * aparece e os próximos toques não repetem a requisição enquanto a conta não for
 * confirmada (ou a pessoa pedir para verificar).
 */
export function useEmailVerificationGuard(): EmailVerificationGuard {
  const { account, reloadAccount } = useAccount();
  const [serverUnverified, setServerUnverified] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const wasVerified = useRef(account?.emailVerified === true);

  const accountUnverified = !DEMO_MODE && account?.emailVerified === false;
  const required = !DEMO_MODE && (accountUnverified || serverUnverified);

  // Ao confirmar de fato (false/desconhecido → true), a restrição deixa de valer.
  // Um reload que continua dizendo "verificada" não apaga a recusa da API.
  useEffect(() => {
    const verified = account?.emailVerified === true;
    if (verified && !wasVerified.current) {
      setServerUnverified(false);
      setPrompt(false);
    }
    wasVerified.current = verified;
  }, [account?.emailVerified]);

  const showPrompt = () => setPrompt(true);

  const dismissPrompt = () => {
    setPrompt(false);
    // A pessoa vai confirmar o e-mail: a próxima tentativa merece nova resposta da API.
    setServerUnverified(false);
  };

  const handleError = (error: unknown) => {
    if (!isEmailNotVerifiedError(error)) return false;
    setServerUnverified(true);
    setPrompt(true);
    if (typeof reloadAccount === 'function') {
      void reloadAccount().catch(() => {});
    }
    return true;
  };

  return { required, prompt, showPrompt, dismissPrompt, handleError };
}
