import { describe, expect, it } from '@jest/globals';

import { initialState, reducer } from '../interactions-context';

describe('reducer de interações', () => {
  it('mantém a mesma referência quando o update não muda nenhum valor', () => {
    const marked = reducer(initialState(), {
      type: 'set',
      kind: 'goingEvents',
      ids: ['chamado-1'],
      value: true,
    });

    const repeated = reducer(marked, {
      type: 'set',
      kind: 'goingEvents',
      ids: ['chamado-1'],
      value: true,
    });

    expect(repeated).toBe(marked);
    expect(repeated.goingEvents).toBe(marked.goingEvents);
  });

  it('mantém a mesma referência ao repetir um valor falso já explícito', () => {
    const cleared = reducer(initialState(), {
      type: 'set',
      kind: 'joinedComunas',
      ids: ['hortas'],
      value: false,
    });

    const repeated = reducer(cleared, {
      type: 'set',
      kind: 'joinedComunas',
      ids: ['hortas'],
      value: false,
    });

    expect(repeated).toBe(cleared);
    expect(repeated.joinedComunas).toBe(cleared.joinedComunas);
  });

  it('grava o falso explícito quando o ID ainda não era conhecido', () => {
    const state = initialState();

    const cleared = reducer(state, {
      type: 'set',
      kind: 'joinedComunas',
      ids: ['hortas'],
      value: false,
    });

    // `undefined` significa "ainda não conhecido" para `membershipOf`; o falso
    // explícito é o que sobrepõe o `viewerIsMember` do servidor ao sair.
    expect(cleared).not.toBe(state);
    expect(cleared.joinedComunas.hortas).toBe(false);
  });

  it('ignora um set sem IDs', () => {
    const state = initialState();
    expect(reducer(state, { type: 'set', kind: 'savedPosts', ids: [], value: true })).toBe(state);
  });

  it('cria um novo estado quando pelo menos um ID muda', () => {
    const state = reducer(initialState(), {
      type: 'set',
      kind: 'goingEvents',
      ids: ['chamado-1'],
      value: true,
    });

    const next = reducer(state, {
      type: 'set',
      kind: 'goingEvents',
      ids: ['chamado-1', 'chamado-2'],
      value: true,
    });

    expect(next).not.toBe(state);
    expect(next.goingEvents).not.toBe(state.goingEvents);
    expect(next.goingEvents).toEqual({ 'chamado-1': true, 'chamado-2': true });
  });

  it('desmarca um ID que estava marcado', () => {
    const state = reducer(initialState(), {
      type: 'set',
      kind: 'goingEvents',
      ids: ['chamado-1'],
      value: true,
    });

    const next = reducer(state, {
      type: 'set',
      kind: 'goingEvents',
      ids: ['chamado-1'],
      value: false,
    });

    expect(next).not.toBe(state);
    expect(next.goingEvents['chamado-1']).toBe(false);
  });

  it('não cria novo estado quando a contagem de comentários repete ou diminui', () => {
    const state = reducer(initialState(), { type: 'commentCount', postId: 'p1', count: 3 });

    expect(reducer(state, { type: 'commentCount', postId: 'p1', count: 3 })).toBe(state);
    expect(reducer(state, { type: 'commentCount', postId: 'p1', count: 2 })).toBe(state);
    expect(reducer(state, { type: 'commentCount', postId: 'p2', count: 1 })).not.toBe(state);
  });
});
