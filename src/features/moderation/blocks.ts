/**
 * Pessoas bloqueadas conhecidas nesta sessão.
 *
 * O servidor é a fonte da verdade: `ensureBlockedHandles` busca `GET /me/blocks`
 * uma vez e guarda a lista; bloquear ou desbloquear pelo app atualiza o cache na
 * hora. No modo demonstração não há servidor, então o cache guarda só as ações
 * feitas neste aparelho.
 */
import { DEMO_MODE } from '@/constants/config';
import { apiRequest } from '@/lib/api/client';

type BlockedPerson = { handle: string; displayName?: string };

let known = new Set<string>();
let loaded = DEMO_MODE;
let pending: Promise<void> | null = null;

/** Lista local imediatamente disponível, antes ou depois da resposta do servidor. */
export function cachedBlockedHandles(): string[] {
  return [...known];
}

export function isBlockedHandle(handle: string): boolean {
  return known.has(handle);
}

/**
 * Garante a lista do servidor. Falhas de rede não escondem a ação: o cache local
 * continua valendo e a próxima abertura tenta de novo.
 */
export async function ensureBlockedHandles(): Promise<string[]> {
  if (loaded) return cachedBlockedHandles();
  if (!pending) {
    pending = (async () => {
      try {
        const people = await apiRequest<BlockedPerson[]>('/me/blocks', { auth: true });
        if (Array.isArray(people)) {
          for (const person of people) {
            if (person?.handle) known.add(person.handle);
          }
          loaded = true;
        }
      } catch {
        // A denúncia continua disponível; a linha de bloqueio aparece sem a lista do servidor.
      }
    })().finally(() => {
      pending = null;
    });
  }
  await pending;
  return cachedBlockedHandles();
}

export function rememberBlocked(handle: string, blocked: boolean): void {
  if (blocked) known.add(handle);
  else known.delete(handle);
}

/** Só para testes: esquece o cache entre casos. */
export function resetBlockedHandlesForTests(): void {
  known = new Set();
  loaded = DEMO_MODE;
  pending = null;
}
