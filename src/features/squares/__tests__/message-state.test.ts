import { describe, expect, it } from '@jest/globals';
import { mergeMessages, optimisticReaction } from '../message-state';
import { message } from '../testing/fixtures';

describe('reconciliação das mensagens', () => {
  it('troca o envio otimista pelo eco sem duplicar e preserva referências sem alterações', () => {
    const old = message('m001');
    const pending = message('local123', { clientId: 'client123', pending: true, revision: 0 });
    const real = message('m002', { clientId: 'client123' });
    const merged = mergeMessages([pending, old], [real, { ...old }]);
    expect(merged.map((m) => m.id)).toEqual(['m002', 'm001']);
    expect(merged[1]).toBe(old);
    expect(mergeMessages(merged, [real])).toEqual(merged);
  });
  it('não ressuscita conteúdo removido com uma página atrasada', () => {
    const removed = message('m001', { status: 'removed', author: null, body: null, revision: 4 });
    expect(mergeMessages([removed], [message('m001', { revision: 2 })])[0]).toBe(removed);
    const hidden = message('m002', { status: 'hidden', author: null, body: null });
    expect(mergeMessages([message()], [hidden])[0].body).toBeNull();
  });
  it('mantém uma janela limitada e ordenação estável ao anexar páginas', () => {
    const rows = Array.from({ length: 250 }, (_, i) => message(`m${String(i).padStart(3, '0')}`));
    const merged = mergeMessages([], rows);
    expect(merged).toHaveLength(200);
    expect(merged[0].id).toBe('m249');
    expect(merged.at(-1)?.id).toBe('m050');
  });
  it('faz toggle otimista da reação sem criar contagem negativa', () => {
    expect(optimisticReaction([], '✊')).toEqual([{ emoji: '✊', count: 1, mine: true }]);
    expect(optimisticReaction([{ emoji: '✊', count: 1, mine: true }], '✊')).toEqual([]);
  });
});
