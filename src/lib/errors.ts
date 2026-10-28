/** Recurso inexistente: as telas mostram "não encontrada" em vez de um erro genérico. */
export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} não encontrada`);
    this.name = 'NotFoundError';
  }
}

/**
 * Erro respondido pela API (application/problem+json). `type` é estável, como
 * "/errors/invalid-credentials"; `title` é um texto pronto para mostrar.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    readonly title: string,
    /** Mensagens por campo (erros 422), como `{ handle: 'Esse nome já está em uso.' }`. */
    readonly violations: Record<string, string> = {},
    /** Segundos até poder tentar de novo (erros 429). */
    readonly retryAfter: number | null = null,
  ) {
    super(title);
    this.name = 'ApiError';
  }
}

/** Sem resposta do servidor: sem internet, servidor fora do ar ou tempo esgotado. */
export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com o servidor.');
    this.name = 'NetworkError';
  }
}

/** Texto para mostrar à pessoa, sem detalhes técnicos. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  if (error instanceof ApiError) {
    if (error.status === 429) {
      if (error.retryAfter !== null) {
        const wait = error.retryAfter < 90 ? `${error.retryAfter} s` : `${Math.ceil(error.retryAfter / 60)} min`;
        return `Muitas tentativas. Tente novamente em ${wait}.`;
      }
      return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    }
    if (error.status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';
    return error.title;
  }
  return 'Algo deu errado. Tente de novo.';
}
