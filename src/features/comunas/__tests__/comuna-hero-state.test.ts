import { describe, expect, it } from '@jest/globals';

import { comunaJoinState } from '../comuna-hero-state';

const base = { archived: false, joined: false, pending: false, requestsEntry: false, requested: false };

describe('estado visual de entrada na comuna', () => {
  it('convida a participar quando a comuna é pública e a pessoa não participa', () => {
    expect(comunaJoinState(base)).toEqual({
      disabled: false,
      label: 'Participar da comuna',
      tone: 'red',
      miniLabel: 'Participar',
    });
  });

  it('mostra participação sem novo convite quando já é membro', () => {
    expect(comunaJoinState({ ...base, joined: true })).toEqual({
      disabled: false,
      label: 'Participando',
      tone: 'paper',
      miniLabel: 'Participando',
    });
  });

  it('usa pedido pendente e impede toque enquanto envia', () => {
    expect(comunaJoinState({ ...base, requestsEntry: true, pending: true })).toEqual({
      disabled: true,
      label: 'Enviando…',
      tone: 'red',
      miniLabel: 'Enviando…',
    });
    expect(comunaJoinState({ ...base, requestsEntry: true, requested: true })).toMatchObject({
      disabled: false,
      label: 'Pedido enviado · retirar',
      tone: 'paper',
      miniLabel: 'Pedido enviado',
    });
  });

  it('bloqueia a entrada em comuna arquivada', () => {
    expect(comunaJoinState({ ...base, archived: true })).toEqual({
      disabled: true,
      label: 'Comuna arquivada',
      tone: 'paper',
      miniLabel: 'Arquivada',
    });
  });

  it('indica saída em andamento para quem já participa', () => {
    expect(comunaJoinState({ ...base, joined: true, pending: true })).toMatchObject({
      disabled: true,
      label: 'Saindo…',
      miniLabel: 'Aguarde…',
    });
  });
});
