import type { AppStateStatus } from 'react-native';

import { queryClient } from './client';

/**
 * Janela para coalescer transições encadeadas de AppState.
 *
 * No iOS, sair para o seletor de apps ou abrir a central de notificações pode
 * produzir `inactive -> active` pouco depois de um `background -> active`.
 * Sem a janela, cada transição faria uma passagem completa pelas queries.
 */
export const FOREGROUND_REVALIDATION_INTERVAL_MS = 2_000;

let lastActiveAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * Revalida uma única vez as queries ativas e obsoletas ao voltar ao primeiro plano.
 *
 * O single-flight importa além da janela: enquanto a passagem anterior ainda
 * espera a rede, outro evento `active` reaproveita a mesma promise em vez de
 * iniciar um segundo `refetchQueries`. A política de `staleTime` de cada domínio
 * continua decidindo o que realmente precisa de request.
 */
export function revalidateOnForeground(state: AppStateStatus, now = Date.now()): Promise<void> | null {
  if (state !== 'active') return null;
  if (lastActiveAt > 0 && now - lastActiveAt < FOREGROUND_REVALIDATION_INTERVAL_MS) return inFlight;
  lastActiveAt = now;
  if (inFlight) return inFlight;

  const pass = queryClient
    .refetchQueries({ type: 'active', stale: true }, { cancelRefetch: false })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      if (inFlight === pass) inFlight = null;
    });
  inFlight = pass;
  return pass;
}

/** Limpa apenas a memória do módulo; o cache de queries continua intacto. */
export function resetForegroundRevalidation(): void {
  lastActiveAt = 0;
  inFlight = null;
}
