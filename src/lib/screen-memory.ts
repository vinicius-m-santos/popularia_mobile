/**
 * Memória efêmera da interface por tela.
 *
 * Não é cache de servidor: guarda apenas o que a pessoa deixou na tela —
 * filtros, termo digitado, posição de leitura e rascunhos. A memória vive na
 * sessão do processo e é descartada junto com a sessão/`queryClient`.
 *
 * A chave precisa identificar a tela *e* o contexto que muda a lista
 * (`me.id`, escopo, coleção, comuna). Sem isso, duas telas com a mesma rota
 * herdariam o rascunho errado.
 */
const memory = new Map<string, unknown>();

export function readScreenMemory<T>(key: string): T | undefined {
  return memory.get(key) as T | undefined;
}

export function writeScreenMemory<T>(key: string, value: T): void {
  memory.set(key, value);
}

export function clearScreenMemory(prefix?: string): void {
  if (prefix === undefined) {
    memory.clear();
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}
