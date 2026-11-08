/** Estado visual da entrada na comuna, separado do componente para ser testável. */
export type ComunaJoinInput = {
  archived: boolean;
  joined: boolean;
  pending: boolean;
  requestsEntry: boolean;
  requested: boolean;
};

export type ComunaJoinState = {
  disabled: boolean;
  label: string;
  tone: 'paper' | 'red';
  miniLabel: string;
};

/**
 * Mantém as duas apresentações da ação de entrar/sair (botão do herói e o
 * compacto sobre a capa) com as mesmas regras de arquivada, pedido e saída.
 */
export function comunaJoinState({ archived, joined, pending, requestsEntry, requested }: ComunaJoinInput): ComunaJoinState {
  const disabled = archived && !joined ? true : requestsEntry ? pending : pending || (archived && !joined);
  const label = archived && !joined
    ? 'Comuna arquivada'
    : requestsEntry
      ? pending ? 'Enviando…' : requested ? 'Pedido enviado · retirar' : 'Pedir para entrar'
      : pending
        ? joined ? 'Saindo…' : 'Entrando…'
        : joined ? 'Participando' : 'Participar da comuna';
  const tone: 'paper' | 'red' = archived && !joined ? 'paper' : requestsEntry ? requested ? 'paper' : 'red' : joined ? 'paper' : 'red';
  const miniLabel = archived && !joined
    ? 'Arquivada'
    : requestsEntry
      ? pending ? 'Enviando…' : requested ? 'Pedido enviado' : 'Pedir entrada'
      : pending
        ? 'Aguarde…'
        : joined ? 'Participando' : 'Participar';
  return { disabled, label, tone, miniLabel };
}
